// QR 그리기. CDN 로딩 실패해도 앱이 죽지 않게 대체 그림으로 폴백.
let lib = null;

export async function drawQR(canvas, text) {
  try {
    lib ??= (await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm')).default;
    await lib.toCanvas(canvas, text, { margin: 1, width: canvas.width });
  } catch (e) {
    const g = canvas.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, canvas.width, canvas.height);
    g.fillStyle = '#111';
    g.font = `bold ${canvas.width / 5}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('QR', canvas.width / 2, canvas.height / 2);
  }
}
