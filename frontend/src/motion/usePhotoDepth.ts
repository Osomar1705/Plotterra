import { useEffect, useRef } from 'react';
import { useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { photoPose, scrollDepth, SOFT_SPRING } from './policy';

/** Changes only the picture plane. Text, credits and map coordinates stay still. */
export function usePhotoDepth() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0), scroll = useMotionValue(0);
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const totalY = useTransform([py, scroll], ([a, b]) => Number(a) + Number(b));
  const x = useSpring(px, SOFT_SPRING), y = useSpring(totalY, SOFT_SPRING);
  const rotateX = useSpring(rx, SOFT_SPRING), rotateY = useSpring(ry, SOFT_SPRING);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const region = element.closest<HTMLElement>('.entry-hero, .cmp-hero') ?? element;
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    let inView = false, frame = 0;
    const reset = () => { px.set(0); py.set(0); rx.set(0); ry.set(0); };
    const measure = () => {
      frame = 0;
      if (reduced || !inView || document.hidden) { reset(); scroll.set(0); return; }
      const rect = region.getBoundingClientRect();
      scroll.set(scrollDepth(rect.top + rect.height / 2, window.innerHeight, !pointer.matches));
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(measure); };
    const move = (event: PointerEvent) => {
      if (reduced || !inView || !pointer.matches || event.pointerType !== 'mouse') return;
      const rect = region.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const pose = photoPose((event.clientX - rect.left) / rect.width * 2 - 1, (event.clientY - rect.top) / rect.height * 2 - 1);
      px.set(pose.x); py.set(pose.y); rx.set(pose.rotateX); ry.set(pose.rotateY);
    };
    const preference = () => { reset(); schedule(); };
    const observer = new IntersectionObserver(entries => {
      inView = entries[0]?.isIntersecting ?? false;
      if (!inView) reset();
      schedule();
    });
    observer.observe(region);
    region.addEventListener('pointermove', move, { passive: true });
    region.addEventListener('pointerleave', reset);
    region.addEventListener('pointercancel', reset);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    document.addEventListener('visibilitychange', preference);
    pointer.addEventListener('change', preference);
    if (reduced) {
      reset(); scroll.set(0);
      x.jump(0); y.jump(0); rotateX.jump(0); rotateY.jump(0);
    }
    return () => {
      observer.disconnect(); cancelAnimationFrame(frame);
      region.removeEventListener('pointermove', move);
      region.removeEventListener('pointerleave', reset);
      region.removeEventListener('pointercancel', reset);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', preference);
      pointer.removeEventListener('change', preference);
    };
  }, [reduced, px, py, scroll, rx, ry, x, y, rotateX, rotateY]);
  return { ref, reduced, x, y, rotateX, rotateY };
}
