import { type CollisionEvent, useCollisionGroup } from "kinesia";
import { type PointerEvent, useRef } from "react";
import { useReducedMotion } from "../use-reduced-motion";

const TILES = Array.from({ length: 16 * 9 }, (_, i) => i);
// A native pointerover this close to the swept contact means the browser saw the tile too.
const NATIVE_TOLERANCE = 50;

export function ImpactGrid() {
  const reducedMotion = useReducedMotion();
  const seenByBrowser = useRef(new WeakMap<Element, number>());
  const counts = useRef({ hits: 0, missed: 0 });
  const hitsRef = useRef<HTMLElement>(null);
  const missedRef = useRef<HTMLElement>(null);

  // Written to the DOM directly to avoid re-rendering the grid on every hit.
  const renderCounts = () => {
    const { hits, missed } = counts.current;
    if (hitsRef.current) hitsRef.current.textContent = String(hits);
    if (missedRef.current) {
      const share = hits === 0 ? 0 : Math.round((missed / hits) * 100);
      missedRef.current.textContent = `${missed} (${share}%)`;
    }
  };

  const ref = useCollisionGroup<HTMLDivElement>({
    targets: "[data-tile]",
    onEnter(event) {
      const tile = event.target as HTMLElement;
      const seen = seenByBrowser.current.get(tile) ?? Number.NEGATIVE_INFINITY;
      const missedByBrowser = seen < event.timeStamp - NATIVE_TOLERANCE;
      counts.current.hits++;
      if (missedByBrowser) counts.current.missed++;
      renderCounts();
      strike(tile, event, missedByBrowser, reducedMotion);
    },
  });

  const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    const tile = (event.target as Element).closest("[data-tile]");
    if (tile) seenByBrowser.current.set(tile, event.timeStamp);
  };

  const reset = () => {
    counts.current = { hits: 0, missed: 0 };
    renderCounts();
  };

  return (
    <section className="demo" aria-labelledby="impact-title">
      <header className="demo-header">
        <h2 id="impact-title">Swept collisions</h2>
        <p>
          Flick the pointer across the grid as fast as you can. The browser only reports where the
          pointer is once per frame, so its own hover events skip the tiles in between. kinesia
          tests the whole path travelled since the last frame, so every tile you crossed reacts, in
          order and as hard as you hit it.
        </p>
      </header>

      <div ref={ref} className="impact-grid" onPointerOver={onPointerOver}>
        {TILES.map((tile) => (
          <div key={tile} className="tile" data-tile>
            <div className="face">
              <div className="flash" />
            </div>
          </div>
        ))}
      </div>

      <div className="stats">
        <span>
          Tiles hit <strong ref={hitsRef}>0</strong>
        </span>
        <span>
          <i className="swatch swatch-accent" aria-hidden="true" />
          Skipped by native hover <strong ref={missedRef}>0 (0%)</strong>
        </span>
        <span>
          <i className="swatch swatch-native" aria-hidden="true" />
          Seen by both
        </span>
        <button type="button" className="button" onClick={reset}>
          Reset
        </button>
      </div>
    </section>
  );
}

function strike(
  tile: HTMLElement,
  event: CollisionEvent,
  missedByBrowser: boolean,
  reducedMotion: boolean,
): void {
  // Animate the face, not the tile: moving the target would move its hit area.
  const face = tile.firstElementChild as HTMLElement;
  const flash = face.firstElementChild as HTMLElement;
  face.dataset.kind = missedByBrowser ? "swept" : "native";

  // Starts each animation at the moment of contact, so a sweep ripples across in order.
  const delay = -event.elapsed;

  // Holds the colour so the sweep's path stays readable.
  flash.animate(
    [
      { opacity: 1 },
      { opacity: 1, offset: 0.35, easing: "cubic-bezier(0.4, 0, 0.6, 1)" },
      { opacity: 0 },
    ],
    { duration: 2400, delay },
  );
  if (reducedMotion) return;

  const timing = { duration: 700, easing: "cubic-bezier(0.22, 1, 0.36, 1)", delay };

  const intensity = Math.min(1, event.speed / 4000);
  const push = 3 + 12 * intensity;
  const { x, y } = event.direction;
  face.animate(
    [
      { transform: `translate(${x * push}px, ${y * push}px) scale(${1.06 + 0.3 * intensity})` },
      { transform: "none" },
    ],
    timing,
  );
}
