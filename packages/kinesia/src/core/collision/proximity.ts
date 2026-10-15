// Targets far from the viewport can't be under the pointer, so colliders skip measuring them.
// Unknown targets count as near.
const near = new WeakMap<Element, boolean>();
const watchers = new Map<Element, number>();
let observer: IntersectionObserver | undefined;

function getObserver(): IntersectionObserver | undefined {
  if (!observer && typeof IntersectionObserver === "function") {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) near.set(entry.target, entry.isIntersecting);
      },
      // Within one viewport of the visible area on every side.
      { rootMargin: "100%" },
    );
  }
  return observer;
}

export function watch(element: Element): void {
  const count = watchers.get(element) ?? 0;
  watchers.set(element, count + 1);
  if (count === 0) getObserver()?.observe(element);
}

export function unwatch(element: Element): void {
  const count = watchers.get(element);
  if (count === undefined) return;
  if (count > 1) {
    watchers.set(element, count - 1);
    return;
  }
  watchers.delete(element);
  near.delete(element);
  getObserver()?.unobserve(element);
}

export function isNear(element: Element): boolean {
  return near.get(element) ?? true;
}
