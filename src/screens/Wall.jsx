// 04-C 담장 = 미술 전시관 — 담장에 작품이 걸림 · 걸으며 감상. 빈 자리는 액자 없이 별무리.
// TODO(추적): 지금은 좌우로 밀어서 다음 작품. 현장에선 걸음(위치 이동)에 맞춰 넘어가게 교체.
import { useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import Camera from '../ui/Camera.jsx';
import { ArHead } from '../ui/chrome.jsx';
import { Peek } from '../ui/Screen.jsx';

// 고정된 별 배치(렌더마다 바뀌지 않게)
const rnd = (n) => ((Math.sin(n * 12.9898) * 43758.5453) % 1 + 1) % 1;
const STARS = Array.from({ length: 22 }, (_, i) => ({
  x: rnd(i + 1) * 100, y: rnd(i + 50) * 100, r: 0.6 + rnd(i + 99) * 1.6, d: rnd(i + 7) * 3,
}));

function StarCluster() {
  return (
    <svg className="cluster" viewBox="0 0 100 100" aria-label="작품 없는 벽 · 별무리로 빈 자리">
      {STARS.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} style={{ animationDelay: s.d + 's' }} />
      ))}
    </svg>
  );
}

export default function Wall() {
  const { ep, go } = useApp();
  const works = ep.gallery || ep.artworks;
  const [i, setI] = useState(0);
  const sx = useRef(0);
  const step = (d) => setI((v) => Math.min(works.length - 1, Math.max(0, v + d)));
  const cur = works[i];

  return (
    <div className="ar">
      <Camera />
      <ArHead left="back" pill={ep.wallName || `담장 갤러리 · ${ep.title}`} />
      <div className="ar-hint">담장 벽이 미술 전시관이 됨</div>
      <div
        className="gallery"
        onPointerDown={(e) => { sx.current = e.clientX; }}
        onPointerUp={(e) => { const d = e.clientX - sx.current; if (Math.abs(d) > 40) step(d < 0 ? 1 : -1); }}
      >
        <div className="rail" style={{ transform: `translateX(calc(${-i} * var(--slot)))` }}>
          {works.map((w, k) => (
            <div key={k} className={'slot' + (k === i ? ' cur' : '')}>
              {w ? (
                <div className="frame"><div className="canvas-ph">{w.title}</div></div>
              ) : (
                <StarCluster />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="walk">→ 담장을 따라 걸으면 다음 작품이 이어져 걸림 · 작품 {i + 1} / {works.length}</div>

      <Peek onOpen={() => go('sheet')}>
        <span className="peek-row">
          <span className="avatar" aria-hidden="true" />
          <span>
            <span className="cap">담장 전시 · 작품 {i + 1}</span>
            <b>{cur ? `${cur.artist} · ${cur.title}` : '비어 있는 자리 · 별무리'}</b>
          </span>
        </span>
        <span>위로 올려서 작가·작품 이야기 보기</span>
      </Peek>
    </div>
  );
}
