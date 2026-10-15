import { ZERO } from "../internal/math";
import { invoke } from "../internal/report-error";
import { cancel, schedule } from "../internal/ticker";
import type { Vector } from "../types";

export type PointerKind = "mouse" | "pen" | "touch";

export interface PointerSample {
  readonly x: number;
  readonly y: number;
  /** On the `performance.now()` clock. */
  readonly time: number;
}

export interface PointerState {
  /** `false` before the first event, after leaving the window, and after a touch ends. */
  readonly active: boolean;
  readonly x: number;
  readonly y: number;
  /** In px/s. */
  readonly velocity: Vector;
  readonly speed: number;
  readonly pointerType: PointerKind | null;
  readonly time: number;
}

export interface PointerFrame {
  readonly time: number;
  /** Set only when the previous frame was recent enough to count as continuous. */
  readonly previousTime: number | null;
  /** Starts where the previous frame's path ended and ends at `time`. Empty while inactive. */
  readonly path: readonly PointerSample[];
  readonly state: PointerState;
}

export interface PointerTracker {
  get(): PointerState;
  /** Called in the write phase of frames where the state changed. */
  subscribe(listener: (state: PointerState) => void): () => void;
  /** Called in the read phase of every frame; must not write styles. */
  onFrame(listener: (frame: PointerFrame) => void): () => void;
  requestFrame(): void;
  destroy(): void;
}

export const INITIAL_POINTER_STATE: PointerState = Object.freeze({
  active: false,
  x: 0,
  y: 0,
  velocity: ZERO,
  speed: 0,
  pointerType: null,
  time: 0,
});

const CONTINUITY_WINDOW = 100;
const VELOCITY_MIN_SPAN = 30;
const VELOCITY_MAX_SPAN = 100;
const MAX_PATH_SAMPLES = 64;
// A resting pointer is assumed to start moving one 60fps frame before its first sample.
const START_LEAD = 1000 / 60;

