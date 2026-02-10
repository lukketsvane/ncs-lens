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
  
  let cssHue = 0;
  let d = hue % 360;
  if (d < 0) d += 360;

  if (d <= 90) { 
    const t = d / 90;
    cssHue = 60 - t * 60;
  } else if (d <= 180) {
    const t = (d - 90) / 90;
    cssHue = 360 - t * 120;
  } else if (d <= 270) {
    const t = (d - 180) / 90;
    cssHue = 240 - t * 120;
  } else {
    const t = (d - 270) / 90;
    cssHue = 120 - t * 60;
  }

  const l = Math.max(0, 100 - blackness - (chromaticness * 0.5));
  let s = 0;
  if (chromaticness > 0) {
      s = Math.min(100, chromaticness * 1.5); 
  }

  return `hsl(${cssHue.toFixed(1)}, ${s.toFixed(1)}%, ${l.toFixed(1)}%)`;
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
