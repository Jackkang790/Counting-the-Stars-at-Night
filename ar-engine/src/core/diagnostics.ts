// AR 실행 실패 원인 진단 — 환경 정보 수집 + 세션 오류 해석.
import type { ARSupportReport } from "../types";
import { checkSupport } from "./support";

export interface ARDiagnostics {
  timestamp: string;
  userAgent: string;
  platform: string;
  language: string;
  protocol: string;
  isSecureContext: boolean;
  hasNavigatorXR: boolean;
  immersiveARSupported: boolean | "unknown";
  webglAvailable: boolean;
  deviceMemoryGB?: number;
  support: ARSupportReport;
}

export async function collectDiagnostics(): Promise<ARDiagnostics> {
  const xr = (navigator as Navigator & { xr?: XRSystem }).xr;
  let immersiveARSupported: boolean | "unknown" = "unknown";
  if (xr) {
    try {
      immersiveARSupported = await xr.isSessionSupported("immersive-ar");
    } catch {
      immersiveARSupported = "unknown";
    }
  }
  return {
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    platform: (navigator as Navigator & { platform?: string }).platform ?? "?",
    language: navigator.language,
    protocol: location.protocol,
    isSecureContext: window.isSecureContext === true,
    hasNavigatorXR: !!xr,
    immersiveARSupported,
    webglAvailable: detectWebGL(),
    deviceMemoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
    support: await checkSupport(),
  };
}

function detectWebGL(): boolean {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

export function formatDiagnostics(d: ARDiagnostics): string {
  return [
    `[AR 진단 ${d.timestamp}]`,
    `  UA            : ${d.userAgent}`,
    `  protocol      : ${d.protocol} (secureContext=${d.isSecureContext})`,
    `  navigator.xr  : ${d.hasNavigatorXR}`,
    `  immersive-ar  : ${d.immersiveARSupported}`,
    `  webgl         : ${d.webglAvailable}`,
    `  deviceMemory  : ${d.deviceMemoryGB ?? "?"} GB`,
    `  support.reason: ${d.support.reason ?? "(none)"} — ${d.support.guidanceMessage}`,
  ].join("\n");
}

/**
 * requestSession 실패 시 DOMException 이름을 사용자용 코드/메시지로 해석.
 * (가짜 성공으로 감추지 않고, 실패 원인을 명확히 드러낸다.)
 */
export function describeSessionError(err: unknown): { code: string; message: string } {
  const name = err instanceof DOMException ? err.name : err instanceof Error ? err.name : "Error";
  const detail = err instanceof Error ? err.message : String(err);
  switch (name) {
    case "NotAllowedError":
      return { code: "permission-denied", message: `카메라/AR 권한이 거부되었거나 사용자가 취소했습니다. (${detail})` };
    case "NotSupportedError":
      return { code: "not-supported", message: `이 기기/브라우저가 immersive-ar을 지원하지 않습니다. ARCore(Android) + 최신 Chrome 필요. (${detail})` };
    case "SecurityError":
      return { code: "insecure-context", message: `보안 컨텍스트(HTTPS)가 아닙니다. https 또는 localhost로 접속하세요. (${detail})` };
    case "InvalidStateError":
      return { code: "invalid-state", message: `이미 다른 XR 세션이 활성 상태일 수 있습니다. (${detail})` };
    case "AbortError":
      return { code: "aborted", message: `세션 시작이 중단되었습니다(사용자 취소 등). (${detail})` };
    default:
      return { code: "unknown", message: `AR 세션 시작 실패: ${name} — ${detail}` };
  }
}
