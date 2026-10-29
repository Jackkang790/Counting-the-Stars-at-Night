// 04-A 빈 땅 작품 — "땅에서 솟아오름" 장면 컨트롤러.
// Codex 실제 에셋(starseed_sculpture) 기준:
//  - 클립 이름: Emerge / Idle / Disappear (모두 ANCHOR_Ground 노드의 TRS 제어)
//  - Emerge: 1회, 끝 유지, hidden→visible. 완료 후 Idle로 전환. Disappear: visible→hidden.
//  - 계약 초안의 `AR_` 접두사와도 호환되도록 findClipLoose로 탐색(에셋 미수정, 지시 #4).
// GLB에 클립이 없으면(임시 모델) 동일 의미의 절차적 등장/대기로 대체한다.
import * as THREE from "three";
import type { LoadedModel } from "../loaders/gltf";
import { findClipLoose } from "../loaders/gltf";
import type { AssetEntry } from "../loaders/manifest";

const EMERGE_SECONDS = 3.0;

export class EmergingArtworkScene {
  readonly object: THREE.Object3D;
  /** GLB에서 실제로 발견한 클립 이름(로그/검증용). */
  readonly clipNames: string[];

  private mixer?: THREE.AnimationMixer;
  private emergeAction?: THREE.AnimationAction;
  private idleAction?: THREE.AnimationAction;
  private disappearAction?: THREE.AnimationAction;

  // 절차적 등장(클립 없을 때)
  private procedural = false;
  private emergeStart = -1;
  private emerging = false;

  private onEmergeComplete?: () => void;

  constructor(model: LoadedModel, _asset?: AssetEntry) {
    this.object = model.root;
    this.clipNames = model.animations.map((c) => c.name);

    const emergeClip = findClipLoose(model.animations, "Emerge");
    const idleClip = findClipLoose(model.animations, "Idle");
    const disappearClip = findClipLoose(model.animations, "Disappear");

    if (emergeClip || idleClip || disappearClip) {
      this.mixer = new THREE.AnimationMixer(this.object);
      if (emergeClip) {
        this.emergeAction = this.mixer.clipAction(emergeClip);
        this.emergeAction.setLoop(THREE.LoopOnce, 1);
        this.emergeAction.clampWhenFinished = true;
      }
      if (idleClip) {
        this.idleAction = this.mixer.clipAction(idleClip);
        this.idleAction.setLoop(THREE.LoopRepeat, Infinity);
      }
      if (disappearClip) {
        this.disappearAction = this.mixer.clipAction(disappearClip);
        this.disappearAction.setLoop(THREE.LoopOnce, 1);
        this.disappearAction.clampWhenFinished = true;
      }
    } else {
      this.procedural = true;
    }

    this.prepareHidden();
  }

  /** 배치 직후 호출. 등장 애니메이션 시작. */
  emerge(onComplete?: () => void): void {
    this.onEmergeComplete = onComplete;
    this.object.visible = true;

    if (this.emergeAction && this.mixer) {
      this.emergeAction.reset();
      this.emergeAction.play();
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== this.emergeAction) return;
        this.mixer!.removeEventListener("finished", onFinished as never);
        this.playIdle();
        this.onEmergeComplete?.();
      };
      this.mixer.addEventListener("finished", onFinished as never);
    } else if (this.idleAction) {
      this.playIdle();
      this.onEmergeComplete?.();
    } else {
      // 절차적 등장
      this.emerging = true;
      this.emergeStart = -1;
    }
  }

  /** 퇴장(Disappear) 재생. 완료 시 onDone. */
  dismiss(onDone?: () => void): void {
    if (this.disappearAction && this.mixer) {
      this.idleAction?.stop();
      this.emergeAction?.stop();
      this.disappearAction.reset();
      this.disappearAction.play();
      const onFinished = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== this.disappearAction) return;
        this.mixer!.removeEventListener("finished", onFinished as never);
        this.object.visible = false;
        onDone?.();
      };
      this.mixer.addEventListener("finished", onFinished as never);
    } else {
      // 클립 없음: 간단히 숨김.
      this.object.visible = false;
      onDone?.();
    }
  }

  private playIdle(): void {
    if (!this.idleAction) return;
    this.emergeAction?.stop();
    this.idleAction.reset();
    this.idleAction.play();
  }

  private prepareHidden(): void {
    if (this.emergeAction && this.mixer) {
      this.mixer.setTime(0); // t=0 평가(초기 전체 크기 노출 방지)
      this.object.visible = false;
    } else if (this.procedural) {
      this.object.scale.setScalar(0.001);
      this.object.visible = false;
    } else {
      this.object.visible = false;
    }
  }

  /** 매 프레임 호출. dt(초), elapsed(초, 절차적 idle용). */
  update(dt: number, elapsed: number): void {
    if (this.mixer) {
      this.mixer.update(dt);
      return;
    }
    if (!this.procedural) return;

    if (this.emerging) {
      if (this.emergeStart < 0) this.emergeStart = elapsed;
      const t = Math.min((elapsed - this.emergeStart) / EMERGE_SECONDS, 1);
      const k = 1 - Math.pow(1 - t, 3); // easeOutCubic
      this.object.scale.setScalar(Math.max(0.001, k));
      if (t >= 1) {
        this.emerging = false;
        this.onEmergeComplete?.();
      }
    } else if (this.object.visible) {
      this.object.rotation.y = THREE.MathUtils.degToRad(2) * Math.sin(elapsed * 1.5);
    }
  }

  /** 터치 상호작용 — 강조 펄스. */
  pulse(): void {
    const base = this.object.scale.x || 1;
    const start = performance.now();
    const duration = 220;
    const animate = () => {
      const t = Math.min((performance.now() - start) / duration, 1);
      const s = base * (1 + 0.08 * Math.sin(t * Math.PI));
      this.object.scale.setScalar(s);
      if (t < 1) requestAnimationFrame(animate);
      else this.object.scale.setScalar(base);
    };
    animate();
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    this.mixer = undefined;
  }
}
