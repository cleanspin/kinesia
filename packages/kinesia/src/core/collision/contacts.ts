import { clamp01, lerp } from "../internal/math";
import type { PointerSample } from "../pointer/tracker";
import type { Edge, Rect, Vector } from "../types";
import { type Box, clipSegment, crossedEdge } from "./geometry";

export interface Contact {
  readonly type: "enter" | "leave";
  readonly time: number;
  readonly point: Vector;
  readonly local: Vector;
  readonly edge: Edge | null;
}

export interface ContactQuery {
  /** At least one sample. */
  readonly path: readonly PointerSample[];
  readonly from: Rect;
  readonly to: Rect;
  readonly fromTime: number;
  readonly toTime: number;
  readonly padding: number;
  /** Whether the pointer was inside when the path starts. */
  readonly inside: boolean;
}

export interface ContactResult {
  /** At most one enter, then at most one leave. */
  readonly contacts: Contact[];
  readonly inside: boolean;
}

interface Crossing {
  readonly segment: number;
  readonly t: number;
  readonly edge: Edge | null;
}

/**
 * Tested in the target's frame of reference (samples offset by its interpolated position), so
 * content moving under a still pointer collides like a pointer moving over still content.
 */
export function findContacts(query: ContactQuery): ContactResult {
  const { path, from, to, fromTime, toTime, padding } = query;
  const box: Box = {
    left: -padding,
    top: -padding,
    right: to.width + padding,
    bottom: to.height + padding,
  };
  const span = toTime - fromTime;
  const local = path.map((sample) => {
    const t = span > 0 ? clamp01((sample.time - fromTime) / span) : 1;
    return { x: sample.x - lerp(from.x, to.x, t), y: sample.y - lerp(from.y, to.y, t) };
  });

  const wasInside = query.inside;
  let inside = wasInside;
  let entry: Crossing | null = null;
  let exit: Crossing | null = null;

  const segments = Math.max(1, local.length - 1);
  for (let i = 0; i < segments; i++) {
    const a = local[i] as Vector;
    const b = local[Math.min(i + 1, local.length - 1)] as Vector;
    const clip = clipSegment(a.x, a.y, b.x, b.y, box);

    if (inside && (clip === null || clip.enter > 0)) {
      // Moved out from under the pointer without a measurable crossing.
      exit = { segment: i, t: 0, edge: null };
      inside = false;
    }
    if (clip === null) continue;

    if (!inside) {
      entry ??= {
        segment: i,
        t: clip.enter,
        edge: clip.enterAxis && crossedEdge(clip.enterAxis, delta(a, b, clip.enterAxis), true),
      };
      inside = true;
    }
    if (clip.exit < 1) {
      exit = {
        segment: i,
        t: clip.exit,
        edge: clip.exitAxis && crossedEdge(clip.exitAxis, delta(a, b, clip.exitAxis), false),
      };
      inside = false;
    }
  }

  const contact = (type: Contact["type"], crossing: Crossing): Contact => {
    const i = crossing.segment;
    const j = Math.min(i + 1, path.length - 1);
    const pa = path[i] as PointerSample;
    const pb = path[j] as PointerSample;
    const qa = local[i] as Vector;
    const qb = local[j] as Vector;
    const { t } = crossing;
    return {
      type,
      time: lerp(pa.time, pb.time, t),
      point: { x: lerp(pa.x, pb.x, t), y: lerp(pa.y, pb.y, t) },
      local: { x: lerp(qa.x, qb.x, t), y: lerp(qa.y, qb.y, t) },
      edge: crossing.edge,
    };
  };

  const contacts: Contact[] = [];
  if (!wasInside && entry) contacts.push(contact("enter", entry));
  if (!inside && exit && (wasInside || entry)) contacts.push(contact("leave", exit));
  return { contacts, inside };
}

function delta(a: Vector, b: Vector, axis: "x" | "y"): number {
  return b[axis] - a[axis];
}
