import { ncsToRgb as ncsToRgbLib } from '$lib/ncs-colors';

export interface NCSColor {
  hue: number;
  blackness: number;
  chromaticness: number;
}

export interface Point {
  x: number;
  y: number;
}

export const degreesToNcsHue = (degrees: number): string => {
  let d = degrees % 360;
  if (d < 0) d += 360;

  const percent = Math.round((d % 90) / 90 * 100);
  
  if (d === 0) return 'Y';
  if (d === 90) return 'R';
  if (d === 180) return 'B';
  if (d === 270) return 'G';

  if (d < 90) return `Y${percent}R`;
  if (d < 180) return `R${percent}B`;
  if (d < 270) return `B${percent}G`;
  return `G${percent}Y`;
};

export const ncsToCss = (color: NCSColor): string => {
  const { hue, blackness, chromaticness } = color;
  const hueStr = degreesToNcsHue(hue);
  const isNeutral = hueStr === 'N' || chromaticness === 0;
  const rgb = ncsToRgbLib(blackness, chromaticness, hue, isNeutral);
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
};

export const generateTrianglePoints = () => {
  const points: {s: number, c: number}[] = [];
  const step = 10;
  for (let s = 0; s <= 100; s += step) {
    for (let c = 0; c <= 100; c += step) {
      if (s + c <= 100) {
        points.push({ s, c });
      }
    }
  }
  return points;
};
