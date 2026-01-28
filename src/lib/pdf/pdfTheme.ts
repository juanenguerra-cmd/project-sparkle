export type Rgb = [number, number, number];

const parseHslTriplet = (raw: string): [number, number, number] | null => {
  // Supports: "38 92% 50%" | "38 92% 50% / 0.5" | "38, 92%, 50%"
  const cleaned = raw.split('/')[0].trim().replace(/,/g, ' ');
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length < 3) return null;

  const h = Number(parts[0]);
  const s = Number(parts[1].replace('%', ''));
  const l = Number(parts[2].replace('%', ''));
  if ([h, s, l].some((n) => Number.isNaN(n))) return null;
  return [h, s, l];
};

// HSL (0-360, 0-100, 0-100) → RGB (0-255)
const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (hh < 60) [r1, g1, b1] = [c, x, 0];
  else if (hh < 120) [r1, g1, b1] = [x, c, 0];
  else if (hh < 180) [r1, g1, b1] = [0, c, x];
  else if (hh < 240) [r1, g1, b1] = [0, x, c];
  else if (hh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];

  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  return [r, g, b];
};

export const getThemeRgb = (cssVar: string, fallback: Rgb): Rgb => {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  const triplet = parseHslTriplet(raw);
  if (!triplet) return fallback;
  return hslToRgb(triplet[0], triplet[1], triplet[2]);
};
