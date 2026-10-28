"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";

/**
 * Positions a menu with `position: fixed` under an anchor so it is not clipped
 * by ancestor overflow (e.g. a single-scroll sidebar).
 */
export function useAnchoredMenu(open: boolean): {
  anchorRef: RefObject<HTMLDivElement | null>;
  menuStyle: CSSProperties | undefined;
} {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties | undefined>();

  useLayoutEffect(() => {
    if (!open) {
      setMenuStyle(undefined);
      return;
    }

    const update = () => {
      const el = anchorRef.current;
      if (!el) {
        return;
      }
      const rect = el.getBoundingClientRect();
      const gap = 4;
      const maxH = Math.min(window.innerHeight * 0.55, 24 * 16);
      const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
      const spaceAbove = rect.top - gap - 8;
      const placeAbove = spaceBelow < 12 * 16 && spaceAbove > spaceBelow;
      const height = Math.min(maxH, placeAbove ? spaceAbove : spaceBelow);

      setMenuStyle({
        position: "fixed",
        top: placeAbove ? undefined : rect.bottom + gap,
        bottom: placeAbove
          ? window.innerHeight - rect.top + gap
          : undefined,
        left: rect.left,
        width: rect.width,
        maxHeight: Math.max(8 * 16, height),
        zIndex: 5000,
      });
    };

    update();
    window.addEventListener("resize", update);
    // Capture scroll from nested ancestors (sidebar) and the window.
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  return { anchorRef, menuStyle };
}
