# kinesia

A headless toolkit for React.

kinesia is a growing set of headless tools for React apps. The first one is **swept collision
detection**: enter and leave events that a fast pointer can't skip, each carrying where the
pointer crossed, through which edge, how fast and how long ago.

- Hooks for React 18 and 19, on a framework-agnostic core (`kinesia/core`)
- No dependencies, about 3.6 kB min+gzip with everything
- Headless: no components, no styles, just behaviour and data
- Safe to import during server rendering; the React entry ships with `"use client"`

```sh
npm i kinesia
```

## The problem

Browsers report the pointer's position at most once per frame. Move fast and it jumps tens or
hundreds of pixels between reports, so any element that falls between two of them never gets a
`pointerenter`, never matches `:hover`, and never knows the pointer passed. Physics engines call
this tunneling.

kinesia treats each frame's movement as a path instead of a point. It rebuilds the path from the
pointer samples the browser coalesced since the last frame, tests it against each target's
bounding box, and reports every crossing in the order it happened.

## Quick start

```tsx
import { useCollisionGroup } from "kinesia";

function Grid({ cells }: { cells: string[] }) {
  const ref = useCollisionGroup<HTMLDivElement>({
    targets: "[data-cell]",
    onEnter(event) {
      const face = event.target.firstElementChild as HTMLElement;
      face.animate(
        { transform: ["scale(1.25)", "none"] },
        // Start the animation where it would be had it begun at the moment of contact.
        { duration: 600, easing: "ease-out", delay: -event.elapsed },
      );
    },
  });

  return (
    <div ref={ref} className="grid">
      {cells.map((id) => (
        <div key={id} data-cell>
          <div className="face" />
        </div>
      ))}
    </div>
  );
}
```

Sweep the pointer across the grid as fast as you like: every cell it crossed reacts, in order.

## React API

### `useCollision(options?)`

Detects the pointer entering and leaving one element. Returns a ref callback for it.

```tsx
const ref = useCollision<HTMLButtonElement>({
  onEnter: (event) => console.log(`in through the ${event.edge} at ${event.speed} px/s`),
  onLeave: (event) => console.log(`out through the ${event.edge}`),
});
return <button ref={ref}>Hover me fast</button>;
```

### `useCollisionGroup(options)`

Detects the pointer entering and leaving every descendant of a container that matches
`options.targets`. One collider serves the whole group, which suits grids and lists better than a
hook per item. Elements added or removed later are picked up automatically. Returns a ref callback
for the container; `event.target` says which element was hit.

#### Options

| Option         | Type                                 | Default    | Description                                                                           |
| -------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------- |
| `onEnter`      | `(event: CollisionEvent) => void`    |            | The pointer crossed into a target, including one it passed over within a single frame. |
| `onLeave`      | `(event: CollisionEvent) => void`    |            | The pointer crossed out of a target. Every enter is followed by a leave.               |
| `padding`      | `number`                             | `0`        | Grows each target's hit area by this many CSS pixels on every side.                    |
| `pointerTypes` | `("mouse" \| "pen" \| "touch")[]`    | all        | Pointer types to respond to.                                                           |
| `disabled`     | `boolean`                            | `false`    | Pauses detection.                                                                      |
| `targets`      | `string`                             |            | Group only: CSS selector for the targets.                                             |

Handlers don't need memoizing; the latest ones are always used. They run in the write phase of an
animation frame, after kinesia has measured everything it needs, so they can change styles or
start animations without causing extra layout work.

#### `CollisionEvent`

