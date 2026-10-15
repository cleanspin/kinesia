import { type CollisionEvent, useCollision } from "kinesia";
import { useRef, useState } from "react";
import { useReducedMotion } from "../use-reduced-motion";

export function ContactCards() {
  return (
    <section className="demo" aria-labelledby="contact-title">
      <header className="demo-header">
        <h2 id="contact-title">Contact data</h2>
        <p>
          Every enter and leave says where the pointer crossed, which edge it came through, how fast
          it was going and how long ago, so effects can start from the exact point of impact.
        </p>
      </header>
      <div className="cards">
        <ContactCard label="Alpha" />
        <ContactCard label="Beta" />
        <ContactCard label="Gamma" />
      </div>
    </section>
  );
}

function ContactCard({ label }: { label: string }) {
  const reducedMotion = useReducedMotion();
  const [last, setLast] = useState<CollisionEvent | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const ref = useCollision<HTMLDivElement>({
    onEnter(event) {
      setLast(event);
      if (surfaceRef.current) ripple(surfaceRef.current, event, reducedMotion);
    },
    onLeave: setLast,
  });

  return (
    <div ref={ref} className="card" data-type={last?.type} data-edge={last?.edge ?? undefined}>
      <div ref={surfaceRef} className="card-surface">
        <span className="card-label">{label}</span>
        <dl className="readout">
          <Field term="event" value={last?.type} />
          <Field term="edge" value={last ? (last.edge ?? "none") : undefined} />
          <Field term="speed" value={last && `${Math.round(last.speed).toLocaleString()} px/s`} />
          <Field
            term="point"
            value={last && `${Math.round(last.local.x)}, ${Math.round(last.local.y)}`}
          />
          <Field term="elapsed" value={last && `${last.elapsed.toFixed(1)} ms`} />
        </dl>
      </div>
    </div>
  );
}

function Field({ term, value }: { term: string; value: string | null | undefined }) {
  return (
    <div>
      <dt>{term}</dt>
      <dd>{value ?? "–"}</dd>
    </div>
  );
}

function ripple(surface: HTMLElement, event: CollisionEvent, reducedMotion: boolean): void {
  const dot = document.createElement("span");
  dot.className = "ripple";
  dot.style.left = `${event.local.x}px`;
  dot.style.top = `${event.local.y}px`;
  surface.append(dot);

  const reach = 1.5 + Math.min(event.speed, 4000) / 1600;
  const animation = dot.animate(
    reducedMotion
      ? { opacity: [0.35, 0] }
      : {
          transform: ["translate(-50%, -50%) scale(0)", `translate(-50%, -50%) scale(${reach})`],
          opacity: [0.45, 0],
        },
    { duration: 900, easing: "cubic-bezier(0.22, 1, 0.36, 1)", delay: -event.elapsed },
  );
  animation.onfinish = () => dot.remove();
}
