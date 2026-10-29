// WebXR 지원 여부 검증 — contracts/ar-api.md §2.
// 원칙: 미지원/불확실 환경을 "가짜 AR"로 대체하지 않는다. 명확히 안내하고 중단한다.
import type { ARSupportReport, SupportFailureReason } from "../types";

const GUIDANCE: Record<SupportFailureReason, string> = {
  "no-webxr":
    "이 브라우저는 WebXR을 지원하지 않습니다. Android에서 최신 Chrome으로 열어 주세요. (iOS Safari는 WebXR AR 미지원)",
  "no-immersive-ar":
    "이 기기/브라우저에서 AR 모드(immersive-ar)를 사용할 수 없습니다. ARCore 지원 Android + 최신 Chrome에서 실행해 주세요.",
  "insecure-context":
    "AR은 보안 연결(HTTPS)에서만 실행됩니다. https 주소 또는 localhost로 접속해 주세요.",
  "no-hit-test": "이 기기에서 바닥 인식(hit-test) 기능을 사용할 수 없습니다.",
  unknown: "AR을 실행할 수 없습니다. 기기와 브라우저 환경을 확인해 주세요.",
};

export async function checkSupport(): Promise<ARSupportReport> {
  const secureContext =
    typeof window !== "undefined" ? window.isSecureContext === true : false;
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  const webxr = !!xr;

  if (!webxr) {
    return report({
      supported: false,
      webxr: false,
      immersiveAR: false,
      secureContext,
      reason: secureContext ? "no-webxr" : "insecure-context",
    });
  }

  let immersiveAR = false;
  try {
    immersiveAR = await xr!.isSessionSupported("immersive-ar");
  } catch {
    immersiveAR = false;
  }

  if (!secureContext) {
    return report({ supported: false, webxr, immersiveAR, secureContext, reason: "insecure-context" });
  }
  if (!immersiveAR) {
    return report({ supported: false, webxr, immersiveAR, secureContext, reason: "no-immersive-ar" });
  }

  // hit-test/anchors/light-estimation은 세션을 요청해야 확정된다. 여기서는 낙관적 추정.
  return report({ supported: true, webxr, immersiveAR, secureContext });
}

function report(p: {
  supported: boolean;
  webxr: boolean;
  immersiveAR: boolean;
  secureContext: boolean;
  reason?: SupportFailureReason;
}): ARSupportReport {
  return {
    supported: p.supported,
    webxr: p.webxr,
    immersiveAR: p.immersiveAR,
    secureContext: p.secureContext,
    features: {
      hitTest: p.supported, // 추정값(세션 시작 시 required feature로 확정)
      domOverlay: p.supported,
      lightEstimation: p.supported,
      anchors: p.supported,
    },
    reason: p.reason,
    guidanceMessage: p.reason ? GUIDANCE[p.reason] : "AR 실행 준비 완료",
  };
}
