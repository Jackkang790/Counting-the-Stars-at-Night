// 쿠폰 바코드(Code 39, 숫자만). 카페 리더기가 QR 을 못 읽을 때 대신 찍는 용도.
// 바 9개(막대·빈칸 번갈아) 중 w = 굵게, n = 가늘게. 글자 사이엔 가는 빈칸 하나. 앞뒤는 '*'.
const P = {
  0: 'nnnwwnwnn', 1: 'wnnwnnnnw', 2: 'nnwwnnnnw', 3: 'wnwwnnnnn', 4: 'nnnwwnnnw',
  5: 'wnnwwnnnn', 6: 'nnwwwnnnn', 7: 'nnnwnnwnw', 8: 'wnnwnnwnn', 9: 'nnwwnnwnn', '*': 'nwnnwnwnn',
};

export function drawBarcode(canvas, digits) {
  const chars = `*${digits}*`.split('');
  const N = 2, W = 5; // 굵기 비율 1:2.5
  const units = chars.reduce((a, c) => a + [...P[c]].reduce((b, e) => b + (e === 'w' ? W : N), 0) + N, 0) - N;
  const quiet = 20;
  const g = canvas.getContext('2d');
  const scale = (canvas.width - quiet * 2) / units;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.fillStyle = '#111';
  let x = quiet;
  for (const c of chars) {
    [...P[c]].forEach((e, i) => {
      const w = (e === 'w' ? W : N) * scale;
      if (i % 2 === 0) g.fillRect(x, 0, w, canvas.height);
      x += w;
    });
    x += N * scale;
  }
}
