import type { Edge } from "../types";

export type Axis = "x" | "y";

export interface Box {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

/** Fractions of the segment, 0 to 1. Axes are `null` when it starts or ends inside. */
export interface SegmentClip {
  readonly enter: number;
  readonly exit: number;
  readonly enterAxis: Axis | null;
  readonly exitAxis: Axis | null;
}

/**
 * Slab method: the segment is inside the box only while it's inside both axis slabs, so it
 * enters at the later slab entry and exits at the earlier slab exit. Edges count as inside.
 */
export function clipSegment(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  box: Box,
): SegmentClip | null {
  let enter = 0;
  let exit = 1;
  let enterAxis: Axis | null = null;
  let exitAxis: Axis | null = null;

  const dx = x1 - x0;
  if (dx === 0) {
    if (x0 < box.left || x0 > box.right) return null;
  } else {
    let near = (box.left - x0) / dx;
    let far = (box.right - x0) / dx;
    if (near > far) [near, far] = [far, near];
    if (near > enter) {
      enter = near;
      enterAxis = "x";
    }
    if (far < exit) {
      exit = far;
      exitAxis = "x";
    }
    if (enter > exit) return null;
  }

  const dy = y1 - y0;
  if (dy === 0) {
    if (y0 < box.top || y0 > box.bottom) return null;
  } else {
    let near = (box.top - y0) / dy;
    let far = (box.bottom - y0) / dy;
    if (near > far) [near, far] = [far, near];
    if (near > enter) {
      enter = near;
      enterAxis = "y";
    }
    if (far < exit) {
      exit = far;
      exitAxis = "y";
    }
    if (enter > exit) return null;
  }

  return { enter, exit, enterAxis, exitAxis };
}

export function crossedEdge(axis: Axis, delta: number, entering: boolean): Edge {
  // Entering while moving forward, or leaving while moving backward, crosses the near edge.
  const near = delta > 0 === entering;
  if (axis === "x") return near ? "left" : "right";
  return near ? "top" : "bottom";
}
