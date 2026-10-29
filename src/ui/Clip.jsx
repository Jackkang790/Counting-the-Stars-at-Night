// 짧은 영상 재생기. src 가 있으면 진짜 영상, 없으면 자리표시 장면을 같은 길이만큼 "재생".
// 본 시간(되감기·건너뛰기 제외)을 세어서 onProgress(비율) 로 알려줌 → 80% 넘으면 별(서버 판정).
// 데모 모드에선 자리표시 장면을 6배 빨리 돌려 시연 시간을 줄임.
import { useEffect, useRef, useState } from 'react';

const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// TODO(작가): 영상이 오면 이 장면은 쓰이지 않음
function Placeholder({ title, t }) {
  const sway = Math.sin(t * 2) * 3;
  return (
    <svg className="clip-ph" viewBox="0 0 320 180" aria-hidden="true">
      <rect width="320" height="180" fill="#1d2547" />
      <circle cx={60 + t * 4 % 200} cy="34" r="2" fill="#fff6d6" />
      <circle cx="250" cy="26" r="1.6" fill="#fff6d6" />
      <ellipse cx="160" cy="158" rx="120" ry="14" fill="#f4c54a" opacity=".18" />
      <g transform={`translate(${120 + sway} 0)`}><circle cx="0" cy="96" r="10" fill="#f4c54a" /><path d="M-15 150q0-38 15-38t15 38z" fill="#f4c54a" /></g>
      <g transform={`translate(${200 - sway} 0)`}><circle cx="0" cy="100" r="9" fill="#e8e1cf" /><path d="M-13 150q0-34 13-34t13 34z" fill="#e8e1cf" /></g>
      <text x="160" y="60" textAnchor="middle" fill="#fff" fontSize="12">{title}</text>
    </svg>
  );
}

export default function Clip({ src, title, duration, fast = false, onProgress, onEnd }) {
  const video = useRef(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const seen = useRef(0);
  const last = useRef(null);

  // 자리표시: 시계로 재생. 시간은 ref 에서 세고 화면에만 setT 로 넘김
  // (state 갱신 함수 안에서 세면 개발 모드에서 두 번 돌아 본 시간이 2배로 잡힘)
  const now = useRef(0);
  useEffect(() => {
    if (src || !playing) return;
    let id;
    let prev = performance.now();
    const loop = (ts) => {
      const dt = ((ts - prev) / 1000) * (fast ? 6 : 1);
      prev = ts;
      now.current = Math.min(duration, now.current + dt);
      seen.current = Math.min(duration, seen.current + dt);
      setT(now.current);
      onProgress?.(seen.current / duration);
      if (now.current >= duration) { setPlaying(false); onEnd?.(); return; }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [src, playing, duration, fast]); // eslint-disable-line react-hooks/exhaustive-deps

  // 진짜 영상: 앞으로 자연스럽게 흐른 시간만 "본 시간"으로 셈(건너뛰기 무시)
  const onTime = () => {
    const v = video.current;
    const d = v.duration || duration;
    if (last.current != null) {
      const step = v.currentTime - last.current;
      if (step > 0 && step < 1.5) seen.current = Math.min(d, seen.current + step);
    }
    last.current = v.currentTime;
    setT(v.currentTime);
    onProgress?.(seen.current / d);
  };

  const toggle = () => {
    if (src) { const v = video.current; v.paused ? v.play() : v.pause(); setPlaying(!v.paused); return; }
    if (t >= duration) { now.current = 0; setT(0); setPlaying(true); return; } // 다시 보기
    setPlaying((p) => !p);
  };

  return (
    <div className="clip">
      {src ? (
        <video ref={video} src={src} playsInline autoPlay onTimeUpdate={onTime} onEnded={() => { setPlaying(false); onEnd?.(); }} />
      ) : (
        <Placeholder title={title} t={t} />
      )}
      <div className="clip-bar">
        <button type="button" className="clip-btn" aria-label={playing ? '일시정지' : '재생'} onClick={toggle}>
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" /><rect x="14" y="5" width="4" height="14" /></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7z" /></svg>
          )}
        </button>
        <span className="clip-track"><i style={{ width: `${(t / duration) * 100}%` }} /></span>
        <span className="clip-time">{fmt(t)} / {fmt(duration)}</span>
      </div>
    </div>
  );
}
