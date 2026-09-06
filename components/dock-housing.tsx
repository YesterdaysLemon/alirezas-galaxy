'use client';

import { useLayoutEffect, useRef } from 'react';

// The 54px button sits at (6,6): both it and this 33px-radius socket share
// exactly (33,33). The small face is centered at (81,44), with a 22px
// cradle around its 16px radius. The pill's 13px end and 19px housing end
// share a center. Every painted bottom is y=60, above one flat y=66 base.
export function dockOutline(width: number) {
  const end = Math.max(150, width) - 19;
  return `M33 0 C50 0 59 8 66 17 C72 22 75 22 81 22 C92 22 94 28 105 28 H${end} A19 19 0 0 1 ${end} 66 H33 A33 33 0 0 1 33 0 Z`;
}

export function DockHousing() {
  const svg = useRef<SVGSVGElement | null>(null);
  const outline = useRef<SVGPathElement | null>(null);
  useLayoutEffect(() => {
    const element = svg.current;
    if (!element) return;
    const fit = () =>
      outline.current?.setAttribute(
        'd',
        dockOutline(element.getBoundingClientRect().width),
      );
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <svg ref={svg} className="dock-chrome" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient
          id="dock-housing-metal"
          x1="0"
          y1="0"
          x2="0"
          y2="66"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7a96a9" />
          <stop offset=".35" stopColor="#3b5571" />
          <stop offset=".53" stopColor="#243d58" />
          <stop offset=".82" stopColor="#29425e" />
          <stop offset="1" stopColor="#536d86" />
        </linearGradient>
      </defs>
      <path ref={outline} d={dockOutline(312)} />
    </svg>
  );
}
