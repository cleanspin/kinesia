import { usePointer } from "kinesia";

export function PointerHud() {
  const { active, x, y, speed, pointerType } = usePointer();
  return (
    <aside className="hud" aria-label="Pointer state">
      {active ? (
        <>
          <span>
            x <strong>{Math.round(x)}</strong>
          </span>
          <span>
            y <strong>{Math.round(y)}</strong>
          </span>
          <span>
            <strong>{Math.round(speed).toLocaleString()}</strong> px/s
          </span>
          <span>{pointerType}</span>
        </>
      ) : (
        <span>pointer outside</span>
      )}
    </aside>
  );
}
