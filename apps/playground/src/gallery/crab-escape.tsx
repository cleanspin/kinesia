import { type CollisionEvent, useCollision } from "kinesia";
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../use-reduced-motion";

type Edge = NonNullable<CollisionEvent["edge"]>;

interface Point {
  x: number;
  y: number;
}

interface Breach {
  id: number;
  edge: Edge;
  /** Distance along the edge from its top or left end. */
  at: number;
  /** Below 1 the wall is only cracked. */
  damage: number;
  cracks: string[];
}

interface Crab {
  x: number;
  y: number;
  heading: number;
  mode: "wander" | "escape" | "free" | "gone";
  route: Point[];
  life: number;
}

const W = 300;
const H = 190;
const WALL = 6;
const CRAB_COUNT = 6;
const CRAB_RADIUS = 9;
const MIN_X = WALL + CRAB_RADIUS;
const MAX_X = W - WALL - CRAB_RADIUS;
const MIN_Y = WALL + CRAB_RADIUS;
const MAX_Y = H - WALL - CRAB_RADIUS;
const WANDER_SPEED = 32;
const ESCAPE_SPEED = 95;
const NOTICE_RATE = 0.8;
const FADE_SECONDS = 1.2;
const RESET_DELAY_MS = 2500;
const CRAB_SLOTS = Array.from({ length: CRAB_COUNT }, (_, i) => i);
const EDGES: Edge[] = ["top", "right", "bottom", "left"];
const INWARD: Record<Edge, Point> = {
  top: { x: 0, y: 1 },
  right: { x: -1, y: 0 },
  bottom: { x: 0, y: -1 },
  left: { x: 1, y: 0 },
};

let nextBreachId = 0;

export function CrabEscape() {
  const reducedMotion = useReducedMotion();
  const [breaches, setBreaches] = useState<Breach[]>([]);
  const breachesRef = useRef(breaches);
  const crabsRef = useRef(Array.from({ length: CRAB_COUNT }, spawnCrab));
  const crabEls = useRef<(HTMLSpanElement | null)[]>([]);
  const escapedRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    breachesRef.current = breaches;
  }, [breaches]);

  const ref = useCollision<HTMLDivElement>({
    onEnter(event) {
      if (!event.edge) return;
      const edge = event.edge;
      const along = edge === "top" || edge === "bottom" ? event.local.x : event.local.y;
      const at = clamp(along, WALL * 2, edgeLength(edge) - WALL * 2);
      const impact = 0.4 + Math.min(event.speed, 3000) / 2500;
      const cracks = Array.from({ length: 1 + Math.round(impact * 2) }, () => crack(edge, at));

      setBreaches((current) => {
        const hit = current.find(
          (b) => b.edge === edge && Math.abs(b.at - at) < Math.max(holeWidth(b) / 2, 10) + 8,
        );
        if (!hit) return [...current, { id: nextBreachId++, edge, at, damage: impact, cracks }];
        return current.map((b) =>
          b === hit ? { ...b, damage: b.damage + impact, cracks: [...b.cracks, ...cracks] } : b,
        );
      });
      if (!reducedMotion) debris(event.target, wallPoint(edge, at), INWARD[edge], event.elapsed);
    },
  });

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    let escapedShown = -1;
    let resetTimer: ReturnType<typeof setTimeout> | undefined;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const holes = breachesRef.current.filter((b) => holeWidth(b) > 0);
      const crabs = crabsRef.current;

      crabs.forEach((crab, i) => {
        step(crab, dt, holes);
        const el = crabEls.current[i];
        if (!el) return;
        // Rotating by the heading keeps them walking sideways.
        const wobble = Math.sin(now / 70 + i * 2) * 0.18;
        el.style.opacity = String(crab.life);
        el.style.transform = `translate(${crab.x - CRAB_RADIUS}px, ${crab.y - CRAB_RADIUS}px) rotate(${crab.heading + wobble}rad)`;
      });

      const escaped = crabs.filter((c) => c.mode === "free" || c.mode === "gone").length;
      if (escaped !== escapedShown && escapedRef.current) {
        escapedShown = escaped;
        escapedRef.current.textContent = `${escaped}/${CRAB_COUNT} escaped`;
      }

      if (resetTimer === undefined && crabs.every((c) => c.mode === "gone")) {
        resetTimer = setTimeout(() => {
          resetTimer = undefined;
          setBreaches([]);
          crabsRef.current = Array.from({ length: CRAB_COUNT }, spawnCrab);
        }, RESET_DELAY_MS);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resetTimer);
    };
  }, []);

  return (
    <article className="gallery-card">
      <div className="crab-stage" aria-hidden="true">
        <div ref={ref} className="crab-box">
          <svg className="crab-walls" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            {breaches.flatMap((b) => b.cracks.map((d) => <path key={d} className="crack" d={d} />))}
            {EDGES.flatMap((edge) =>
              wallSegments(edge, breaches).map(([from, to]) => {
                const a = wallPoint(edge, from);
                const b = wallPoint(edge, to);
                return (
                  <line
                    key={`${edge}-${from}`}
                    className="wall"
                    data-edge={edge}
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                );
              }),
            )}
          </svg>
          {CRAB_SLOTS.map((slot) => (
            <span
              key={slot}
              ref={(el) => {
                crabEls.current[slot] = el;
              }}
              className="crab"
            >
              🦀
            </span>
          ))}
        </div>
      </div>
      <footer className="gallery-caption">
        <div>
          <h3>Crab escape</h3>
          <p>
            Hit the box from outside. The wall cracks exactly where you crossed it, even on a flick
            that jumps clean over the wall between frames. Hit hard enough and the crabs run for it.
          </p>
        </div>
        <span ref={escapedRef} className="gallery-meta">
          0/{CRAB_COUNT} escaped
        </span>
      </footer>
    </article>
  );
}

