/**
 * Where the galaxy's two comms cards sit beside their stars. Pure layout, so
 * the frame loop reads the DOM once and positions both cards from numbers.
 */

export type StageInsets = { left: number; right: number; bottom: number };

/** As THREE.MathUtils.clamp: when the range is inverted, `min` wins. */
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

/** The open world's comms casing: its portrait centered on its star, clear of the dock. */
export function detailBounds(options: {
  starX: number;
  starY: number;
  stageWidth: number;
  stageHeight: number;
  panelWidth: number;
  panelHeight: number;
  /** The portrait's center within the panel. */
  anchorX: number;
  anchorY: number;
  compact: boolean;
  insets: StageInsets;
}) {
  const { stageWidth, stageHeight, panelWidth, panelHeight, compact, insets } =
    options;
  const margin = Math.max(compact ? 10 : 14, insets.left);
  // 76 px housing, its safe-area offset, and an 8 px visual gap.
  const bottomClearance = 76 + Math.max(6, insets.bottom) + 8;
  const maxX = Math.max(
    margin,
    stageWidth - panelWidth - Math.max(margin, insets.right),
  );
  const minX = compact ? margin : Math.min(220, maxX);
  const maxY = Math.max(10, stageHeight - panelHeight - bottomClearance);
  const minY = compact ? maxY : Math.min(240, maxY);
  return {
    minX,
    maxX,
    minY,
    maxY,
    x: compact
      ? stageWidth > 720
        ? maxX
        : margin
      : clamp(options.starX - options.anchorX, minX, maxX),
    y: compact ? maxY : clamp(options.starY - options.anchorY, minY, maxY),
  };
}

/** Which side a star's nameplate opens toward, and how wide it may grow. */
export function previewRoom(starX: number, stageWidth: number) {
  const margin = stageWidth <= 720 ? 8 : 14;
  const rightRoom = stageWidth - starX - margin - 19;
  const leftRoom = starX - margin - 19;
  const opensLeft = rightRoom < 150 && leftRoom > rightRoom;
  return {
    margin,
    opensLeft,
    room: Math.floor(
      Math.min(220, Math.max(90, opensLeft ? leftRoom : rightRoom)),
    ),
  };
}

/** The nameplate's position, its circular portrait centered on its star. */
export function previewPosition(options: {
  starX: number;
  starY: number;
  stageWidth: number;
  stageHeight: number;
  width: number;
  height: number;
  margin: number;
  opensLeft: boolean;
}) {
  const { stageWidth, stageHeight, width, height, margin } = options;
  const anchorOffset = options.opensLeft ? width - 31 : 31;
  const maxX = Math.max(margin, stageWidth - width - margin);
  return {
    x: clamp(options.starX - anchorOffset, margin, maxX),
    y: clamp(
      options.starY,
      margin + height / 2,
      stageHeight - margin - height / 2,
    ),
  };
}
