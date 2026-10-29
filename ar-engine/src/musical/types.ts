export type VideoMode = "packed" | "alpha" | "chroma";
export type Vec3 = [number, number, number];
export interface ActorConfig {
  id: string; label: string; anchor: "door" | "panel";
  position: Vec3; rotation: Vec3; height: number; width: number;
  start: number; end: number; fadeIn: number; fadeOut: number;
  mediaOffset: number; loop: boolean; mode: VideoMode;
}
export interface BuildingConfig {
  id: string; provisional: boolean; width: number; height: number; depth: number;
  door: { x: number; y: number; width: number; height: number };
  panel: { x: number; y: number; width: number; height: number };
  target: { widthMeters: number; center: Vec3 };
}
export interface Cue { id: string; start: number; end: number; label: string; light: number; particles: number }
export interface ShowConfig { id: string; version: number; duration: number; building: BuildingConfig; actors: ActorConfig[]; cues: Cue[] }
export type PlaybackState = "ready" | "playing" | "paused" | "completed";
export interface PerformerRenderer {
  readonly group: Group;
  readonly representation: "spatial-video-plane" | "mesh-sequence" | "rigged-glb";
  readonly contentKind: "video" | "human-capture" | "synthetic-calibration" | "generated-human";
  readonly loaded: boolean;
  prime(): Promise<void>;
  sample(showTime: number, playing: boolean): void;
  pause(): void;
  dispose(): void;
}
import type { Group } from "three";
