import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/GLTFLoader.js';
import { OrbitControls } from 'three/addons/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/RoomEnvironment.js';

const $ = id => document.getElementById(id);
const status = $('status');
try {
  const canvas = $('canvas'), viewport = $('viewport');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, .02, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.8, 0);
  controls.minDistance = 2; controls.maxDistance = 24;
  controls.enableDamping = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = new RoomEnvironment();
  const target = pmrem.fromScene(environment, .04);
  scene.environment = target.texture;
  environment.dispose(); pmrem.dispose();
  scene.add(new THREE.HemisphereLight(0xdeefff, 0x5c5442, 2));
  const light = new THREE.DirectionalLight(0xffedd6, 2.4);
  light.position.set(-3, 6, -5); scene.add(light);

  const [modelResponse, metaResponse] = await Promise.all([
    fetch('./models/alignment_test_facade.glb'), fetch('./models/alignment_test_facade.manifest.json')
  ]);
  if (!modelResponse.ok || !metaResponse.ok) throw Error('모델 파일에 접근하지 못했습니다.');
  const [bytes, manifest] = await Promise.all([modelResponse.arrayBuffer(), metaResponse.json()]);
  if (globalThis.crypto?.subtle) {
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
    if (hash !== manifest.sha256) throw Error('모델 파일 검증값이 일치하지 않습니다.');
  }
  const gltf = await new GLTFLoader().parseAsync(bytes, new URL('./models/', location.href).href);
  const placement = new THREE.Group(); placement.add(gltf.scene); scene.add(placement);
  const layerMap = {reference:'REFERENCE_Facade', markers:'CALIBRATION_Markers', grid:'CALIBRATION_Grid', overlay:'OVERLAY_Architecture'};
  const layers = {};
  for (const [id, name] of Object.entries(layerMap)) {
    layers[id] = gltf.scene.getObjectByName(name);
    if (!layers[id]) throw Error('필수 레이어가 없습니다: ' + name);
    $(id).disabled = false;
    $(id).addEventListener('change', () => { layers[id].visible = $(id).checked; });
  }
  // BLEND material ordering is an engine render setting, not encoded by GLB.
  layers.overlay.traverse(object => {
    if (object.isMesh) { object.material.depthWrite = false; object.renderOrder = 2; }
  });
  $('opacity').disabled = false;
  $('opacity').addEventListener('input', () => {
    const alpha = Number($('opacity').value)/100;
    layers.overlay.traverse(object => { if(object.isMesh) object.material.opacity = alpha; });
    $('opacity-value').value = Math.round(alpha*100)+'%';
  });
  let currentFront = false;
  function view(front) {
    currentFront = front;
    controls.target.set(0,1.8,0);
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov)/2,
      Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*camera.aspect));
    const radius = Math.hypot(6.16,3.755,.254)/2;
    const distance = radius / Math.sin(halfFov) * 1.08;
    const direction = new THREE.Vector3(...(front ? [0,0,-1] : [6.2,2.5,-10.5])).normalize();
    camera.position.copy(controls.target).addScaledVector(direction,distance);
    controls.maxDistance = Math.max(30,distance*2); controls.update();
    $('front').setAttribute('aria-pressed', String(front));
    $('oblique').setAttribute('aria-pressed', String(!front));
  }
  for(const id of ['front','oblique','reset']) $(id).disabled = false;
  $('front').onclick = () => view(true);
  $('oblique').onclick = () => view(false);
  $('reset').onclick = () => {
    for(const id in layers) { $(id).checked = true; layers[id].visible = true; }
    $('opacity').value = '28'; $('opacity').dispatchEvent(new Event('input')); view(false);
  };
  for(const point of manifest.calibration.reference_points) {
    const row = document.createElement('tr');
    const name = document.createElement('td'); name.textContent = point.node.replace('PT_', ''); row.append(name);
    for(const v of point.position_gltf_m) {const cell=document.createElement('td');cell.textContent=Number(v).toFixed(2);row.append(cell);}
    $('points').append(row);
    const actual = gltf.scene.getObjectByName(point.node);
    if(!actual || actual.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...point.position_gltf_m)) > .00001) throw Error('기준점 좌표 검증 실패');
  }
  function resize() {
    const w=viewport.clientWidth, h=viewport.clientHeight;
    renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();view(currentFront);
  }
  new ResizeObserver(resize).observe(viewport); resize(); view(false);
  renderer.render(scene,camera);
  $('poster').hidden = true;
  $('render-status').textContent = 'WebGL · 모델 로드 완료';
  status.dataset.state = 'ready';
  status.textContent = 'GLB · 기준점 11개 확인 완료';
  function tick(){controls.update();renderer.render(scene,camera);requestAnimationFrame(tick);}requestAnimationFrame(tick);
} catch(error) {
  status.dataset.state = 'error'; status.classList.add('error');
  status.textContent = '3D 뷰어를 열지 못했습니다. GLB를 내려받거나 WebGL을 지원하는 최신 브라우저에서 다시 열어주세요. ('+error.message+')';
  $('render-status').textContent = '렌더 이미지 미리보기';
  $('canvas').hidden = true;
  console.error(error);
}
