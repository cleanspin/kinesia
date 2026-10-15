import { type RefCallback, useEffect, useState } from "react";
import { observeMatching } from "../../core/collision/observe-matching";
import { useCollider } from "./use-collider";
import type { UseCollisionOptions } from "./use-collision";

export interface UseCollisionGroupOptions extends UseCollisionOptions {
  /** Selector matched against the container's descendants, including ones added later. */
  targets: string;
}

/** Enter and leave events for every matching element in a container, sharing one collider. */
export function useCollisionGroup<T extends Element = HTMLElement>(
  options: UseCollisionGroupOptions,
): RefCallback<T> {
  const collider = useCollider(options);
  const [container, setContainer] = useState<T | null>(null);
  const { targets, disabled = false } = options;

  useEffect(() => {
    if (!container || disabled) return;
    return observeMatching(collider, container, targets).stop;
  }, [collider, container, targets, disabled]);

  return setContainer;
}
