import { drawStencil, stencilWidth } from "./stencil-glyphs";

export const TITLE_RED = "#f20808"; // Display-P3 reference red, converted to sRGB.
export const TITLE_DURATION = 6;
export type TitleSettings = { eyebrow: string; text: string; wear: number; speed: number; signal: number; size: number };
export const defaultTitleSettings: TitleSettings = { eyebrow: "AND", text: "LILY-ROSE\nDEPP", wear: 0.42, speed: 1, signal: 0.3, size: 1 };

const hash = (n: number) => {
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
};
const noiseTable = Float32Array.from({ length: 16384 }, (_, i) => hash(i + 71231));
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx *= fx * (3 - 2 * fx); fy *= fy * (3 - 2 * fy);
  const at = (dx: number, dy: number) => noiseTable[(((iy + dy) & 127) << 7) + ((ix + dx) & 127)];
  return (at(0, 0) * (1 - fx) + at(1, 0) * fx) * (1 - fy) + (at(0, 1) * (1 - fx) + at(1, 1) * fx) * fy;
}
function surface(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建字幕画布。");
  return { canvas, context };
}

/** Transparent, deterministic title compositor. Same settings + time = same pixels. */
export class DistressedTitleRenderer {
  private context: CanvasRenderingContext2D;
  private mask = surface(1, 1);
  private ink = surface(1, 1);
  private marks = surface(1, 1);
  private erasure = surface(640, 360);
  private flecks = surface(640, 360);
  private erasureData = this.erasure.context.createImageData(640, 360);
  private fleckData = this.flecks.context.createImageData(640, 360);
  private maskKey = "";
  private frameKey = "";

  constructor(private canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法启动字幕预览。");
    this.context = context;
  }

  resize(width: number, height: number) {
    width = Math.max(1, Math.round(width)); height = Math.max(1, Math.round(height));
    if (this.canvas.width === width && this.canvas.height === height && this.mask.canvas.width === width && this.mask.canvas.height === height) return;
    for (const canvas of [this.canvas, this.mask.canvas, this.ink.canvas, this.marks.canvas]) {
      canvas.width = width; canvas.height = height;
    }
    this.maskKey = "";
    this.frameKey = "";
  }

  private buildMask(settings: TitleSettings) {
    const { width, height } = this.canvas;
    const key = JSON.stringify([width, height, settings.text, settings.eyebrow, settings.size]);
    if (key === this.maskKey) return;
    this.maskKey = key;
    const c = this.mask.context;
    c.clearRect(0, 0, width, height);
    c.fillStyle = c.strokeStyle = "#fff";
    const lines = settings.text.split("\n").filter(line => line.trim()).slice(0, 3);
    if (!lines.length && !settings.eyebrow.trim()) return;
    const maxUnits = Math.max(1, ...lines.map(line => stencilWidth(c, line)));
    const eyebrowUnits = Math.max(1, stencilWidth(c, settings.eyebrow));
    const cap = Math.min(height * 0.145 * settings.size, width * 0.88 / maxUnits * 100, height * 0.62 / Math.max(1, lines.length * 1.2 + (settings.eyebrow.trim() ? 0.85 : 0)));
    const gap = cap * 0.23;
    const smallCap = Math.min(cap * 0.6, width * 0.8 / eyebrowUnits * 100);
    const hasEyebrow = Boolean(settings.eyebrow.trim());
    const total = lines.length * cap + Math.max(0, lines.length - 1) * gap + (hasEyebrow ? smallCap + gap : 0);
    let y = (height - total) / 2;
    const line = (text: string, h: number, outline: boolean) => {
      const scale = h / 100;
      c.save();
      c.translate((width - stencilWidth(c, text) * scale) / 2, y);
      c.scale(scale, scale);
      drawStencil(c, text, outline);
      c.restore();
      y += h + gap;
    };
    if (hasEyebrow) line(settings.eyebrow, smallCap, true);
    for (const text of lines) line(text, cap, false);
  }

