import { useEffect, useLayoutEffect } from "react";

export const useIsomorphicLayoutEffect: typeof useLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
