// 10 내 쿠폰 — 기프티콘 모양: 상품 그림 · 상품명 · QR → 바코드 → 12자리 번호 · 교환처 · 유효기간.
// 카페 리더기가 QR 을 찍으면 서버가 사용 처리. QR 이 안 읽히면 바코드, 그것도 안 되면 직원이 12자리 번호 입력.
// 사용 처리는 화면 밖(리더기)에서 일어나므로, 이 화면이 열려 있는 동안 상태를 주기적으로 다시 받아옴.
import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import { drawQR } from '../lib/qr.js';
import { drawBarcode } from '../lib/barcode.js';
import { CAFES } from '../lib/cafes.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';
import GiftPic from '../ui/GiftPic.jsx';
import { STATUS, dday, ymd } from './CouponBox.jsx';

const time = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const spaced = (code) => code.replace(/(\d{4})(?=\d)/g, '$1 ');

export default function Coupons() {
  const { coupons, refresh, go, screen } = useApp();
  const qr = useRef(null);
  const bar = useRef(null);
  const c = coupons.find((x) => x.id === screen.arg) || coupons.find((x) => x.status === 'issued');
  const live = c?.status === 'issued';

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!c) return;
    drawQR(qr.current, c.code); // TODO(서버): QR 내용 형식은 docs/API.md
    drawBarcode(bar.current, c.code);
  }, [c?.code]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Screen>
      <TopBar back title="내 쿠폰" />
      <StickyAction action={<button type="button" className="btn secondary" onClick={() => go('stores')}>쿠폰 사용 가능 카페 보기</button>}>
        <main>
          {!c && <div className="notice">사용할 쿠폰이 없어요</div>}
          {c && (
            <article className={'gifticon' + (live ? '' : ' off')}>
              <div className="gc-pic">
                <GiftPic />
                {live && c.expires_at && <span className="gift-dday">{dday(c.expires_at)}</span>}
                {!live && <span className="gift-stamp big">{STATUS[c.status]}</span>}
              </div>
              <div className="gc-info">
                <span className="gift-brand">별 헤는 밤 · 원도심 카페</span>
                <b className="gc-name">{c.benefit || c.title}</b>
                {c.benefit && <span className="muted small">{c.title}</span>}
              </div>
              <div className="gc-cut" aria-hidden="true" />
              <div className="gc-code">
                <canvas ref={qr} width="180" height="180" className="gc-qr" />
                <canvas ref={bar} width="320" height="64" className="gc-bar" />
                <p className="gc-num" aria-label="쿠폰 번호">{spaced(c.code)}</p>
                <p className="gc-hint">
                  {live ? '카페 리더기에 QR → 안 읽히면 바코드 → 그래도 안 되면 번호를 불러 주세요'
                    : c.status === 'redeemed' ? `${c.redeemed_at ? time(c.redeemed_at) + ' ' : ''}사용 완료된 쿠폰이에요` : '유효기간이 지난 쿠폰이에요'}
                </p>
              </div>
              <dl className="gc-table">
                <div><dt>교환처</dt><dd>{CAFES.map((x) => x.name).join(' · ')}</dd></div>
                <div><dt>유효기간</dt><dd>{c.expires_at ? `${ymd(c.expires_at)}까지` : '[유효기간]'}</dd></div>
                <div><dt>상태</dt><dd>{STATUS[c.status]}</dd></div>
              </dl>
            </article>
          )}
        </main>
      </StickyAction>
    </Screen>
  );
}
