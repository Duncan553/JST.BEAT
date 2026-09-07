'use client';

import { useEffect, useRef, useState } from 'react';

interface RevealProps {
  children: React.ReactNode;
  /** ms to hold before this block starts. Use to cascade sibling blocks. */
  delay?: number;
  className?: string;
}

/**
 * Fades a block up as it scrolls into view — ONCE.
 *
 * Rule 2 of .claude/skills/motion/SKILL.md: re-animating on scroll-back is the
 * single loudest "AI website" tell, so the observer disconnects the moment the
 * element has been seen. No library — IntersectionObserver is ~15 lines and
 * framer-motion is 50KB.
 *
 * `rootMargin: -60px` fires slightly BEFORE the element reaches the fold, so
 * the motion has finished by the time the eye actually lands on it. Firing at
 * 0px makes the reader watch the animation, which reads as slow.
 */
export function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    // No IntersectionObserver (very old browser) → show it immediately rather
    // than leaving the page permanently blank at opacity 0.
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        io.disconnect(); // fires once, then stops costing anything
      },
      { rootMargin: '-60px' }
    );
    io.observe(el);

    // SAFETY NET. The hidden state lives in CSS, so if the observer never
    // delivers a callback the content stays at opacity 0 — an invisible page,
    // which is a far worse failure than a missing animation. That is not
    // hypothetical: Chrome suspends IntersectionObserver entirely in a
    // backgrounded tab, and it was doing exactly that here during testing.
    // After 3s, show regardless. Anything genuinely on screen has been revealed
    // long before this fires, so it never costs a real visitor the animation.
    const failsafe = setTimeout(() => setShown(true), 3000);

    return () => {
      io.disconnect();
      clearTimeout(failsafe);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      data-in={shown}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
