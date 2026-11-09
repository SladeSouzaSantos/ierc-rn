"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

export function MotionEnhancements() {
  useEffect(() => {
    let lenis: Lenis | undefined;
    let frame = 0;
    let context: gsap.Context | undefined;
    gsap.registerPlugin(ScrollTrigger);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isReduced = () => media.matches || document.documentElement.dataset.reduceMotion === "true";

    function setup() {
      context?.revert();
      context = undefined;
      lenis?.destroy();
      lenis = undefined;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      if (isReduced()) return;

      // Elementos apenas decorativos: o conteúdo é visível mesmo sem JavaScript.
      context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".decorative-orbit").forEach((element) => {
          gsap.to(element, { yPercent: -12, ease: "none", scrollTrigger: { trigger: element, start: "top bottom", end: "bottom top", scrub: true } });
        });
      });

      if (document.documentElement.dataset.smoothScroll === "true" && window.innerWidth >= 1024) {
        lenis = new Lenis({ autoRaf: false, duration: 1.05, smoothWheel: true });
        const tick = (time: number) => { lenis?.raf(time); frame = requestAnimationFrame(tick); };
        frame = requestAnimationFrame(tick);
      }
    }

    function onResize() { setup(); }
    setup();
    document.addEventListener("ierc-preferences-changed", setup);
    media.addEventListener("change", setup);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("ierc-preferences-changed", setup);
      media.removeEventListener("change", setup);
      window.removeEventListener("resize", onResize);
      if (frame) cancelAnimationFrame(frame);
      lenis?.destroy();
      context?.revert();
    };
  }, []);
  return null;
}
