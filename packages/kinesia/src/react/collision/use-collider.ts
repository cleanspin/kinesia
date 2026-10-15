import { useState } from "react";
import { type Collider, type ColliderOptions, createCollider } from "../../core/collision/collider";
import { useIsomorphicLayoutEffect } from "../internal/use-isomorphic-layout-effect";

export function useCollider(options: ColliderOptions): Collider {
  // Inert until it observes a target, so creating it during render is safe.
  const [collider] = useState(createCollider);
  // Keeps inline handlers current without re-subscribing.
  useIsomorphicLayoutEffect(() => {
    collider.setOptions(options);
  });
  return collider;
}
