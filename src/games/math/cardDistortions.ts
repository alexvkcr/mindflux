export interface DistortionOptions {
  size: "normal" | "half" | "random";
  rotation: "normal" | "horizontal" | "upsideDown" | "horizontalOrUpsideDown" | "random";
  perspective: "none" | "horizontal" | "vertical" | "both" | "random";
}

export interface CardDistortion {
  scale: number;
  angle: number;
  perspectiveX: number;
  perspectiveY: number;
}

export const NO_DISTORTION: CardDistortion = {
  scale: 1, angle: 0, perspectiveX: 0, perspectiveY: 0
};

export function randomCardDistortion(options: DistortionOptions): CardDistortion {
  // (1 - limit) / (1 + limit) = 0.2: up to 80% perspective reduction.
  const limit = 2 / 3;
  let p = options.perspective === "random" ? (Math.random() * 2 - 1) * limit
    : options.perspective === "horizontal" ? limit : options.perspective === "both" ? limit / 2 : 0;
  let q = options.perspective === "random" ? (Math.random() * 2 - 1) * limit
    : options.perspective === "vertical" ? limit : options.perspective === "both" ? limit / 2 : 0;
  const bound = Math.max(1, (Math.abs(p) + Math.abs(q)) / limit);
  p /= bound;
  q /= bound;
  return {
    scale: options.size === "random" ? 0.5 + Math.random() * 0.5 : options.size === "half" ? 0.5 : 1,
    angle: options.rotation === "random" ? Math.random() * 360 - 180
      : options.rotation === "horizontal" ? 90
      : options.rotation === "upsideDown" ? 180
      : options.rotation === "horizontalOrUpsideDown" ? [90, 180, -90][Math.floor(Math.random() * 3)] : 0,
    perspectiveX: p,
    perspectiveY: q
  };
}

export function cardTransform(d: CardDistortion, width: number, height: number, stageW: number, stageH: number) {
  const p = 2 * d.perspectiveX / width;
  const q = 2 * d.perspectiveY / height;
  const radians = d.angle * Math.PI / 180;
  const c = Math.cos(radians);
  const s = Math.sin(radians);
  const corners = [-1, 1].flatMap((xSign) => [-1, 1].map((ySign) => {
    const x = xSign * width / 2;
    const y = ySign * height / 2;
    const divisor = 1 + p * x + q * y;
    return { x: (c * x - s * y) / divisor, y: (s * x + c * y) / divisor };
  }));
  const minX = Math.min(...corners.map((v) => v.x));
  const maxX = Math.max(...corners.map((v) => v.x));
  const minY = Math.min(...corners.map((v) => v.y));
  const maxY = Math.max(...corners.map((v) => v.y));
  // Fit the projected bounds first, then apply the practice scale.
  const scale = Math.min(1, stageW / (maxX - minX), stageH / (maxY - minY)) * d.scale;
  const tx = -(minX + maxX) / 2 * scale;
  const ty = -(minY + maxY) / 2 * scale;
  return `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${d.angle}deg) matrix3d(1,0,0,${p},0,1,0,${q},0,0,1,0,0,0,0,1)`;
}
