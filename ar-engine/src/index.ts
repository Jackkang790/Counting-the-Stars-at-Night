// 공개 진입점 — contracts/ar-api.md.
import { AREngine } from "./engine";
import type { ARExperience, AREngineOptions } from "./types";

export function createARExperience(options: AREngineOptions = {}): ARExperience {
  return new AREngine(options);
}

export type {
  ARExperience,
  AREngineOptions,
  StartRequest,
  ARSupportReport,
  ARMode,
  SceneCategory,
  ARExperienceEventMap,
  ExperienceCompletedEvent,
} from "./types";
