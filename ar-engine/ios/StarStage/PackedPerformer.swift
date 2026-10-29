import AVFoundation
import CoreImage
import SceneKit
import UIKit

/// A building-local 3D plane, never a camera child. Not a volumetric human.
final class PackedPerformer {
    let node = SCNNode()
    let config: Show.Actor
    let player: AVPlayer
    private let item: AVPlayerItem
    private let output: AVPlayerItemVideoOutput
    private let material = SCNMaterial()
    private let context: CIContext
    private var duration = 0.0
    private var seeking = false
    private var observation: NSKeyValueObservation?
    var failure: ((String) -> Void)?

    init(config: Show.Actor, url: URL, context: CIContext) {
        self.config = config; self.context = context
        item = AVPlayerItem(url: url)
        output = AVPlayerItemVideoOutput(pixelBufferAttributes: [kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA])
        item.add(output); player = AVPlayer(playerItem: item); player.isMuted = true
        let plane = SCNPlane(width: CGFloat(config.width), height: CGFloat(config.height))
        material.lightingModel = .constant; material.isDoubleSided = true
        material.blendMode = .alpha; material.writesToDepthBuffer = false
        material.diffuse.contents = UIColor.clear; plane.materials = [material]
        let mesh = SCNNode(geometry: plane); mesh.position.y = Float(config.height/2); mesh.eulerAngles.y = .pi
        node.name = "PERFORMER_\(config.id)"; node.addChildNode(mesh); node.isHidden = true
        node.position = SCNVector3(config.position.map(Float.init)); node.eulerAngles = SCNVector3(config.rotation.map(Float.init))
        observation = item.observe(\.status, options: [.new]) { [weak self] item, _ in
            if item.status == .failed { DispatchQueue.main.async { self?.failure?(item.error?.localizedDescription ?? "영상 디코딩 실패") } }
        }
    }
    @MainActor func prepare() async throws {
        let asset = item.asset
        guard try await asset.load(.isPlayable) else { throw Failure.message("재생할 수 없는 영상입니다") }
        duration = try await asset.load(.duration).seconds
        guard duration.isFinite && duration > 0 else { throw Failure.message("영상 길이가 올바르지 않습니다") }
        // Bounded preparation: do not start the show while a decoder is unready.
        for _ in 0..<150 {
            if item.status == .readyToPlay { return }
            if item.status == .failed { throw item.error ?? Failure.message("영상 준비 실패") }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw Failure.message("영상 준비 시간 초과")
    }
    func sample(_ time: Double, playing: Bool) {
        let opacity = config.opacity(at: time); node.opacity = CGFloat(opacity); node.isHidden = opacity <= 0
        guard opacity > 0, duration > 0 else { player.pause(); return }
        let elapsed = max(0,time-config.start)+config.mediaOffset
        let expected = config.loop ? elapsed.truncatingRemainder(dividingBy: duration) : min(duration-0.02,elapsed)
        if abs(player.currentTime().seconds-expected) > 0.15 && !seeking {
            seeking = true; player.pause()
            player.seek(to: CMTime(seconds: expected, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
                DispatchQueue.main.async { self?.seeking = false }
            }
        }
        if playing && !seeking { player.play() } else { player.pause() }
        let itemTime = player.currentTime()
        guard output.hasNewPixelBuffer(forItemTime: itemTime), let buffer = output.copyPixelBuffer(forItemTime: itemTime, itemTimeForDisplay: nil) else { return }
        let packed = CIImage(cvPixelBuffer: buffer), w = packed.extent.width/2, h = packed.extent.height
        let rect = CGRect(x: 0,y: 0,width: w,height: h)
        let color = packed.cropped(to: rect)
        let matte = packed.cropped(to: CGRect(x: w,y: 0,width: w,height: h)).transformed(by: CGAffineTransform(translationX: -w,y: 0))
        let clear = CIImage(color: .clear).cropped(to: rect)
        let rgba = color.applyingFilter("CIBlendWithMask", parameters: [kCIInputBackgroundImageKey: clear,kCIInputMaskImageKey: matte])
        if let image = context.createCGImage(rgba, from: rect) { material.diffuse.contents = image }
    }
    func pause() { player.pause() }
    deinit { player.pause(); observation?.invalidate() }
}
private extension SCNVector3 {
    init(_ values: [Float]) { self.init(values[0],values[1],values[2]) }
}
