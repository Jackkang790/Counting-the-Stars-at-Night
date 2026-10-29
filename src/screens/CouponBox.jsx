// 09 쿠폰함 — 별자리(별 TOTAL_STAMPS 개) 완성 시 받은 쿠폰을 기프티콘 모양으로 모아 보기 → 골라서 사용(10)
import { useEffect, useState } from 'react';
import { useApp } from '../store.jsx';
import { usingSample } from '../lib/api.js';
import { CAFES } from '../lib/cafes.js';
import { TOTAL_STAMPS } from '../lib/spots.js';
import { Screen, StickyAction, TopBar } from '../ui/Screen.jsx';
import GiftPic from '../ui/GiftPic.jsx';

export const STATUS = { issued: '사용 가능', redeemed: '사용 완료', expired: '기간 만료' };
export const ymd = (iso) => { const d = new Date(iso); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`; };
export const dday = (iso) => { const n = Math.ceil((new Date(iso) - Date.now()) / 864e5); return n > 0 ? `D-${n}` : 'D-DAY'; };

export default function CouponBox() {
  const { coupons, refresh, go, complete } = useApp();
  const live = coupons.filter((c) => c.status === 'issued');
  const [sel, setSel] = useState(null);
  const pick = sel ?? live[0]?.id ?? null;

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <Screen>
      <TopBar back title="쿠폰함" right={<span className="muted">{live.length}장</span>} />
      <StickyAction action={<button type="button" className="btn" disabled={!pick} onClick={() => go('coupons', null, { arg: pick })}>쿠폰 사용하기</button>}>
        <main>
          {coupons.length ? (
            <div className="gift-grid">
              {coupons.map((c, i) => {
                const ok = c.status === 'issued';
                return (
                  <button key={c.id} type="button" className={'gift-tile' + (pick === c.id ? ' on' : '') + (ok ? '' : ' off')} onClick={() => (ok ? setSel(c.id) : go('coupons', null, { arg: c.id }))}>
                    <span className="gift-tile-pic">
                      <GiftPic />
                      {ok && c.expires_at && <span className="gift-dday">{dday(c.expires_at)}</span>}
                      {!ok && <span className="gift-stamp">{STATUS[c.status]}</span>}
                    </span>
                    <span className="gift-tile-body">
                      <span className="gift-brand">원도심 카페 · {coupons.length - i}번째 별자리</span>
                      <b>{c.benefit || c.title}</b>
                      <span className="muted small">{c.expires_at ? `${ymd(c.expires_at)}까지` : STATUS[c.status]}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="notice">{complete ? '쿠폰을 받아오는 중이에요' : `별 ${TOTAL_STAMPS}개를 모으면 카페 쿠폰(기프티콘)이 발급돼요`}</div>
          )}
          <p className="muted small">교환처 · {CAFES.map((c) => c.name).join(' · ')}</p>
          {usingSample && coupons.length > 0 && <p className="muted small">예시 쿠폰이에요 · 서버가 연결되면 실제 쿠폰으로 바뀌어요</p>}
        </main>
      </StickyAction>
    </Screen>
  );
}
