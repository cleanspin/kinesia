import { useCollisionGroup } from "kinesia";

const ROWS = Array.from({ length: 40 }, (_, i) => i + 1);

export function ScrollList() {
  const ref = useCollisionGroup<HTMLElement>({
    targets: "[data-row]",
    onEnter: (event) => event.target.setAttribute("data-active", ""),
    onLeave: (event) => event.target.removeAttribute("data-active"),
  });

  return (
    <section className="demo" aria-labelledby="scroll-title">
      <header className="demo-header">
        <h2 id="scroll-title">Moving content</h2>
        <p>
          Rest the pointer on a row and scroll with the wheel or keyboard. Collisions are relative,
          so content sliding under a still pointer counts the same as a pointer moving over still
          content, and the highlight follows every frame.
        </p>
      </header>
      <section
        ref={ref}
        className="scroll-list"
        aria-label="Scrollable rows"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable regions must be reachable by keyboard.
        tabIndex={0}
      >
        {ROWS.map((row) => (
          <div key={row} className="row" data-row>
            <span>Row {row}</span>
            <span className="row-meta">#{String(row).padStart(2, "0")}</span>
          </div>
        ))}
      </section>
    </section>
  );
}
