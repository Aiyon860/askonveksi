"use client";

import { Children, type ReactNode, useEffect, useRef } from "react";

const revealKeyframes: Keyframe[] = [
  {
    opacity: 0,
    transform: "translateY(16px)",
    filter: "blur(4px)",
    clipPath: "inset(0 0 10% 0 round 10px)",
  },
  {
    opacity: 1,
    transform: "translateY(0)",
    filter: "blur(0px)",
    clipPath: "inset(0 0 0% 0 round 0px)",
  },
];

function useLandingReveal(stagger = false, delay = 0) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;

        const targets = stagger ? Array.from(element.children) : [element];
        targets.forEach((target, index) => {
          target.animate(revealKeyframes, {
            duration: stagger ? 560 : 620,
            delay: delay * 1000 + (stagger ? index * 65 : 0),
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "both",
          });
        });
        observer.disconnect();
      },
      { rootMargin: "0px 0px -8% 0px" },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [delay, stagger]);

  return ref;
}

export function LandingReveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useLandingReveal(false, delay);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

export function LandingStagger({ children, className, id }: { children: ReactNode; className?: string; id?: string }) {
  const ref = useLandingReveal(true);

  return (
    <div ref={ref} id={id} className={className}>
      {Children.map(children, (child) => (
        <div className="h-full">{child}</div>
      ))}
    </div>
  );
}
