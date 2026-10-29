import SwiftUI
import UIKit

@main
struct StarStageApp: App {
    var body: some Scene { WindowGroup { StageScreen() } }
}
struct CameraSurface: UIViewRepresentable {
    let controller: StageController
    func makeUIView(context: Context) -> UIView { controller.view }
    func updateUIView(_ view: UIView,context: Context) {}
}
struct SharePhoto: UIViewControllerRepresentable {
    let image: UIImage
    func makeUIViewController(context: Context) -> UIActivityViewController { UIActivityViewController(activityItems: [image],applicationActivities: nil) }
    func updateUIViewController(_ controller: UIActivityViewController,context: Context) {}
}
struct StageScreen: View {
    @StateObject private var controller = StageController()
    @State private var building = false
    @State private var sharing = false
    var body: some View {
        ZStack(alignment: .bottom) {
            CameraSurface(controller: controller).ignoresSafeArea()
            VStack(alignment: .leading,spacing: 10) {
                Text("별 헤는 밤 · 공간형 공연").font(.headline)
                Text("실내 사진 장소 · 시연 모드").font(.caption)
                Text(controller.status).font(.subheadline).accessibilityIdentifier("stage-status")
                ProgressView(value: controller.time,total: 30)
                Text(String(format: "%.1f / 30초",controller.time)).font(.caption.monospacedDigit())
                if !controller.cameraStarted {
                    Button("1. 카메라 시작") { controller.startCamera() }.disabled(!controller.ready)
                } else if !controller.placed {
                    Text("2. 무대가 설 바닥을 탭하세요").bold()
                }
                HStack {
                    Button(controller.playing ? "일시정지" : "3. 공연 시작") { if controller.playing { controller.pause() } else { controller.play() } }
                        .disabled(!controller.placed || !controller.tracking || !controller.ready)
                    Button("다시 보기") { controller.replay() }.disabled(!controller.placed || !controller.tracking || !controller.ready)
                    Button("사진") { controller.capture(); sharing = controller.photo != nil }.disabled(!controller.placed || !controller.tracking)
                }
                DisclosureGroup("무대 조정 · 개발자") {
                    HStack { Button("회전 −") { controller.rotate(-5) }; Button("회전 +") { controller.rotate(5) }; Button("작게") { controller.scale(0.95) }; Button("크게") { controller.scale(1.05) } }
                    Toggle("임시 건물 모델 표시",isOn: $building).onChange(of: building) { controller.showBuilding($0) }
                    Button("무대 다시 배치") { controller.resetPlacement() }
                }
                Text("실사 샘플 2명 · 공간 고정 영상 평면이며 완전한 입체 인물은 아닙니다. GPS 도착 판정은 외부 서비스 연동 전입니다.").font(.caption2)
            }.padding().background(.ultraThinMaterial).clipShape(RoundedRectangle(cornerRadius: 18)).padding()
        }.task { await controller.prepare() }
            .onOpenURL { controller.openVenue($0) }
            .sheet(isPresented: $sharing) { if let image = controller.photo { SharePhoto(image: image) } }
    }
}
