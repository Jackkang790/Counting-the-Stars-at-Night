// 06 내 쿠폰 — 사용 가능 / 사용 완료 / 만료.
// 카페 리더기가 QR 을 찍으면 서버가 사용 처리. QR 이 안 읽히면 바코드, 그것도 안 되면 직원이 12자리 번호 입력.
// 사용 처리는 화면 밖(리더기)에서 일어나므로, 이 화면이 열려 있는 동안 상태를 주기적으로 다시 받아옴.
import { useEffect, useRef } from 'react';
import { useApp } from '../store.jsx';
import { drawQR } from '../lib/qr.js';
import { drawBarcode } from '../lib/barcode.js';
import { usingSample } from '../lib/api.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';

const STATUS = { issued: '사용 가능', redeemed: '사용 완료', expired: '만료' };
const day = (iso) => new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
const time = (iso) => new Date(iso).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const spaced = (code) => code.replace(/(\d{4})(?=\d)/g, '$1 ');

function Coupon({ c }) {
  const qr = useRef(null);
  const bar = useRef(null);
  const live = c.status === 'issued';
  useEffect(() => {
    if (!live) return;
    drawQR(qr.current, c.code); // TODO(서버): QR 내용 형식은 docs/API.md
    drawBarcode(bar.current, c.code);
  }, [c.code, live]);

  return (
    <div className={'coupon' + (live ? '' : ' off')}>
      <div className="row">
        <b>{c.title}</b>
        <span className={'badge ' + c.status}>{STATUS[c.status]}</span>
      </div>
      {live ? (
        <>
          <p className="muted small">카페 리더기에 QR 을 보여 주세요 · {day(c.expires_at)}까지</p>
          <canvas ref={qr} width="200" height="200" className="coupon-qr" />
          <canvas ref={bar} width="320" height="64" className="coupon-bar" />
          <p className="coupon-code" aria-label="쿠폰 번호">{spaced(c.code)}</p>
          <p className="muted small center">QR 이 안 읽히면 바코드, 그래도 안 되면 직원에게 번호를 불러 주세요</p>
        </>
      ) : (
        <p className="muted small">{c.status === 'redeemed' ? `${time(c.redeemed_at)} 사용` : `${day(c.expires_at)} 만료`}</p>
      )}
    </div>
  );
}

export default function Coupons() {
  const { coupons, refresh, go, complete } = useApp();

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <Screen>
      <TopBar back title="내 쿠폰" />
      <StickyAction action={<button type="button" className="btn secondary" onClick={() => go('stores')}>사용 가능 카페 보기</button>}>
        <main>
          {coupons.length ? coupons.map((c) => <Coupon key={c.id} c={c} />) : (
            <div className="notice">{complete ? '쿠폰을 받아오는 중이에요' : '별자리를 완성하면 카페 쿠폰이 발급돼요'}</div>
          )}
          {usingSample && coupons.length > 0 && <p className="muted small">예시 쿠폰이에요 · 서버가 연결되면 실제 쿠폰으로 바뀌어요</p>}
        </main>
      </StickyAction>
    </Screen>
  );
}
