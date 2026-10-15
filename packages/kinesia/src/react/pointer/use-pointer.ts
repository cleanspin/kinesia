import { useEffect, useRef, useSyncExternalStore } from "react";
import {
  getPointerTracker,
  INITIAL_POINTER_STATE,
  type PointerState,
} from "../../core/pointer/tracker";
import { useIsomorphicLayoutEffect } from "../internal/use-isomorphic-layout-effect";

const subscribe = (onChange: () => void) => getPointerTracker().subscribe(onChange);
const getSnapshot = () => getPointerTracker().get();
const getServerSnapshot = () => INITIAL_POINTER_STATE;

/** Re-renders at most once per frame. For per-frame style updates use `usePointerListener`. */
export function usePointer(): PointerState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Called each frame the pointer state changed, without re-rendering. */
export function usePointerListener(listener: (state: PointerState) => void): void {
  const latest = useRef(listener);
  useIsomorphicLayoutEffect(() => {
    latest.current = listener;
  });
  useEffect(() => getPointerTracker().subscribe((state) => latest.current(state)), []);
}
