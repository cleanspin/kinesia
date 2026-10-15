import { type RefCallback, useEffect, useState } from "react";
import type { ColliderOptions } from "../../core/collision/collider";
import { useCollider } from "./use-collider";

export interface UseCollisionOptions extends ColliderOptions {
  disabled?: boolean;
}

/** Enter and leave events for one element, including fast crossings between frames. */
export function useCollision<T extends Element = HTMLElement>(
  options: UseCollisionOptions = {},
): RefCallback<T> {
  const collider = useCollider(options);
  const [element, setElement] = useState<T | null>(null);
  const disabled = options.disabled ?? false;

  useEffect(() => {
    if (!element || disabled) return;
    collider.observe(element);
    return () => collider.unobserve(element);
  }, [collider, element, disabled]);

  return setElement;
}