/** Listeners attach lazily, so creating a tracker is safe during server rendering. */
export function createPointerTracker(view?: Window): PointerTracker {
  let state = INITIAL_POINTER_STATE;
  const stateListeners = new Set<(state: PointerState) => void>();
  const frameListeners = new Set<(frame: PointerFrame) => void>();

  let pending: PointerSample[] = [];
  let history: PointerSample[] = [];
  /** Where the last frame's path ended; `null` when the path is broken. */
  let anchor: PointerSample | null = null;
  let lastFrameTime: number | null = null;
  let active = false;
  let pointerId: number | null = null;
  let pointerType: PointerKind | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | undefined;
  let detach: (() => void) | null = null;
  let destroyed = false;

  function attach(): void {
    if (detach || destroyed) return;
    const win = view ?? (typeof window === "undefined" ? undefined : window);
    if (!win) return;

    const options = { capture: true, passive: true } as const;
    const listeners = {
      pointermove: onPointer,
      pointerdown: onPointer,
      pointerup: onPointerUp,
      pointercancel: onPointerCancel,
      pointerout: onPointerOut,
      scroll: onViewportChange,
      resize: onViewportChange,
    };

    for (const [type, listener] of Object.entries(listeners)) {
      win.addEventListener(type, listener as EventListener, options);
    }
    detach = () => {
      for (const [type, listener] of Object.entries(listeners)) {
        win.removeEventListener(type, listener as EventListener, options);
      }
    };
  }

  function onPointer(event: PointerEvent): void {
    if (!event.isPrimary) return;
    if (!active || event.pointerId !== pointerId) breakPath();
    active = true;
    pointerId = event.pointerId;
    pointerType = toPointerKind(event.pointerType);

    // One pointermove per frame; coalesced events hold the positions in between.
    const coalesced = event.type === "pointermove" ? (event.getCoalescedEvents?.() ?? []) : [];
    if (coalesced.length === 0) record(event);
    else for (const sample of coalesced) record(sample);

    requestFrame();
    clearTimeout(idleTimer);
    // Lets velocity settle to zero once the events stop.
    idleTimer = setTimeout(requestFrame, VELOCITY_MAX_SPAN + 1);
  }

  function onPointerUp(event: PointerEvent): void {
    if (event.isPrimary && event.pointerType === "touch") release();
  }

  function onPointerCancel(event: PointerEvent): void {
    if (event.isPrimary) release();
  }

  function onPointerOut(event: PointerEvent): void {
    // No relatedTarget: the pointer left the document (window, iframe, pen out of range).
    if (event.isPrimary && event.relatedTarget === null) release();
  }

  function onViewportChange(): void {
    if (active) requestFrame();
  }

  function record(event: PointerEvent): void {
    const previous = pending[pending.length - 1] ?? anchor;
    const sample = {
      x: event.clientX,
      y: event.clientY,
      time: previous ? Math.max(previous.time, event.timeStamp) : event.timeStamp,
    };
    const latest = history[history.length - 1];
    if (
      anchor &&
      pending.length === 0 &&
      (!latest || sample.time - latest.time > VELOCITY_MAX_SPAN)
    ) {
      // Moving after a rest: seed the anchor so a flick's first frame already has a velocity.
      history = [{ x: anchor.x, y: anchor.y, time: sample.time - START_LEAD }];
    }
    pending.push(sample);
    history.push(sample);
    while (
      history.length > 1 &&
      sample.time - (history[0] as PointerSample).time > VELOCITY_MAX_SPAN
    ) {
      history.shift();
    }
  }

  function release(): void {
    if (!active) return;
    active = false;
    breakPath();
    requestFrame();
  }

  function breakPath(): void {
    anchor = null;
    pending = [];
    history = [];
  }

  function flush(time: number): void {
    const path: PointerSample[] = [];
    if (active) {
      const fresh = thin(pending);
      const first = fresh[0];
      if (anchor) {
        const start = first
          ? Math.min(first.time, Math.max(anchor.time, first.time - START_LEAD))
          : anchor.time;
        path.push({ x: anchor.x, y: anchor.y, time: start });
      }
      path.push(...fresh);
      const last = path[path.length - 1];
      if (last && last.time < time) path.push({ x: last.x, y: last.y, time });
    }
    const moved = pending.length > 0;
    pending = [];

    const end = path[path.length - 1];
    anchor = end ?? null;
    const previousTime =
      lastFrameTime !== null && time - lastFrameTime <= CONTINUITY_WINDOW ? lastFrameTime : null;
    lastFrameTime = time;

    const next = nextState(end, time, moved);
    const changed = next !== state;
    state = next;

    const frame: PointerFrame = { time, previousTime, path, state };
    for (const listener of frameListeners) invoke(listener, frame);
    if (changed) schedule("write", notify);
  }

  function nextState(end: PointerSample | undefined, time: number, moved: boolean): PointerState {
    // Only a resting pointer's velocity goes stale; a late frame still has fresh samples.
    const velocity = end ? estimateVelocity(moved ? null : time) : ZERO;
    const x = end ? end.x : state.x;
    const y = end ? end.y : state.y;
    const isActive = end !== undefined;
    if (
      isActive === state.active &&
      x === state.x &&
      y === state.y &&
      velocity.x === state.velocity.x &&
      velocity.y === state.velocity.y &&
      pointerType === state.pointerType
    ) {
      return state;
    }
    return Object.freeze({
      active: isActive,
      x,
      y,
      velocity,
      speed: Math.hypot(velocity.x, velocity.y),
      pointerType,
      time,
    });
  }

  function estimateVelocity(now: number | null): Vector {
    const newest = history[history.length - 1];
    if (!newest || (now !== null && now - newest.time > VELOCITY_MAX_SPAN)) return ZERO;
    let reference: PointerSample | undefined;
    for (let i = history.length - 2; i >= 0; i--) {
      const sample = history[i] as PointerSample;
      const span = newest.time - sample.time;
      if (span > VELOCITY_MAX_SPAN) break;
      reference = sample;
      if (span >= VELOCITY_MIN_SPAN) break;
    }
    if (!reference) return ZERO;
    const seconds = (newest.time - reference.time) / 1000;
    if (seconds <= 0) return ZERO;
    return { x: (newest.x - reference.x) / seconds, y: (newest.y - reference.y) / seconds };
  }

  function notify(): void {
    for (const listener of stateListeners) invoke(listener, state);
  }

  function requestFrame(): void {
    if (destroyed) return;
    attach();
    schedule("read", flush);
  }

  return {
    get() {
      attach();
      return state;
    },
    subscribe(listener) {
      stateListeners.add(listener);
      attach();
      return () => {
        stateListeners.delete(listener);
      };
    },
    onFrame(listener) {
      frameListeners.add(listener);
      attach();
      return () => {
        frameListeners.delete(listener);
      };
    },
    requestFrame,
    destroy() {
      destroyed = true;
      detach?.();
      detach = null;
      clearTimeout(idleTimer);
      cancel(flush);
      cancel(notify);
      stateListeners.clear();
      frameListeners.clear();
    },
  };
}

let shared: PointerTracker | undefined;

/** Shared by every kinesia tool. */
export function getPointerTracker(): PointerTracker {
  shared ??= createPointerTracker();
  return shared;
}

function toPointerKind(type: string): PointerKind {
  return type === "touch" || type === "pen" ? type : "mouse";
}

function thin(samples: PointerSample[]): PointerSample[] {
  if (samples.length <= MAX_PATH_SAMPLES) return samples;
  const step = (samples.length - 1) / (MAX_PATH_SAMPLES - 1);
  return Array.from(
    { length: MAX_PATH_SAMPLES },
    (_, i) => samples[Math.round(i * step)] as PointerSample,
  );
}