| Field         | Type                                         | Description                                                                                                  |
| ------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `type`        | `"enter" \| "leave"`                         |                                                                                                              |
| `target`      | `Element`                                    | The element crossed.                                                                                         |
| `edge`        | `"top" \| "right" \| "bottom" \| "left" \| null` | The side crossed. `null` when the target appeared under the pointer, jumped away from it, or the pointer left the page. |
| `point`       | `{ x, y }`                                   | Where the crossing happened, in viewport coordinates.                                                        |
| `local`       | `{ x, y }`                                   | Where it happened, relative to the target's top-left corner.                                                 |
| `rect`        | `{ x, y, width, height }`                    | The target's bounding box this frame.                                                                        |
| `velocity`    | `{ x, y }`                                   | The pointer's velocity relative to the target, in px/s.                                                      |
| `speed`       | `number`                                     | Length of `velocity`.                                                                                        |
| `direction`   | `{ x, y }`                                   | Unit vector of `velocity`, or zero.                                                                          |
| `progress`    | `number`                                     | How far along this frame's path the crossing happened, from 0 to 1.                                         |
| `elapsed`     | `number`                                     | Milliseconds between the crossing and this frame. Use `delay: -elapsed` to sync animations to the contact.  |
| `timeStamp`   | `number`                                     | When the crossing happened, on the `performance.now()` clock.                                               |
| `pointerType` | `"mouse" \| "pen" \| "touch"`                |                                                                                                              |

### `usePointer()`

The primary pointer's state, re-rendering at most once per frame and only when it changed:
`{ active, x, y, velocity, speed, pointerType, time }`. `active` is `false` before the first
pointer event, after a mouse or pen leaves the window and after a touch ends.

### `usePointerListener(listener)`

Calls `listener` with the pointer state in every frame in which it changed, without re-rendering.
Use it for anything that updates styles continuously.

## Core API

Everything above is built on `kinesia/core`, which has no React dependency.

```ts
import { createCollider, observeMatching } from "kinesia/core";

const collider = createCollider({
  onEnter: (event) => event.target.classList.add("hit"),
  onLeave: (event) => event.target.classList.remove("hit"),
});
collider.observe(document.querySelector("#target")!);

// Or keep it in sync with a selector:
const matching = observeMatching(collider, document.body, ".tile");
```

- `createCollider(options)` returns `{ observe, unobserve, disconnect, isInside, setOptions, update }`.
  Call `update()` after a layout change kinesia can't see, such as a CSS animation moving a target
  under a resting pointer.
- `observeMatching(collider, root, selector)` returns `{ sync, stop }`.
- `getPointerTracker()` is the shared tracker: `get()`, `subscribe(listener)` and `onFrame(listener)`,
  which receives each frame's full path during the read phase. `createPointerTracker(window)`
  makes one for another window, such as an iframe's.

## How it works

1. **Path.** The tracker listens to pointer events with passive listeners and keeps every coalesced
   sample since the last frame. Each frame it hands colliders the path from where the previous frame
   ended to where this one did.
2. **Relative movement.** Each target is measured once per frame. Collisions are tested in the
   target's own frame of reference, so content scrolling under a still pointer collides the same
   way as a pointer moving over still content.
3. **Slab test.** Each path segment is clipped against each target's box with the slab method: the
   box is the overlap of a horizontal and a vertical band, and the segment is inside it only while
   it's inside both. The entry and exit fractions give the crossing point, time and edge.
4. **Frame phases.** Every kinesia tool measures in a shared read phase and dispatches in a write
   phase afterwards, so the page lays out at most once per frame no matter how many tools run.

Targets far from the viewport are skipped using an `IntersectionObserver`.

## Good to know

- **Animate a child of the target, not the target itself.** Collisions use the target's bounding
  box, which includes transforms. Scaling or moving the target moves its hit area, which can
  trigger more collisions.
- **Collisions are geometric.** They use bounding boxes and ignore stacking, clipping, occlusion and
  `pointer-events`. Rotated elements collide as their axis-aligned bounding box.
- **Touch** has no hover, so touch collisions happen while a finger drags. For drags across targets,
  set `touch-action: none` on the container, or the browser takes the gesture over for scrolling.
- **The pointer position is learned from events.** kinesia starts listening when first used, so it
  knows where the pointer is from the next pointer event onwards.
- **Unobserving is silent.** No leave event is sent when a target stops being observed or detection
  is disabled.

## Browser support

Current versions of Chrome, Edge, Firefox and Safari. kinesia uses Pointer Events,
`getCoalescedEvents()` where available, `IntersectionObserver` and `MutationObserver`.

## License

MIT