function step(crab: Crab, dt: number, holes: Breach[]): void {
  switch (crab.mode) {
    case "wander": {
      crab.life = Math.min(1, crab.life + dt * 2.5);
      crab.heading += (Math.random() - 0.5) * 6 * dt;
      crab.x += Math.cos(crab.heading) * WANDER_SPEED * dt;
      crab.y += Math.sin(crab.heading) * WANDER_SPEED * dt;
      if (crab.x < MIN_X || crab.x > MAX_X) {
        crab.heading = Math.PI - crab.heading;
        crab.x = clamp(crab.x, MIN_X, MAX_X);
      }
      if (crab.y < MIN_Y || crab.y > MAX_Y) {
        crab.heading = -crab.heading;
        crab.y = clamp(crab.y, MIN_Y, MAX_Y);
      }
      if (holes.length > 0 && Math.random() < NOTICE_RATE * dt) {
        crab.mode = "escape";
        crab.route = escapeRoute(nearestHole(holes, crab));
      }
      return;
    }
    case "escape": {
      const target = crab.route[0];
      if (!target) {
        crab.mode = "free";
        crab.heading += (Math.random() - 0.5) * 1.2;
        return;
      }
      const dx = target.x - crab.x;
      const dy = target.y - crab.y;
      const distance = Math.hypot(dx, dy);
      const travel = ESCAPE_SPEED * dt;
      crab.heading = Math.atan2(dy, dx);
      if (distance <= travel) {
        crab.x = target.x;
        crab.y = target.y;
        crab.route.shift();
      } else {
        crab.x += (dx / distance) * travel;
        crab.y += (dy / distance) * travel;
      }
      return;
    }
    case "free":
      crab.x += Math.cos(crab.heading) * ESCAPE_SPEED * dt;
      crab.y += Math.sin(crab.heading) * ESCAPE_SPEED * dt;
      crab.life -= dt / FADE_SECONDS;
      if (crab.life <= 0) {
        crab.life = 0;
        crab.mode = "gone";
      }
      return;
    case "gone":
      return;
  }
}

function spawnCrab(): Crab {
  return {
    x: MIN_X + Math.random() * (MAX_X - MIN_X),
    y: MIN_Y + Math.random() * (MAX_Y - MIN_Y),
    heading: Math.random() * Math.PI * 2,
    mode: "wander",
    route: [],
    life: 0,
  };
}

