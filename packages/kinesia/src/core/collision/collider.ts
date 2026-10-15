import { clamp01, ZERO } from "../internal/math";
import { invoke } from "../internal/report-error";
import { schedule } from "../internal/ticker";
import {
  getPointerTracker,
  type PointerFrame,
  type PointerKind,
  type PointerSample,
  type PointerTracker,
} from "../pointer/tracker";
import type { Edge, Rect, Vector } from "../types";
import { type Contact, findContacts } from "./contacts";

export interface CollisionEvent {
  readonly type: "enter" | "leave";
  readonly target: Element;
  /** Viewport coordinates of the crossing. */
  readonly point: Vector;
  /** The crossing relative to the target's top-left corner. */
  readonly local: Vector;
  readonly rect: Rect;
  /** `null` when the target appeared or vanished under the pointer, or the pointer left the page. */
  readonly edge: Edge | null;
  /** Position of the crossing along this frame's path, from 0 to 1. */
  readonly progress: number;
  /** Ms since the crossing; use as a negative animation delay to start at the moment of contact. */
  readonly elapsed: number;
  readonly timeStamp: number;
  /** Relative to the target, in px/s. */
  readonly velocity: Vector;
  readonly speed: number;
  readonly direction: Vector;
  readonly pointerType: PointerKind;
}

export interface ColliderOptions {
  onEnter?: (event: CollisionEvent) => void;
  /** Every enter is followed by a leave. */
  onLeave?: (event: CollisionEvent) => void;
  /** Extra hit area around each target, in px. */
  padding?: number;
  pointerTypes?: readonly PointerKind[];
}

export interface CreateColliderOptions extends ColliderOptions {
  tracker?: PointerTracker;
}

export interface Collider {
  observe(target: Element): void;
  /** Sends no leave event. */
  unobserve(target: Element): void;
  disconnect(): void;
  isInside(target: Element): boolean;
  setOptions(options: ColliderOptions): void;
  /** Re-tests every target next frame, for layout changes the collider can't see. */
  update(): void;
}

interface TargetRecord {
  rect: Rect | null;
  measuredAt: number | null;
  inside: boolean;
}

const EMPTY_RECT: Rect = Object.freeze({ x: 0, y: 0, width: 0, height: 0 });

/** Tests each frame's whole pointer path against the targets' bounding boxes. */
export function createCollider(options: CreateColliderOptions = {}): Collider {
  const tracker = options.tracker ?? getPointerTracker();
  let current: ColliderOptions = options;
  const targets = new Map<Element, TargetRecord>();
  let unsubscribe: (() => void) | null = null;

  function process(frame: PointerFrame): void {
    const { state, path } = frame;
    const types = current.pointerTypes;
    const engaged =
      state.active &&
      path.length > 0 &&
      (!types || (state.pointerType !== null && types.includes(state.pointerType)));
    const padding = current.padding ?? 0;
    const events: CollisionEvent[] = [];

    for (const [target, record] of targets) {
      if (!engaged || !target.isConnected) {
        if (record.inside) {
          record.inside = false;
          events.push(releaseEvent(target, record.rect ?? EMPTY_RECT, frame));
        }
        record.rect = null;
        record.measuredAt = null;
        continue;
      }

      const rect = target.getBoundingClientRect();
      // Unless it was measured last frame, the target may have jumped here rather than swept.
      const previous =
        record.rect !== null &&
        record.measuredAt !== null &&
        record.measuredAt === frame.previousTime
          ? record.rect
          : null;
      const fromTime = previous ? (record.measuredAt as number) : frame.time;
      const result = findContacts({
        path,
        from: previous ?? rect,
        to: rect,
        fromTime,
        toTime: frame.time,
        padding,
        inside: record.inside,
      });

      if (result.contacts.length > 0) {
        const seconds = (frame.time - fromTime) / 1000;
        const targetVelocity =
          previous && seconds > 0
            ? { x: (rect.x - previous.x) / seconds, y: (rect.y - previous.y) / seconds }
            : ZERO;
        for (const contact of result.contacts) {
          events.push(collisionEvent(target, contact, rect, frame, targetVelocity));
        }
      }
      record.inside = result.inside;
      record.rect = rect;
      record.measuredAt = frame.time;
    }

    if (events.length > 0) {
      events.sort((a, b) => a.timeStamp - b.timeStamp);
      schedule("write", () => dispatch(events));
    }
  }

  function dispatch(events: CollisionEvent[]): void {
    for (const event of events) {
      if (!targets.has(event.target)) continue;
      const handler = event.type === "enter" ? current.onEnter : current.onLeave;
      if (handler) invoke(handler, event);
    }
  }

  function stop(): void {
    unsubscribe?.();
    unsubscribe = null;
  }

  return {
    observe(target) {
      if (targets.has(target)) return;
      targets.set(target, { rect: null, measuredAt: null, inside: false });
      unsubscribe ??= tracker.onFrame(process);
      tracker.requestFrame();
    },
    unobserve(target) {
      if (!targets.delete(target)) return;
      if (targets.size === 0) stop();
    },
    disconnect() {
      targets.clear();
      stop();
    },
    isInside(target) {
      return targets.get(target)?.inside ?? false;
    },
    setOptions(next) {
      current = next;
    },
    update() {
      if (targets.size > 0) tracker.requestFrame();
    },
  };
}

function collisionEvent(
  target: Element,
  contact: Contact,
  rect: Rect,
  frame: PointerFrame,
  targetVelocity: Vector,
): CollisionEvent {
  const { path, state } = frame;
  const start = (path[0] as PointerSample).time;
  const end = (path[path.length - 1] as PointerSample).time;
  const velocity = {
    x: state.velocity.x - targetVelocity.x,
    y: state.velocity.y - targetVelocity.y,
  };
  const speed = Math.hypot(velocity.x, velocity.y);
  return {
    type: contact.type,
    target,
    point: contact.point,
    local: contact.local,
    rect,
    edge: contact.edge,
    progress: end > start ? clamp01((contact.time - start) / (end - start)) : 0,
    elapsed: Math.max(0, frame.time - contact.time),
    timeStamp: contact.time,
    velocity,
    speed,
    direction: speed > 0 ? { x: velocity.x / speed, y: velocity.y / speed } : ZERO,
    pointerType: state.pointerType ?? "mouse",
  };
}

/** A leave with no crossing to locate: the pointer left the page or the target went away. */
function releaseEvent(target: Element, rect: Rect, frame: PointerFrame): CollisionEvent {
  const { state } = frame;
  return {
    type: "leave",
    target,
    point: { x: state.x, y: state.y },
    local: { x: state.x - rect.x, y: state.y - rect.y },
    rect,
    edge: null,
    progress: 0,
    elapsed: 0,
    timeStamp: frame.time,
    velocity: ZERO,
    speed: 0,
    direction: ZERO,
    pointerType: state.pointerType ?? "mouse",
  };
}
