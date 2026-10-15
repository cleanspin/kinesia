import { createPointerTracker, type PointerFrame, type PointerTracker } from "./tracker";

let tracker: PointerTracker;
let frames: PointerFrame[];

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
  tracker = createPointerTracker(window);
  frames = [];
  tracker.onFrame((frame) => frames.push(frame));
});

afterEach(() => {
  tracker.destroy();
  vi.useRealTimers();
});

function pointerEvent(
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
  time = performance.now(),
): PointerEvent {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    ...init,
  });
  Object.defineProperty(event, "timeStamp", { value: time });
  return event;
}

function dispatch(type: string, x: number, y: number, init?: PointerEventInit): void {
  window.dispatchEvent(pointerEvent(type, x, y, init));
}

const frame = () => vi.advanceTimersToNextFrame();
const lastFrame = () => frames[frames.length - 1] as PointerFrame;

describe("createPointerTracker", () => {
  it("delivers the path since the previous frame, ending at the frame's time", () => {
    dispatch("pointermove", 0, 0);
    frame();
    dispatch("pointermove", 40, 10);
    frame();

    const { path, time, previousTime } = lastFrame();
    expect(path[0]).toMatchObject({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 40, y: 10, time });
    expect(previousTime).toBe(frames[0]?.time);
  });

  it("uses coalesced events to fill in the path", () => {
    dispatch("pointermove", 0, 0);
    frame();
    const event = pointerEvent("pointermove", 30, 0);
    const now = performance.now();
    Object.defineProperty(event, "getCoalescedEvents", {
      value: () => [
        pointerEvent("pointermove", 10, 20, {}, now - 8),
        pointerEvent("pointermove", 20, 20, {}, now - 4),
        pointerEvent("pointermove", 30, 0, {}, now),
      ],
    });
    window.dispatchEvent(event);
    frame();

    expect(lastFrame().path.map(({ x, y }) => [x, y])).toEqual([
      [0, 0],
      [10, 20],
      [20, 20],
      [30, 0],
      [30, 0],
    ]);
  });

  it("estimates velocity and settles to zero once the pointer rests", () => {
    for (let x = 0; x <= 64; x += 16) {
      dispatch("pointermove", x, 0);
      frame();
    }
    expect(tracker.get().velocity.x).toBeCloseTo(1000, -1);
    expect(tracker.get().velocity.y).toBe(0);

    vi.advanceTimersByTime(200);
    expect(tracker.get().speed).toBe(0);
  });

  it("has a velocity on the first frame of a flick from rest", () => {
    dispatch("pointermove", 0, 0);
    frame();
    vi.advanceTimersByTime(500);
    dispatch("pointermove", 300, 0);
    frame();
    expect(tracker.get().velocity.x).toBeGreaterThan(1000);
  });

  it("keeps the velocity of moves delivered in a late frame", () => {
    dispatch("pointermove", 0, 0);
    frame();
    vi.advanceTimersByTime(400);
    // Moves from 300ms before the frame that processes them.
    const now = performance.now();
    window.dispatchEvent(pointerEvent("pointermove", 10, 0, {}, now - 300));
    window.dispatchEvent(pointerEvent("pointermove", 20, 0, {}, now - 290));
    frame();
    expect(lastFrame().state.velocity.x).toBeGreaterThan(0);
  });

  it("deactivates when a touch ends and starts a fresh path for the next one", () => {
    dispatch("pointerdown", 10, 10, { pointerType: "touch" });
    frame();
    expect(tracker.get()).toMatchObject({ active: true, pointerType: "touch" });

    dispatch("pointerup", 10, 10, { pointerType: "touch" });
    frame();
    expect(tracker.get().active).toBe(false);
    expect(lastFrame().path).toEqual([]);

    dispatch("pointerdown", 200, 200, { pointerType: "touch", pointerId: 2 });
    frame();
    expect(lastFrame().path[0]).toMatchObject({ x: 200, y: 200 });
  });

  it("ignores secondary pointers", () => {
    dispatch("pointermove", 10, 10);
    frame();
    dispatch("pointermove", 500, 500, { isPrimary: false, pointerId: 7 });
    frame();
    expect(tracker.get()).toMatchObject({ x: 10, y: 10 });
  });

  it("returns the same state object until something changes", () => {
    dispatch("pointermove", 10, 10);
    frame();
    vi.advanceTimersByTime(200);
    const state = tracker.get();
    tracker.requestFrame();
    frame();
    expect(tracker.get()).toBe(state);
  });

  it("notifies subscribers only when the state changes", () => {
    const listener = vi.fn();
    tracker.subscribe(listener);
    dispatch("pointermove", 10, 10);
    frame();
    expect(listener).toHaveBeenCalledTimes(1);

    tracker.requestFrame();
    frame();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
