import { describe, it, expect } from 'vitest';
import { fitSize, outputName, bytes } from './image';
describe('image sizing and output', () => {
  it('keeps the aspect ratio inside both limits', () => {
    expect(fitSize(2400, 1600, 1200, 1200)).toEqual({ width: 1200, height: 800 });
    expect(fitSize(1000, 3000, 1600, 1000)).toEqual({ width: 333, height: 1000 });
  });
  it('never enlarges a small image or rounds a narrow dimension to zero', () => {
    expect(fitSize(300, 200, 1600, 1600)).toEqual({ width: 300, height: 200 });
    expect(fitSize(1, 10000, 10, 10)).toEqual({ width: 1, height: 10 });
  });
  it('rejects invalid dimensions', () => {
    expect(() => fitSize(0, 100, 100, 100)).toThrow();
    expect(() => fitSize(100, 100, NaN, 100)).toThrow();
  });
  it('uses the actual encoded format for filenames', () => {
    expect(outputName('photo.jpeg', 'image/png')).toBe('photo-web.png');
    expect(outputName('photo.png', 'image/webp')).toBe('photo-web.webp');
  });
  it('formats honest decimal sizes', () => {
    expect(bytes(1800)).toBe('1.8 KB');
    expect(bytes(2500000)).toBe('2.5 MB');
  });
});
