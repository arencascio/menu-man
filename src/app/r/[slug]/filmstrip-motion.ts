/** Loop coordinates stay stable as either automatic motion or manual gestures cross a seam. */
export function wrapFilmstripOffset(offset: number, width: number) {
  return width > 0 ? ((offset % width) + width) % width : 0;
}
export function advanceFilmstrip(offset: number, velocity: number, seconds: number, width: number, autoWeight: number) {
  const duration = Math.max(0, Math.min(seconds, 0.05));
  return {
    offset: wrapFilmstripOffset(offset + (velocity + 20 * autoWeight) * duration, width),
    velocity: velocity * Math.exp(-duration / 0.45),
  };
}
