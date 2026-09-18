export function wrapCarouselIndex(index: number, length: number) {
  return ((index % length) + length) % length;
}

export function getShortestCarouselDelta(currentIndex: number, targetIndex: number, length: number) {
  const forward = wrapCarouselIndex(targetIndex - currentIndex, length);
  return forward > length / 2 ? forward - length : forward;
}
