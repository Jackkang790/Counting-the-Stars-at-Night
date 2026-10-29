// 화면 공통 틀 (보호자 앱 components/Screen.tsx 를 그대로 옮김: Screen · TopBar · StickyAction)
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../store.jsx';
import { MenuButton } from './PauseMenu.jsx';

/** 가운데 모바일 프레임. 모든 일반 화면이 씀(카메라 화면은 .ar 로 화면 전체). */
export function Screen({ children, className = '' }) {
  return <div className={'app-shell ' + className}>{children}</div>;
}

/** 얇은 상단바: 왼쪽(뒤로) · 제목 · 오른쪽(right + 메뉴 ☰). 양쪽 칸 폭을 같게 둬서 제목이 항상 가운데. */
export function TopBar({ title, back = false, right = null }) {
  const { back: goBack } = useApp();
  return (
    <header className="top">
      <div className="top-side">
        {back && (
          <button type="button" className="icon-btn" aria-label="뒤로 가기" onClick={goBack}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        )}
      </div>
      <h1 className="top-title">{title}</h1>
      <div className="top-side end">{right}<MenuButton /></div>
    </header>
  );
}

/**
 * 스크롤 영역 + 하단 고정 버튼.
 * - 버튼은 내용 위에 떠 있고, 스크롤 끝에 여백을 둬서 마지막 내용까지 버튼 바로 위로 올릴 수 있음.
 * - 아래에 가려진 내용이 남아 있으면 버튼을 반투명하게 해서 뒤 내용을 확인할 수 있게 함.
 */
export function StickyAction({ children, action, className = '' }) {
  const ref = useRef(null);
  const [dim, setDim] = useState(false);

  function update() {
    const el = ref.current;
    if (!el) return;
    const canScroll = el.scrollHeight - el.clientHeight > 4;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    setDim(canScroll && !atBottom);
  }

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="sticky-wrap">
      <div ref={ref} onScroll={update} className={'sticky-scroll ' + className}>
        {children}
        <div aria-hidden="true" className="sticky-gap" />
      </div>
      <div className={'sticky-action' + (dim ? ' dim' : '')}>{action}</div>
    </div>
  );
}
