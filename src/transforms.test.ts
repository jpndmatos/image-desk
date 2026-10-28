import { describe, it, expect } from 'vitest';
import { orientedSize, fitSize, exportFilename } from './image';
describe('batch transforms', () => {
  it('fits a rotated landscape image as a portrait without upscaling', () => {
    const rotated = orientedSize(2400, 1600, 90);
    expect(rotated).toEqual({ width: 1600, height: 2400 });
    expect(fitSize(rotated.width, rotated.height, 600, 600)).toEqual({ width: 400, height: 600 });
    expect(orientedSize(2400, 1600, 180)).toEqual({ width: 2400, height: 1600 });
    expect(() => orientedSize(2400, 1600, 45)).toThrow();
  });
  it('sanitizes a batch prefix while using the actual encoded extension', () => {
    expect(exportFilename('photo.jpeg', 'image/webp', 'event')).toBe('event-photo-web.webp');
    expect(exportFilename('photo.jpeg', 'image/png', '../')).not.toContain('/');
    expect(exportFilename('photo.jpeg', 'image/png', '')).toBe('photo-web.png');
  });
});
