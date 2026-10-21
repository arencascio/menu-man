import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { advanceFilmstrip, wrapFilmstripOffset } from '../src/app/r/[slug]/filmstrip-motion';
import '../src/app/r/[slug]/menu-surface-scroll.test';

test('filmstrip wraps in both directions without a discontinuity at the seam', () => {
  assert.equal(wrapFilmstripOffset(1010, 1000), 10);
  assert.equal(wrapFilmstripOffset(-10, 1000), 990);
  assert.equal(wrapFilmstripOffset(20, 0), 0);
});
test('filmstrip auto motion is slow, inertia decays, long frame gaps are bounded', () => {
  const next = advanceFilmstrip(0, 100, 0.02, 1000, 1);
  assert.ok(Math.abs(next.offset - 2.4) < 1e-9);
  assert.ok(next.velocity < 100 && next.velocity > 0);
  assert.equal(advanceFilmstrip(0, 0, 2, 1000, 1).offset, 1);
  assert.equal(advanceFilmstrip(40, 0, 0.05, 1000, 0).offset, 40);
});
test('header reads the preserved scroll position and route changes follow overlay close', () => {
  const source = readFileSync('src/app/r/[slug]/RestaurantNavigation.tsx','utf8');
  assert.ok(source.includes('getMenuPageScrollY() > 80'));
  assert.ok(!source.includes('window.scrollY'));
  assert.ok(source.includes('afterCloseRef.current = () => router.push(item.href)'));
});
test('font family is explicit, font registration is persistent, smooth scroll uses Next opt-in', () => {
  const wordmark = readFileSync('src/app/r/[slug]/RestaurantWordmark.tsx','utf8');
  assert.ok(wordmark.includes('style={fontFamily ? { fontFamily }'));
  const root = readFileSync('src/app/layout.tsx','utf8');
  assert.ok(root.includes('superTacosBrandFont.variable'));
  assert.ok(root.includes('data-scroll-behavior="smooth"'));
});
