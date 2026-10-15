import type { Vector } from "../types";

export const ZERO: Vector = Object.freeze({ x: 0, y: 0 });

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}