function nearestHole(holes: Breach[], crab: Crab): Breach {
  let nearest = holes[0] as Breach;
  let best = Number.POSITIVE_INFINITY;
  for (const hole of holes) {
    const point = wallPoint(hole.edge, hole.at);
    const distance = Math.hypot(point.x - crab.x, point.y - crab.y);
    if (distance < best) {
      best = distance;
      nearest = hole;
    }
  }
  return nearest;
}

/** Up to just inside the hole, then straight out through it. */
function escapeRoute(hole: Breach): Point[] {
  const point = wallPoint(hole.edge, hole.at);
  const n = INWARD[hole.edge];
  const inside = WALL / 2 + CRAB_RADIUS + 2;
  const outside = CRAB_RADIUS + 24;
  return [
    { x: point.x + n.x * inside, y: point.y + n.y * inside },
    { x: point.x - n.x * outside, y: point.y - n.y * outside },
  ];
}

/** Open once damage reaches 1, wide enough for a crab, and wider with every hit. */
function holeWidth(breach: Breach): number {
  return breach.damage < 1 ? 0 : Math.min(64, 2 * CRAB_RADIUS + 4 + (breach.damage - 1) * 24);
}

function wallSegments(edge: Edge, breaches: Breach[]): [number, number][] {
  const holes = breaches
    .filter((b) => b.edge === edge && holeWidth(b) > 0)
    .map((b) => [b.at - holeWidth(b) / 2, b.at + holeWidth(b) / 2] as const)
    .sort((a, b) => a[0] - b[0]);
  const segments: [number, number][] = [];
  let start = 0;
  for (const [from, to] of holes) {
    if (from > start) segments.push([start, from]);
    start = Math.max(start, to);
  }
  if (start < edgeLength(edge)) segments.push([start, edgeLength(edge)]);
  return segments;
}

/** On the wall's centre line. */
function wallPoint(edge: Edge, at: number): Point {
  switch (edge) {
    case "top":
      return { x: at, y: WALL / 2 };
    case "bottom":
      return { x: at, y: H - WALL / 2 };
    case "left":
      return { x: WALL / 2, y: at };
    case "right":
      return { x: W - WALL / 2, y: at };
  }
}

function edgeLength(edge: Edge): number {
  return edge === "top" || edge === "bottom" ? W : H;
}

function crack(edge: Edge, at: number): string {
  const start = wallPoint(edge, at);
  const n = INWARD[edge];
  let angle = Math.atan2(n.y, n.x) + (Math.random() - 0.5) * 2.2;
  let { x, y } = start;
  let d = `M${x.toFixed(1)} ${y.toFixed(1)}`;
  for (let i = 0; i < 3; i++) {
    angle += (Math.random() - 0.5) * 1.2;
    const length = 5 + Math.random() * 9;
    x += Math.cos(angle) * length;
    y += Math.sin(angle) * length;
    d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
  }
  return d;
}

function debris(box: Element, at: Point, inward: Point, elapsed: number): void {
  for (let i = 0; i < 7; i++) {
    const bit = document.createElement("span");
    bit.className = "debris";
    box.append(bit);
    const angle = Math.atan2(inward.y, inward.x) + (Math.random() - 0.5) * 1.8;
    const distance = 14 + Math.random() * 28;
    const end = { x: at.x + Math.cos(angle) * distance, y: at.y + Math.sin(angle) * distance + 8 };
    bit.animate(
      {
        transform: [
          `translate(${at.x - 2}px, ${at.y - 2}px) rotate(0deg)`,
          `translate(${end.x - 2}px, ${end.y - 2}px) rotate(${Math.random() * 360}deg)`,
        ],
        opacity: [1, 0],
      },
      {
        duration: 500 + Math.random() * 300,
        easing: "cubic-bezier(0.2, 0.8, 0.3, 1)",
        delay: -elapsed,
      },
    ).onfinish = () => bit.remove();
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
