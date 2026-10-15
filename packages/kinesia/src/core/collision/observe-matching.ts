import type { Collider } from "./collider";

/** Attribute changes aren't watched; call `sync` when one changes what matches. */
export function observeMatching(
  collider: Collider,
  root: Element,
  selector: string,
): { sync: () => void; stop: () => void } {
  const observed = new Set<Element>();

  function sync(): void {
    const matches = new Set(root.querySelectorAll(selector));
    for (const element of observed) {
      if (matches.has(element)) continue;
      collider.unobserve(element);
      observed.delete(element);
    }
    for (const element of matches) {
      if (observed.has(element)) continue;
      collider.observe(element);
      observed.add(element);
    }
  }

  sync();
  const mutations = new MutationObserver(sync);
  mutations.observe(root, { childList: true, subtree: true });

  return {
    sync,
    stop() {
      mutations.disconnect();
      for (const element of observed) collider.unobserve(element);
      observed.clear();
    },
  };
}
