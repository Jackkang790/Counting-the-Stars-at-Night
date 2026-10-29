// WebXR 평면인식(hit-test) → 탭한 땅 위치에 건물 배치
import * as THREE from 'three';

export async function isARSupported() {
  try {
    return !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-ar'));
  } catch {
    return false;
  }
}

function makeReticle() {
  const r = new THREE.Mesh(
    new THREE.RingGeometry(0.12, 0.16, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#ffd98a' }),
  );
  r.matrixAutoUpdate = false;
  r.visible = false;
  return r;
}

/**
 * opts:
 *  overlayRoot  – DOM overlay 루트(HUD·바텀시트가 이 안에 있어야 AR 중에도 보임)
 *  buildFor()   – async () => { group, update(dt) }
 *  onStatus(s)  – 'scanning' | 'found' | 'placed'
 *  onEnd()
 */
export async function startAR({ overlayRoot, buildFor, onStatus, onEnd, autoPlace = false }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.xr.enabled = true;
  renderer.domElement.className = 'xr-canvas';
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 50);
  scene.add(new THREE.HemisphereLight('#ffffff', '#3a3a4a', 1.4));
  const sun = new THREE.DirectionalLight('#ffffff', 1.2);
  sun.position.set(1, 3, 2);
  scene.add(sun);

  const reticle = makeReticle();
  scene.add(reticle);

  const session = await navigator.xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: overlayRoot },
  });
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);

  const viewerSpace = await session.requestReferenceSpace('viewer');
  const hitSource = await session.requestHitTestSource({ space: viewerSpace });

  let placed = null;
  let placing = false;
  let lastStatus = '';
  const status = (s) => { if (s !== lastStatus) { lastStatus = s; onStatus?.(s); } };
  status('scanning');

  let stableFrames = 0;
  const place = async () => {
    if (!reticle.visible || placed || placing) return;
    placing = true;
    const b = await buildFor();
    const pos = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    reticle.matrix.decompose(pos, q, s);
    b.group.position.copy(pos);
    // 건물 정면이 사용자 쪽을 보게
    const cam = renderer.xr.getCamera();
    const camPos = new THREE.Vector3().setFromMatrixPosition(cam.matrixWorld);
    b.group.rotation.y = Math.atan2(camPos.x - pos.x, camPos.z - pos.z);
    scene.add(b.group);
    placed = b;
    reticle.visible = false;
    status('placed');
  };
  session.addEventListener('select', place);

  const clock = new THREE.Clock();
  renderer.setAnimationLoop((_, frame) => {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (frame && !placed) {
      const hits = frame.getHitTestResults(hitSource);
      if (hits.length) {
        const pose = hits[0].getPose(renderer.xr.getReferenceSpace());
        reticle.visible = true;
        reticle.matrix.fromArray(pose.transform.matrix);
        status('found');
        // 탭 없이: 바닥이 1초쯤 안정적으로 잡히면 그 자리에 바로 솟아남
        if (autoPlace && ++stableFrames > 45) place();
      } else {
        stableFrames = 0;
        reticle.visible = false;
        status('scanning');
      }
    }
    placed?.update(dt);
    renderer.render(scene, camera);
  });

  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    hitSource.cancel?.();
    renderer.domElement.remove();
    renderer.dispose();
    onEnd?.();
  });

  // 위치 맞추기 / 다른 작품: 놓인 것을 치우고 다시 바닥을 잡아 그 자리에 솟아나게 함
  const replace = () => {
    if (placed) scene.remove(placed.group);
    placed = null;
    stableFrames = 0;
    status('scanning');
  };

  return { end: () => session.end(), replace };
}
