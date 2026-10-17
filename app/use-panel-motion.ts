'use client';

import { useCallback, useLayoutEffect, useRef, type PointerEvent } from 'react';

/** Interruptible, critically damped side-sheet motion. The model retains velocity
 * when a drag releases, so direct manipulation and settling share one trajectory. */
export function usePanelMotion(close: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  useLayoutEffect(() => { closeRef.current = close; }, [close]);
  const state = useRef({ x: 0, velocity: 0, target: 0, width: 0, frame: 0, previous: 0, closing: false, reduced: false, dragging: false, origin: 0, start: 0, samples: [] as { x: number; time: number }[] });
  const tick = useRef<(time: number) => void>(() => {});
  const paint = useCallback(() => { if (panel.current) panel.current.style.transform = `translate3d(${state.current.x}px,0,0)`; }, [panel]);
  const settle = useCallback((target: number, closing: boolean) => {
    const s = state.current;
    s.target = target; s.closing = closing; s.dragging = false;
    if (s.reduced) { s.x = target; s.velocity = 0; paint(); if (closing) closeRef.current(); return; }
    if (!s.frame) { s.previous = performance.now(); s.frame = requestAnimationFrame(time => tick.current(time)); }
  }, [paint]);
  useLayoutEffect(() => {
    const s = state.current;
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    s.reduced = preference.matches;
    s.width = (panel.current?.getBoundingClientRect().width || 520) + 24;
    s.x = s.reduced ? 0 : s.width; s.target = 0; s.velocity = 0; s.closing = false;
    paint();
    tick.current = now => {
      s.frame = 0;
      const elapsed = Math.min((now - s.previous) / 1000, .032); s.previous = now;
      const steps = Math.max(1, Math.ceil(elapsed / .008)); const dt = elapsed / steps;
      for (let step = 0; step < steps; step++) {
        s.velocity += (-420 * (s.x - s.target) - 41 * s.velocity) * dt;
        s.x += s.velocity * dt;
      }
      paint();
      if (Math.abs(s.x - s.target) < .35 && Math.abs(s.velocity) < 4) {
        s.x = s.target; s.velocity = 0; paint();
        if (s.closing) closeRef.current();
      } else s.frame = requestAnimationFrame(time => tick.current(time));
    };
    const updatePreference = () => {
      s.reduced = preference.matches;
      if (s.reduced) { cancelAnimationFrame(s.frame); s.frame = 0; s.x = s.target; paint(); if (s.closing) closeRef.current(); }
    };
    preference.addEventListener('change', updatePreference);
    settle(0, false);
    return () => { cancelAnimationFrame(s.frame); s.frame = 0; preference.removeEventListener('change', updatePreference); };
  }, [panel, paint, settle]);
  const dismiss = useCallback(() => settle(state.current.width, true), [settle]);
  const onPointerDown = useCallback((event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const s = state.current; cancelAnimationFrame(s.frame); s.frame = 0;
    s.dragging = true; s.closing = false; s.origin = event.clientX; s.start = s.x; s.velocity = 0;
    s.samples = [{ x: s.x, time: performance.now() }];
    event.currentTarget.setPointerCapture(event.pointerId);
  }, []);
  const onPointerMove = useCallback((event: PointerEvent<HTMLDivElement>) => {
    const s = state.current; if (!s.dragging) return;
    const requested = s.start + event.clientX - s.origin;
    s.x = requested < 0 ? requested * .12 : Math.min(requested, s.width);
    const now = performance.now(); s.samples.push({ x: s.x, time: now }); s.samples = s.samples.filter(sample => now - sample.time < 100);
    paint();
  }, [paint]);
  const release = useCallback((event: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const s = state.current; if (!s.dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const releasedAt = performance.now();
    s.samples = s.samples.filter(sample => releasedAt - sample.time < 100);
    s.samples.push({ x: s.x, time: releasedAt });
    const first = s.samples[0], last = s.samples.at(-1);
    s.velocity = first && last && last.time > first.time ? Math.max(-1600, Math.min(1600, (last.x - first.x) / (last.time - first.time) * 1000)) : 0;
    // Apple's exponential-decay projection, with a short side-sheet deceleration.
    const projected = s.x + (s.velocity / 1000) * .994 / (1 - .994);
    const shouldClose = !cancelled && projected > s.width * .4;
    settle(shouldClose ? s.width : 0, shouldClose);
  }, [settle]);
  return { panel, dismiss, drag: { onPointerDown, onPointerMove, onPointerUp: (event: PointerEvent<HTMLDivElement>) => release(event), onPointerCancel: (event: PointerEvent<HTMLDivElement>) => release(event, true) } };
}
