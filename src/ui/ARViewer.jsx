import { useEffect, useMemo, useRef, useState } from 'react';
import { createARClient } from '../../ar-engine/integration/client.mjs';
import { stopCamera } from './Camera.jsx';

export default function ARViewer({ experience, onClose, onComplete, confirmExhibit = false }) {
  const frame = useRef(null);
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; }, [onClose]);
  const [ready, setReady] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState('');
  const token = useMemo(() => crypto.randomUUID(), []);
  const client = useMemo(() => createARClient({ baseUrl: new URL('/ar/', location.origin).href }), []);
  const url = new URL(client.getLaunchUrl(experience));
  url.searchParams.set('tourHost', '1');
  url.searchParams.set('hostToken', token);
  const title = experience === 'starseed' ? '별의 새싹 · 3D 작품' : '검정 교복 · 4인 AR 공연';

  useEffect(() => {
    stopCamera();
    let alive = true;
    client.getExperience(experience).then(() => { if (alive) setReady(true); })
      .catch(() => { if (alive) setError('AR 콘텐츠를 불러오지 못했어요. 잠시 후 다시 열어 주세요.'); });
    const receive = (event) => {
      const data = event.data;
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (data?.source !== 'byeol-ar' || data.token !== token || data.experience !== experience) return;
      if (data.event === 'closed') close.current();
      if (data.event === 'completed' && ['world', 'webxr', 'image'].includes(data.mode)) setCompleted(true);
    };
    window.addEventListener('message', receive);
    return () => { alive = false; window.removeEventListener('message', receive); };
  }, [client, experience, token]);

  return (
    <section className="tour-ar-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <div className="tour-ar-toolbar"><b>{title}</b><button type="button" onClick={onClose}>닫기</button></div>
      {error ? <p role="alert">{error}</p> : !ready ? <p role="status">AR 콘텐츠 준비 중…</p> : (
        <iframe ref={frame} title={title} src={url.href} allow="camera; microphone; accelerometer; gyroscope; xr-spatial-tracking; fullscreen" allowFullScreen />
      )}
      <div className="tour-ar-actions">
        <a href={client.getLaunchUrl(experience)} target="_blank" rel="noopener noreferrer">전체 화면으로 열기</a>
        {onComplete && <button type="button" className="btn" disabled={!ready || (!confirmExhibit && !completed)} onClick={onComplete}>
          {confirmExhibit ? '전시 확인 · 별 받기' : completed ? '공연 감상 완료 · 별 받기' : '공연을 끝까지 감상해 주세요'}
        </button>}
      </div>
    </section>
  );
}
