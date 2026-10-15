import { createPointerTracker, type PointerTracker } from "../pointer/tracker";
import { type Collider, type CollisionEvent, createCollider } from "./collider";

let tracker: PointerTracker;
let events: CollisionEvent[];
let collider: Collider;

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
  // Trackers listen lazily; start now so earlier moves count.
  tracker.get();
  events = [];
  collider = createCollider({
    tracker,
    onEnter: (event) => events.push(event),
    onLeave: (event) => events.push(event),
  });
});

afterEach(() => {
  collider.disconnect();
  tracker.destroy();
  document.body.replaceChildren();
  vi.useRealTimers();
});

function box(x: number, y: number, width = 50, height = 50) {
  const element = document.createElement("div");
  const handle = { element, rect: { x, y, width, height } };
  element.getBoundingClientRect = () => {
    const { x, y, width, height } = handle.rect;
    return DOMRect.fromRect({ x, y, width, height });
  };
  document.body.append(element);
  collider.observe(element);
  return handle;
}

function pointer(type: string, x: number, y: number, init: PointerEventInit = {}): void {
  const event = new PointerEvent(type, {
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: "mouse",
    isPrimary: true,
    bubbles: true,
    ...init,
  });
  Object.defineProperty(event, "timeStamp", { value: performance.now() });
  window.dispatchEvent(event);
}

const move = (x: number, y: number) => pointer("pointermove", x, y);
const frame = () => vi.advanceTimersToNextFrame();
const summary = () => events.map((event) => [event.type, event.target, event.edge]);

describe("createCollider", () => {
  it("catches every target a fast pointer skips over between frames", () => {
    const [a, b, c] = [box(100, 0), box(200, 0), box(300, 0)];
    move(0, 25);
    frame();
    vi.advanceTimersByTime(8);
    move(400, 25);
    frame();

    expect(summary()).toEqual([
      ["enter", a.element, "left"],
      ["leave", a.element, "right"],
      ["enter", b.element, "left"],
      ["leave", b.element, "right"],
      ["enter", c.element, "left"],
      ["leave", c.element, "right"],
    ]);
    const progress = events.map((event) => event.progress);
    expect(progress).toEqual([...progress].sort((x, y) => x - y));
    expect(progress[0]).toBeGreaterThan(0);
    expect(events[0]?.direction).toEqual({ x: 1, y: 0 });
    expect(events[0]?.speed).toBeGreaterThan(0);
    expect(events[0]?.elapsed).toBeGreaterThan(events[5]?.elapsed ?? Number.POSITIVE_INFINITY);
  });

  it("keeps a target entered while the pointer stays inside", () => {
    const target = box(100, 0);
    move(0, 25);
    frame();
    move(120, 25);
    frame();
    move(130, 30);
    frame();

    expect(summary()).toEqual([["enter", target.element, "left"]]);
    expect(collider.isInside(target.element)).toBe(true);
  });

  it("enters a target that appears under a resting pointer", () => {
    move(125, 25);
    frame();
    const target = box(100, 0);
    frame();

    expect(summary()).toEqual([["enter", target.element, null]]);
  });

  it("detects content scrolling under a still pointer", () => {
    move(125, 100);
    frame();
    const target = box(100, 150);
    frame();
    expect(events).toEqual([]);

    target.rect = { ...target.rect, y: 60 };
    window.dispatchEvent(new Event("scroll"));
    frame();

    expect(summary()).toEqual([["enter", target.element, "top"]]);
    expect(events[0]?.velocity.y).toBeGreaterThan(0);
  });

  it("leaves every target when the pointer leaves the window", () => {
    const target = box(100, 0);
    move(125, 25);
    frame();
    pointer("pointerout", 125, 25, { relatedTarget: null });
    frame();

    expect(summary()).toEqual([
      ["enter", target.element, null],
      ["leave", target.element, null],
    ]);
  });

  it("doesn't sweep from where the pointer left to where it came back", () => {
    const target = box(100, 0);
    move(0, 25);
    frame();
    pointer("pointerout", 0, 25, { relatedTarget: null });
    frame();
    move(300, 25);
    frame();

    expect(collider.isInside(target.element)).toBe(false);
    expect(events).toEqual([]);
  });

  it("ignores pointer types it wasn't asked for", () => {
    collider.setOptions({ pointerTypes: ["touch"], onEnter: (event) => events.push(event) });
    box(100, 0);
    move(0, 25);
    frame();
    move(300, 25);
    frame();

    expect(events).toEqual([]);
  });

  it("stops reporting a target once it's unobserved", () => {
    const target = box(100, 0);
    collider.unobserve(target.element);
    move(0, 25);
    frame();
    move(300, 25);
    frame();

    expect(events).toEqual([]);
  });
});
