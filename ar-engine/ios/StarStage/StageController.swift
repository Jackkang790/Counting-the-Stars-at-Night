import ARKit
import AVFoundation
import Combine
import CoreImage
import SceneKit
import UIKit

final class StageController: NSObject, ObservableObject, ARSessionDelegate, ARSCNViewDelegate {
    let view = ARSCNView(frame: .zero)
    @Published var status = "카메라 시작을 눌러 주세요"
    @Published var ready = false
    @Published var placed = false
    @Published var tracking = false
    @Published var playing = false
    @Published var time = 0.0
    @Published var cameraStarted = false
    @Published var photo: UIImage?
    @Published var venueID = "photo-room-provisional"
    private var show: Show?
    private var stage: StageGeometry?
    private var actors: [PackedPerformer] = []
    private var music: AVAudioPlayer?
    private var anchor: ARAnchor?
    private var anchorNode: SCNNode?
    private var display: CADisplayLink?
    private var notifications: [NSObjectProtocol] = []

    override init() {
        super.init()
        view.session.delegate = self; view.delegate = self
        view.scene = SCNScene(); view.automaticallyUpdatesLighting = true
        view.preferredFramesPerSecond = 30
        view.addGestureRecognizer(UITapGestureRecognizer(target: self,action: #selector(place(_:))))
        notifications.append(NotificationCenter.default.addObserver(forName: UIApplication.willResignActiveNotification,object: nil,queue: .main) { [weak self] _ in
            self?.pause(); self?.tracking = false; self?.stage?.root.isHidden = true; self?.view.session.pause()
        })
        notifications.append(NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,object: nil,queue: .main) { [weak self] _ in
            guard let self, self.cameraStarted else { return }; self.runSession(reset: false)
        })
        notifications.append(NotificationCenter.default.addObserver(forName: AVAudioSession.interruptionNotification,object: nil,queue: .main) { [weak self] _ in
            self?.pause(); self?.status = "오디오가 중단되었습니다 · 시작 버튼으로 재개하세요"
        })
        do { let show = try Show.load(); self.show = show; self.stage = StageGeometry(show.building) }
        catch { status = error.localizedDescription }
    }
    @MainActor func prepare() async {
        guard let show, let stage, !ready, actors.isEmpty else { return }
        do {
            let context = CIContext(options: [.cacheIntermediates: false])
            for (i,config) in show.actors.enumerated() {
                guard let url = Bundle.main.url(forResource: i == 0 ? "actor-a-demo" : "actor-b-demo",withExtension: "mp4"), let anchorPosition = stage.anchors[config.anchor] else { throw Failure.message("배우 파일 또는 건물 앵커 누락") }
                let actor = PackedPerformer(config: config,url: url,context: context)
                actor.failure = { [weak self] text in self?.pause(); self?.ready = false; self?.status = text }
                actors.append(actor)
                let localAnchor = SCNNode(); localAnchor.name = "ANCHOR_\(config.anchor)"; localAnchor.position = anchorPosition
                localAnchor.addChildNode(actor.node); stage.root.addChildNode(localAnchor)
                try await actor.prepare()
            }
            music = try AVAudioPlayer(data: DemoScore.wav(seconds: show.duration))
            guard music?.prepareToPlay() == true else { throw Failure.message("음악 준비 실패") }
            ready = true; status = "장소 준비 완료 · 카메라를 시작하고 무대가 설 바닥을 탭하세요"
            display = CADisplayLink(target: self,selector: #selector(tick)); display?.preferredFramesPerSecond = 24; display?.add(to: .main,forMode: .common)
        } catch { pause(); status = error.localizedDescription }
    }
    func startCamera() {
        guard ARWorldTrackingConfiguration.isSupported else { status = "이 기기는 ARKit 월드 추적을 지원하지 않습니다"; return }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: cameraStarted = true; runSession(reset: true)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { [weak self] allowed in DispatchQueue.main.async { if allowed { self?.startCamera() } else { self?.status = "설정에서 카메라 접근을 허용해 주세요" } } }
        default: status = "설정에서 카메라 접근을 허용해 주세요"
        }
    }
    private func runSession(reset: Bool) {
        let config = ARWorldTrackingConfiguration(); config.planeDetection = [.horizontal]; config.worldAlignment = .gravity
        if reset { resetPlacement(); view.session.run(config,options: [.resetTracking,.removeExistingAnchors]) }
        else { view.session.run(config) }
        status = "바닥을 천천히 비춘 뒤 무대의 중심을 탭하세요 · 사진 표적은 필요 없습니다"
    }
    @objc private func place(_ gesture: UITapGestureRecognizer) {
        guard cameraStarted, tracking, ready, !placed, anchor == nil, let frame = view.session.currentFrame else { return }
        let point = gesture.location(in: view)
        let query = view.raycastQuery(from: point,allowing: .existingPlaneGeometry,alignment: .horizontal)
            ?? view.raycastQuery(from: point,allowing: .estimatedPlane,alignment: .horizontal)
        guard let query, let result = view.session.raycast(query).first else { status = "아직 바닥 위치를 찾지 못했습니다. 바닥의 무늬가 보이도록 천천히 움직여 주세요"; return }
        var transform = matrix_identity_float4x4
        let p = result.worldTransform.columns.3, camera = frame.camera.transform.columns.3
        // Stage -Z faces the audience. Yaw is set once, never updated to follow camera.
        let yaw = atan2(-(camera.x-p.x),-(camera.z-p.z))
        transform.columns.0 = SIMD4(cos(yaw),0,-sin(yaw),0)
        transform.columns.2 = SIMD4(sin(yaw),0,cos(yaw),0); transform.columns.3 = p
        let anchor = ARAnchor(name: venueID,transform: transform); self.anchor = anchor
        view.session.add(anchor: anchor); status = "무대 배치 중…"
    }
    func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
        DispatchQueue.main.async { [weak self] in
            guard let self, self.anchor?.identifier == anchor.identifier, let stage = self.stage else { return }
            self.anchorNode = node; node.addChildNode(stage.root); stage.root.isHidden = !self.tracking
            self.placed = true; self.status = "무대 배치 완료 · 공연 시작을 누르세요"
        }
    }
    func play() {
        guard ready, placed, tracking, let music, let show else { return }
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback,mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            if time >= show.duration { music.currentTime = 0; time = 0 }
            guard music.play() else { throw Failure.message("음악 시작 실패") }
            playing = true; status = "공연 중"
        } catch { status = error.localizedDescription; pause() }
    }
    func pause() { if playing, let music { time = music.currentTime }; music?.pause(); playing = false; actors.forEach { $0.pause() }; tick() }
    func replay() { pause(); music?.currentTime = 0; time = 0; tick(); play() }
    @objc private func tick() {
        guard let show else { return }
        if playing, let music {
            time = min(show.duration,music.currentTime)
            if !music.isPlaying {
                playing = false
                if time >= show.duration-0.2 { time = show.duration; status = "공연 종료 · 다시 보기" }
                else { actors.forEach { $0.pause() }; status = "음원 재생이 중단되었습니다 · 시작 버튼으로 재개하세요" }
            }
        }
        actors.forEach { $0.sample(time,playing: playing && tracking) }; stage?.sample(time,show: show)
    }
    func resetPlacement() {
        pause(); music?.currentTime = 0; time = 0
        if let anchor { view.session.remove(anchor: anchor) }
        anchor = nil; anchorNode = nil; stage?.root.removeFromParentNode(); stage?.root.eulerAngles = SCNVector3Zero
        stage?.root.scale = SCNVector3(1,1,1); placed = false
    }
    func rotate(_ degrees: Float) { stage?.root.eulerAngles.y += degrees * .pi / 180 }
    func scale(_ factor: Float) {
        guard let root = stage?.root else { return }; let s = min(3,max(0.1,root.scale.x*factor)); root.scale = SCNVector3(s,s,s)
    }
    func showBuilding(_ value: Bool) { stage?.building.isHidden = !value }
    func capture() { guard placed && tracking else { return }; photo = view.snapshot() }
    func openVenue(_ url: URL) {
        guard url.scheme == "starstage", url.host == "show", let parts = URLComponents(url: url,resolvingAgainstBaseURL: false), let venue = parts.queryItems?.first(where: { $0.name == "venue" })?.value,
              venue == "photo-room-provisional" else { status = "등록되지 않은 장소입니다"; return }
        resetPlacement(); venueID = venue; status = "시연 장소 선택됨 · 새로 무대를 배치하세요"
    }
    func session(_ session: ARSession, cameraDidChangeTrackingState camera: ARCamera) {
        let normal: Bool; if case .normal = camera.trackingState { normal = true } else { normal = false }
        DispatchQueue.main.async { [weak self] in
            guard let self else { return }; self.tracking = normal; self.stage?.root.isHidden = !normal
            if !normal { self.pause(); self.status = "공간 추적 준비 중 · 바닥을 천천히 비춰 주세요" }
            else if self.placed { self.status = "공간 추적 중 · 시작 버튼으로 공연을 재개하세요" }
            else { self.status = "공간 추적 준비 완료 · 무대가 설 바닥을 탭하세요" }
        }
    }
    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async { [weak self] in self?.tracking = false; self?.stage?.root.isHidden = true; self?.pause(); self?.status = "카메라 추적이 중단되었습니다" }
    }
    func sessionInterruptionEnded(_ session: ARSession) {
        DispatchQueue.main.async { [weak self] in self?.resetPlacement(); self?.runSession(reset: true) }
    }
    func session(_ session: ARSession,didFailWithError error: Error) {
        DispatchQueue.main.async { [weak self] in self?.tracking = false; self?.pause(); self?.stage?.root.isHidden = true; self?.status = error.localizedDescription }
    }
    deinit { display?.invalidate(); notifications.forEach { NotificationCenter.default.removeObserver($0) }; view.session.pause() }
}
