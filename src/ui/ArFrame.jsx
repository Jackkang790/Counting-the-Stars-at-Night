// 카메라(AR) 화면 공통 틀: 카메라(데모면 목업 풍경) + 상단(ArHead) + 데모 "건너뛰기" + 안내 한 줄 + 화면 내용.
// 03 Scan · 04-A Artwork · 04-B Stage · 06 Roleplay · 07 Escape 가 이 틀 하나를 씀 → 화면은 가운데 내용만 채움.
//   className : .ar 에 붙일 클래스(escape · xr 등)
//   scene     : 카메라 목업 장면(building | ground | wall | street) — Camera.jsx
//   camera    : false 면 카메라를 안 그림(WebXR 이 카메라를 직접 쓸 때)
//   left · pill · right : 상단(ArHead). right 는 보관함 버튼 앞에 붙음
//   skip      : 데모 모드일 때 상단에 "건너뛰기" (06 · 07 — 바로 별 받고 08)
//   skipAlways: true 면 데모가 아니어도 "건너뛰기"
//   hint      : 상단 아래 안내 한 줄(.ar-hint)
//   나머지 props(ref · 스와이프 핸들러 등)는 .ar 에 그대로 붙음
import { forwardRef } from 'react';
import { useApp } from '../store.jsx';
import Camera from './Camera.jsx';
import { ArHead } from './chrome.jsx';

const ArFrame = forwardRef(function ArFrame(
  { className = '', scene = 'building', dim = false, camera = true, left = 'close', pill, right = null, skip, skipAlways = false, hint, children, ...rest },
  ref,
) {
  const { demo } = useApp();
  const skipBtn = skip && (demo.on || skipAlways) ? <button type="button" className="pill line skip" onClick={skip}>건너뛰기 ▸▸</button> : null;
  const side = skipBtn && right ? <span className="head-right">{skipBtn}{right}</span> : skipBtn || right;
  return (
    <div className={'ar' + (className ? ' ' + className : '')} ref={ref} {...rest}>
      {camera && <Camera scene={scene} dim={dim} />}
      <ArHead left={left} pill={pill} right={side} />
      {hint && <div className="ar-hint">{hint}</div>}
      {children}
    </div>
  );
});

export default ArFrame;
