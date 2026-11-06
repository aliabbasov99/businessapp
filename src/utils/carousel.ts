export function wrapCarouselIndex(position: number, count: number) {
  'worklet';
  return ((position % count) + count) % count;
}

export function carouselOffset(index: number, position: number, count: number) {
  'worklet';
  const offset = wrapCarouselIndex(index - position, count);
  return offset > count / 2 ? offset - count : offset;
}

export function dragCarouselPosition(start: number, translationX: number, step: number) {
  'worklet';
  const origin = Math.round(start);
  const offset = start - translationX / step - origin;
  if (Math.abs(offset) <= 1) return origin + offset;

  // Let the card follow the finger slightly beyond its destination with growing
  // resistance. The curve joins the normal drag smoothly instead of hard-clamping.
  // Stay below the next preview threshold so release still matches the shown list.
  const extra = Math.abs(offset) - 1;
  const allowance = 0.25;
  const stretch = allowance * extra / (allowance + extra);
  return origin + Math.sign(offset) * (1 + stretch);
}

export function previewCarouselPosition(position: number, previous: number) {
  'worklet';
  // Cross the midpoint before changing the list. At the exact midpoint retain
  // the current preview, so left and right drags behave symmetrically.
  return Math.abs(position - previous) > 0.5 ? Math.round(position) : previous;
}
