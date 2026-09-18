"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

import styles from "./scroll-reveal.module.css";

export interface ScrollRevealProps {
  children: ReactNode;
  scrollContainerRef?: RefObject<HTMLElement | null>;
  enableBlur?: boolean;
  baseOpacity?: number;
  baseRotation?: number;
  blurStrength?: number;
  containerClassName?: string;
  textClassName?: string;
  rotationEnd?: string;
  wordAnimationEnd?: string;
  splitBy?: "words" | "characters";
}

function getTextContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement<{ children?: ReactNode }>(node)) return "";

  return Children.toArray(node.props.children).map(getTextContent).join("");
}

function revealText(node: ReactNode, keyPrefix: string, splitBy: "words" | "characters"): ReactNode {
  if (typeof node === "string") {
    const parts = splitBy === "characters" ? Array.from(node) : node.split(/(\s+)/);

    return parts.map((part, index) =>
      /^\s+$/.test(part) ? (
        part
      ) : (
        <span aria-hidden="true" className={styles.word} data-scroll-reveal-word key={`${keyPrefix}-${index}`}>
          {part}
        </span>
      ),
    );
  }

  if (!isValidElement<{ children?: ReactNode }>(node)) return node;

  return cloneElement(
    node,
    { key: keyPrefix },
    Children.map(node.props.children, (child, index) => revealText(child, `${keyPrefix}-${index}`, splitBy)),
  );
}

export default function ScrollReveal({
  children,
  scrollContainerRef,
  enableBlur = true,
  baseOpacity = 0.1,
  baseRotation = 3,
  blurStrength = 4,
  containerClassName = "",
  textClassName = "",
  rotationEnd = "bottom bottom",
  wordAnimationEnd = "bottom bottom",
  splitBy = "words",
}: ScrollRevealProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const text = useMemo(() => getTextContent(children).trim(), [children]);

  const content = useMemo(() => revealText(children, "word", splitBy), [children, splitBy]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add("(prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        const scroller = scrollContainerRef?.current ?? window;
        const words = Array.from(element.querySelectorAll<HTMLElement>("[data-scroll-reveal-word]"));

        if (baseRotation !== 0) {
          gsap.fromTo(
            element,
            { rotate: baseRotation, transformOrigin: "0% 50%" },
            {
              rotate: 0,
              ease: "none",
              scrollTrigger: {
                trigger: element,
                scroller,
                start: "top bottom",
                end: rotationEnd,
                scrub: true,
                invalidateOnRefresh: true,
              },
            },
          );
        }

        if (words.length > 0) {
          gsap.to(words, {
              opacity: 1,
              filter: "blur(0px)",
              stagger: 0.05,
              ease: "none",
              scrollTrigger: {
                trigger: element,
                scroller,
                start: "top 88%",
                end: wordAnimationEnd,
                scrub: 0.8,
                invalidateOnRefresh: true,
                onToggle: ({ isActive }) => {
                  gsap.set(words, { willChange: isActive ? "opacity, filter" : "auto" });
                },
              },
            });
        }
      }, element);

      return () => context.revert();
    });

    return () => media.revert();
  }, [baseOpacity, baseRotation, blurStrength, enableBlur, rotationEnd, scrollContainerRef, splitBy, wordAnimationEnd]);

  return (
    <div
      ref={containerRef}
      className={[styles.scrollReveal, containerClassName].filter(Boolean).join(" ")}
      style={
        {
          "--scroll-reveal-opacity": baseOpacity,
          "--scroll-reveal-blur": enableBlur ? `${blurStrength}px` : "0px",
        } as CSSProperties
      }
    >
      <p
        aria-label={text || undefined}
        className={[styles.text, textClassName].filter(Boolean).join(" ")}
      >
        {content}
      </p>
    </div>
  );
}
