const RADIUS = 78;

const ITEM_SIZE = 44;

const WHEEL_SIZE = RADIUS * 2 + ITEM_SIZE;

const START_ANGLE = -Math.PI / 2;

const EDGE_MARGIN = 8;

const getSpoke = (index: number, count: number) => {
  const angle = START_ANGLE + (index / count) * Math.PI * 2;

  return { x: Math.round(Math.cos(angle) * RADIUS), y: Math.round(Math.sin(angle) * RADIUS) };
};

const clampToViewport = (
  origin: Readonly<{ x: number; y: number }>,
  viewport: Readonly<{ height: number; width: number }>,
) => {
  const inset = WHEEL_SIZE / 2 + EDGE_MARGIN;

  return {
    x: Math.min(Math.max(origin.x, inset), Math.max(inset, viewport.width - inset)),
    y: Math.min(Math.max(origin.y, inset), Math.max(inset, viewport.height - inset)),
  };
};

export { clampToViewport, getSpoke, ITEM_SIZE, RADIUS, WHEEL_SIZE };
