import type { ActorConfig, Cue, ShowConfig } from "./types";

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
export function validateShow(value: unknown): ShowConfig {
  const show = value as ShowConfig;
  if (!show || !finite(show.duration) || show.duration <= 0 || show.duration > 600 || !Array.isArray(show.actors) || show.actors.length < 2 || !Array.isArray(show.cues)) throw new Error("공연 데이터의 길이·배우·큐를 확인하세요.");
  const b = show.building;
  if (!b || ![b.width, b.height, b.depth, b.target?.widthMeters, b.door?.width, b.door?.height, b.panel?.width, b.panel?.height].every(v => finite(v) && v > 0) || ![b.door.x, b.door.y, b.panel.x, b.panel.y].every(finite) || !Array.isArray(b.target.center) || b.target.center.length !== 3 || !b.target.center.every(finite)) throw new Error("건물 치수가 올바르지 않습니다.");
  const ids = new Set<string>();
  for (const a of show.actors) {
    if (!a.id || ids.has(a.id) || ![a.start, a.end, a.height, a.width, a.fadeIn, a.fadeOut, a.mediaOffset].every(finite) || a.start < 0 || a.end <= a.start || a.end > show.duration || a.width <= 0 || a.height <= 0 || a.fadeIn < 0 || a.fadeOut < 0 || a.mediaOffset < 0 || ![a.position, a.rotation].every(v => Array.isArray(v) && v.length === 3 && v.every(finite)) || !["door", "panel", "stage"].includes(a.anchor) || !["packed", "alpha", "chroma"].includes(a.mode)) throw new Error(`배우 데이터 오류: ${a.id}`);
    ids.add(a.id);
  }
  let next = 0;
  for (const cue of show.cues) {
    if (![cue.start, cue.end, cue.light, cue.particles].every(finite) || cue.start !== next || cue.end <= cue.start || cue.end > show.duration || cue.light < 0 || cue.particles < 0) throw new Error("타임라인 큐의 구간이 겹치거나 비어 있습니다.");
    next = cue.end;
  }
  if (next !== show.duration) throw new Error("타임라인이 공연 끝까지 이어져야 합니다.");
  return show;
}
export function cueAt(show: ShowConfig, time: number): Cue {
  return show.cues.find(c => time >= c.start && time < c.end) ?? show.cues[show.cues.length - 1];
}
export function actorOpacity(actor: ActorConfig, time: number): number {
  if (time < actor.start || time >= actor.end) return 0;
  const fade = Math.min(1, actor.fadeIn ? (time - actor.start) / actor.fadeIn : 1, actor.fadeOut ? (actor.end - time) / actor.fadeOut : 1);
  return fade * fade * (3 - 2 * fade);
}
export function mediaTime(actor: ActorConfig, showTime: number, duration: number): number {
  const t = Math.max(0, showTime - actor.start) + actor.mediaOffset;
  return actor.loop && Number.isFinite(duration) && duration > 0 ? t % duration : Math.min(t, Math.max(0, duration - 0.04));
}
