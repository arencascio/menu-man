import type { CSSProperties } from "react";

export type MenuImageFrame = {
  focalPoint?: { x: number; y: number };
  zoom?: number;
};

export type MenuImagePresentation = {
  thumbnail?: MenuImageFrame;
  detail?: MenuImageFrame;
};

export function getMenuImageFrameStyle(frame?: MenuImageFrame): CSSProperties | undefined {
  if (!frame) return undefined;
  const x = Number.isFinite(frame.focalPoint?.x) ? Math.min(1, Math.max(0, frame.focalPoint!.x)) : 0.5;
  const y = Number.isFinite(frame.focalPoint?.y) ? Math.min(1, Math.max(0, frame.focalPoint!.y)) : 0.5;
  const point = `${x * 100}% ${y * 100}%`;
  const zoom = Number.isFinite(frame.zoom) ? Math.min(2, Math.max(1, frame.zoom!)) : 1;
  return {
    objectPosition: point,
    transform: zoom === 1 ? undefined : `scale(${zoom})`,
    transformOrigin: point,
  };
}
