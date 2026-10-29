import roomPhoto from "../../../public/ㅇ/ChatGPT 이미지 2026년 10월 29일 오후 10_06_36.jpg?url";
import panelPhoto from "../../../public/ㅇ/ChatGPT 이미지 2026년 10월 29일 오후 10_06_50.jpg?url";
export { roomPhoto, panelPhoto };

// Photo 2, normalized corners of the approximately planar landscape panel.
// This is a provisional rectification, not a metric survey or an automatic building reconstruction.
export const PANEL_CORNERS = [[0.347, 0.361], [0.843, 0.361], [0.864, 0.866], [0.314, 0.775]] as const;

export function squareToQuad(points: ReadonlyArray<readonly [number, number]>): number[] {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = points;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-10) throw new Error("표적 모서리가 퇴화했습니다.");
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}
export async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = url;
  await image.decode();
  return image;
}
export async function makePanelReference(): Promise<HTMLCanvasElement> {
  const image = await loadImage(panelPhoto);
  const src = document.createElement("canvas"); src.width = image.width; src.height = image.height;
  const context = src.getContext("2d", { willReadFrequently: true })!;
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, src.width, src.height);
  const dst = document.createElement("canvas"); dst.width = 768; dst.height = 620;
  const out = dst.getContext("2d")!; const output = out.createImageData(dst.width, dst.height);
  const m = squareToQuad(PANEL_CORNERS);
  for (let y = 0; y < dst.height; y++) for (let x = 0; x < dst.width; x++) {
    const u = x / (dst.width - 1), v = y / (dst.height - 1), w = m[6] * u + m[7] * v + 1;
    const sx = Math.max(0, Math.min(src.width - 1, Math.round((m[0] * u + m[1] * v + m[2]) / w * src.width)));
    const sy = Math.max(0, Math.min(src.height - 1, Math.round((m[3] * u + m[4] * v + m[5]) / w * src.height)));
    const from = (sy * src.width + sx) * 4, to = (y * dst.width + x) * 4;
    output.data.set(pixels.data.subarray(from, from + 4), to);
  }
  out.putImageData(output, 0, 0);
  return dst;
}
