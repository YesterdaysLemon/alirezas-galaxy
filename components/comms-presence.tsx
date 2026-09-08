'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import type { Destination } from '@/data/worlds';
import { WorldComms, WorldPreview } from './world-comms';
import { uiDuration } from '@/lib/ui-motion';
import { watchCommsAssets } from '@/lib/comms-readiness';

type Entry = { world: Destination; serial: number; leaving: boolean };
type Props = {
  world: Destination | null;
  kind: 'preview' | 'detail';
  anchorRef: RefObject<HTMLElement | null>;
  hint?: boolean;
  reducedMotion?: boolean;
  onAction: () => void;
};

// Keep each outgoing DOM node (and its renderer-owned position) until its own
// exit finishes. Unique serials let A -> B -> A overlap without reviving a ghost.
export function CommsPresence(props: Props) {
  const key = props.world?.id ?? null;
  const [state, setState] = useState<{
    key: string | null;
    serial: number;
    entries: Entry[];
  }>({
    key,
    serial: 0,
    entries: props.world
      ? [{ world: props.world, serial: 0, leaving: false }]
      : [],
  });
  if (state.key !== key) {
    const serial = state.serial + 1;
    setState({
      key,
      serial,
      entries: [
        ...state.entries.map((entry) => ({ ...entry, leaving: true })),
        ...(props.world
          ? [{ world: props.world, serial, leaving: false }]
          : []),
      ],
    });
  }
  return state.entries.map((entry) => (
    <PresenceItem
      key={entry.serial}
      {...props}
      entry={entry}
      onFinished={() =>
        setState((current) => ({
          ...current,
          entries: current.entries.filter(
            (item) => item.serial !== entry.serial,
          ),
        }))
      }
    />
  ));
}

function PresenceItem({
  entry,
  kind,
  anchorRef,
  hint,
  reducedMotion,
  onAction,
  onFinished,
}: Props & {
  entry: Entry;
  onFinished: () => void;
}) {
  const root = useRef<HTMLElement | null>(null);
  const [contentReady, setContentReady] = useState(false);
  useLayoutEffect(() => {
    if (!root.current) return;
    return watchCommsAssets(root.current, () => setContentReady(true));
  }, []);
  const finish = useRef(onFinished);
  useLayoutEffect(() => {
    finish.current = onFinished;
  }, [onFinished]);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element) return;
    if (!entry.leaving) {
      anchorRef.current = element;
      return () => {
        if (anchorRef.current === element) anchorRef.current = null;
      };
    }
    if (element.contains(document.activeElement))
      (document.activeElement as HTMLElement).blur();
    const reduced =
      reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targets =
      kind === 'preview'
        ? ([
            ['.world-preview-label', 'rotateY(-85deg) rotateX(55deg)', 0],
            ['.world-preview-address', 'rotateY(-85deg) rotateX(-65deg)', 30],
            ['.preview-orbit-arrival', 'scale(0.08) rotate(-70deg)', 110],
          ] as const)
        : ([
            ['.world-detail-wing', 'rotateY(-80deg) scaleX(0.2)', 0],
            ['.world-replies', 'rotateX(-75deg) scaleY(0.1)', 20],
            ['.comms-coupler', 'scaleY(0)', 40],
            ['.world-orbit', 'scale(0.08) rotate(-60deg)', 110],
            ['.world-close', 'scale(0.1)', 0],
          ] as const);
    const animations = targets.flatMap(([selector, transform, delay]) => {
      const node = element.querySelector<HTMLElement>(selector);
      if (!node) return [];
      const pose = getComputedStyle(node);
      return [
        node.animate(
          [
            { transform: pose.transform, opacity: pose.opacity },
            { transform, opacity: 0 },
          ],
          {
            duration: reduced ? 1 : uiDuration(400),
            delay: reduced ? 0 : uiDuration(delay),
            easing: 'cubic-bezier(.3,0,.2,1)',
            fill: 'both',
          },
        ),
      ];
    });
    let cancelled = false;
    Promise.all(animations.map((animation) => animation.finished))
      .then(() => {
        if (!cancelled) finish.current();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [entry.leaving, anchorRef, kind, reducedMotion]);
  return kind === 'preview' ? (
    <WorldPreview
      world={entry.world}
      previewRef={root as RefObject<HTMLButtonElement | null>}
      hint={hint ?? false}
      contentReady={contentReady}
      leaving={entry.leaving}
      onInspect={onAction}
    />
  ) : (
    <WorldComms
      world={entry.world}
      detailRef={root}
      contentReady={contentReady}
      leaving={entry.leaving}
      onClose={onAction}
    />
  );
}
