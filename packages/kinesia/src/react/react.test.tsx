import { act, cleanup, render, screen } from "@testing-library/react";
import { getPointerTracker } from "../core/pointer/tracker";
import {
  type CollisionEvent,
  type UseCollisionOptions,
  useCollision,
  useCollisionGroup,
  usePointer,
} from "./index";

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "setTimeout",
      "clearTimeout",
      "performance",
    ],
  });
  // Each [data-x] element is a 50×50 box at that x.
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return DOMRect.fromRect({ x: Number(this.dataset.x ?? -1000), y: 0, width: 50, height: 50 });
  });
  getPointerTracker().get();
});

afterEach(() => {
  cleanup();
  move(-500, -500);
  frame();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function move(x: number, y: number): void {
  const event = new PointerEvent("pointermove", {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
  });
  Object.defineProperty(event, "timeStamp", { value: performance.now() });
  act(() => {
    window.dispatchEvent(event);
  });
}

function frame(): void {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

describe("useCollisionGroup", () => {
  function Row({ cells, onEnter }: { cells: number[]; onEnter: (event: CollisionEvent) => void }) {
    const ref = useCollisionGroup<HTMLDivElement>({ targets: "[data-x]", onEnter });
    return (
      <div ref={ref}>
        {cells.map((x) => (
          <div key={x} data-x={x} />
        ))}
      </div>
    );
  }

  it("reports every matching element the pointer swept across, in order", () => {
    const entered: string[] = [];
    render(
      <Row
        cells={[100, 200, 300]}
        onEnter={(event) => entered.push((event.target as HTMLElement).dataset.x ?? "")}
      />,
    );
    move(0, 25);
    frame();
    vi.advanceTimersByTime(8);
    move(400, 25);
    frame();

    expect(entered).toEqual(["100", "200", "300"]);
  });

  it("picks up elements added later and calls the latest handler", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Row cells={[100]} onEnter={first} />);
    rerender(<Row cells={[100, 200]} onEnter={second} />);
    // MutationObserver reports in a microtask.
    await Promise.resolve();
    move(0, 25);
    frame();
    move(225, 25);
    frame();

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(2);
  });
});

describe("useCollision", () => {
  function Box({ onEnter, onLeave }: Pick<UseCollisionOptions, "onEnter" | "onLeave">) {
    const ref = useCollision<HTMLDivElement>({ onEnter, onLeave });
    return <div ref={ref} data-x={100} />;
  }

  it("sends an enter and a leave", () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    render(<Box onEnter={onEnter} onLeave={onLeave} />);
    move(0, 25);
    frame();
    move(125, 25);
    frame();
    expect(onEnter).toHaveBeenCalledTimes(1);
    expect(onEnter.mock.lastCall?.[0]).toMatchObject({ type: "enter", edge: "left" });

    move(125, 200);
    frame();
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onLeave.mock.lastCall?.[0]).toMatchObject({ type: "leave", edge: "bottom" });
  });

  it("stops after unmounting", () => {
    const onEnter = vi.fn();
    const { unmount } = render(<Box onEnter={onEnter} />);
    unmount();
    move(0, 25);
    frame();
    move(125, 25);
    frame();
    expect(onEnter).not.toHaveBeenCalled();
  });
});

describe("usePointer", () => {
  function Readout() {
    const { x, y, active } = usePointer();
    return <output>{active ? `${x},${y}` : "inactive"}</output>;
  }

  it("re-renders with the pointer position", () => {
    render(<Readout />);
    move(42, 24);
    frame();
    expect(screen.getByRole("status").textContent).toBe("42,24");
  });
});
