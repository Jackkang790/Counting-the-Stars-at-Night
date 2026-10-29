// 타입 안전 이벤트 이미터(의존성 없음).
import type { ARExperienceEventMap } from "./types";

type AnyHandler = (payload: unknown) => void;

export class EventBus {
  private handlers = new Map<keyof ARExperienceEventMap, Set<AnyHandler>>();

  on<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler as AnyHandler);
    return () => this.off(type, handler);
  }

  off<K extends keyof ARExperienceEventMap>(
    type: K,
    handler: (payload: ARExperienceEventMap[K]) => void
  ): void {
    this.handlers.get(type)?.delete(handler as AnyHandler);
  }

  emit<K extends keyof ARExperienceEventMap>(
    type: K,
    payload: ARExperienceEventMap[K]
  ): void {
    const set = this.handlers.get(type);
    if (!set) return;
    for (const handler of set) {
      try {
        handler(payload);
      } catch (err) {
        // 핸들러 예외가 엔진 루프를 깨지 않도록 격리.
        console.error(`[ar-engine] event handler error (${String(type)})`, err);
      }
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}
