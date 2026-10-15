/** CSS px, or px/s for velocities. */
export interface Vector {
  readonly x: number;
  readonly y: number;
}

/** Viewport coordinates, as from `getBoundingClientRect()`. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type Edge = "top" | "right" | "bottom" | "left";