  render(time: number, settings: TitleSettings) {
    this.buildMask(settings);
    const { width: w, height: h } = this.canvas;
    const scale = w / 1600;
    // A lower cadence gives the texture a photographed, changing film-emulsion feel.
    const t = Math.floor(time * settings.speed * 12 + 0.00001) / 12;
    const frameKey = `${this.maskKey}:${t}:${settings.wear}:${settings.signal}`;
    if (frameKey === this.frameKey) return;
    this.frameKey = frameKey;
    const tick = Math.floor(t * 5);
    const wear = Math.max(0, Math.min(1, settings.wear));
    const c = this.ink.context;
    c.clearRect(0, 0, w, h);
    c.globalCompositeOperation = "source-over";
    c.drawImage(this.mask.canvas, 0, 0);
    c.globalCompositeOperation = "source-in";
    c.fillStyle = TITLE_RED;
    c.fillRect(0, 0, w, h);

    if (wear > 0) {
      const erase = this.erasureData.data, fleck = this.fleckData.data;
      const cutoff = 0.89 - wear * 0.2;
      for (let y = 0; y < 360; y++) {
        for (let x = 0; x < 640; x++) {
          const i = (y * 640 + x) * 4;
          // Drifting, multiscale patches: holes grow, wash across, and recede.
          const broad = noise(x * 0.095 + t * 0.7, y * 0.12 - t * 0.31);
          const fine = noise(x * 0.46 - t * 1.3 + 32, y * 0.51 + t * 0.6);
          const n = broad * 0.68 + fine * 0.32;
          const rub = Math.max(0, Math.min(1, (n - cutoff) * 11));
          erase[i + 3] = rub * 235;
          const white = Math.max(0, (noise(x * 0.17 + 67 - t * 0.8, y * 0.19 + t * 0.5) * 0.56 + fine * 0.44 - (0.9 - wear * 0.15)) * 7);
          fleck[i] = 238; fleck[i + 1] = 230; fleck[i + 2] = 218;
          fleck[i + 3] = Math.min(1, white) * 205;
        }
      }
      this.erasure.context.putImageData(this.erasureData, 0, 0);
      this.flecks.context.putImageData(this.fleckData, 0, 0);
      c.globalCompositeOperation = "destination-out";
      c.drawImage(this.erasure.canvas, 0, 0, w, h);

      const marks = this.marks.context;
      marks.clearRect(0, 0, w, h);
      marks.globalCompositeOperation = "source-over";
      marks.drawImage(this.flecks.canvas, 0, 0, w, h);
      for (let i = 0; i < 70 * wear; i++) {
        const seed = i * 133 + tick * 1091;
        const x = (0.18 + hash(seed + 3) * 0.64) * w;
        const y = h * (0.28 + hash(seed + 11) * 0.44);
        const length = (3 + hash(seed + 17) ** 3 * 48) * scale;
        marks.strokeStyle = i % 3 ? `rgba(9,8,7,${0.2 + hash(seed) * 0.6})` : `rgba(246,238,221,${0.15 + hash(seed) * 0.55})`;
        marks.lineWidth = (0.3 + hash(seed + 5) * 0.65) * scale;
        marks.beginPath(); marks.moveTo(x, y);
        const slope = hash(seed + 23) - 0.5;
        for (let point = 1; point <= 8; point++) {
          marks.lineTo(x + length * point / 8, y + length * slope * point / 8 + (hash(seed + point * 81) - 0.5) * 1.6 * scale);
        }
        marks.stroke();
        // Small chipped emulsion clusters, rather than large digital blocks.
        for (let chip = 0; chip < 28; chip++) {
          const chipSeed = seed + chip * 73;
          const radius = (0.3 + hash(chipSeed + 41) ** 2 * 2.2) * scale;
          const cx = x + (hash(chipSeed + 52) - 0.5) * 36 * scale;
          const cy = y + (hash(chipSeed + 63) - 0.5) * 24 * scale;
          marks.fillStyle = i % 3 ? `rgba(0,0,0,${hash(chipSeed + 74) * 0.7})` : `rgba(249,239,219,${hash(chipSeed + 74) * 0.85})`;
          marks.beginPath(); marks.ellipse(cx, cy, radius, radius * 0.6, slope, 0, Math.PI * 2); marks.fill();
        }
      }
      marks.globalCompositeOperation = "destination-in";
      marks.drawImage(this.mask.canvas, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.drawImage(this.marks.canvas, 0, 0);
    }

    // Scan lines and signal wear remain inside the lettering; the footage stays clean.
    c.globalCompositeOperation = "source-atop";
    c.fillStyle = `rgba(0,0,0,${settings.signal * 0.16})`;
    for (let y = (Math.floor(t * 12) % 3) * scale; y < h; y += Math.max(2, 3.4 * scale)) c.fillRect(0, y, w, Math.max(0.5, scale * 0.65));
    c.globalCompositeOperation = "source-over";

    const out = this.context;
    out.clearRect(0, 0, w, h);
    out.globalAlpha = 1 - settings.signal * 0.035 * hash(tick + 6);
    const roll = (t * 0.21 + 0.13) % 1;
    const bandY = Math.floor(roll * h), bandHeight = Math.max(1, Math.round((2 + hash(tick + 7) * 5) * scale));
    const offset = (hash(tick + 13) - 0.5) * 24 * settings.signal * scale;
    // Slice the source once so displaced scan bands never leave a second ghost copy.
    if (bandY > 0) out.drawImage(this.ink.canvas, 0, 0, w, bandY, 0, 0, w, bandY);
    out.drawImage(this.ink.canvas, 0, bandY, w, Math.min(bandHeight, h - bandY), offset, bandY, w, Math.min(bandHeight, h - bandY));
    const below = bandY + bandHeight;
    if (below < h) out.drawImage(this.ink.canvas, 0, below, w, h - below, 0, below, w, h - below);
    out.globalAlpha = 1;
  }

  dispose() {
    for (const { canvas } of [this.mask, this.ink, this.marks, this.erasure, this.flecks]) { canvas.width = 1; canvas.height = 1; }
  }
}
