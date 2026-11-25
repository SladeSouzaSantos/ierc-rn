"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** The tactile paths are decorative, never a substitute for Braille or information. */
export function HeroArt() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop = window.matchMedia("(min-width: 761px)");
    let context: gsap.Context | undefined;
    const sync = () => {
      context?.revert();
      context = undefined;
      const html = document.documentElement.dataset;
      if (media.matches || html.reduceMotion === "true" || html.highContrast === "true" || !desktop.matches) {
        root.dataset.sceneMotion = "static";
        return;
      }
      root.dataset.sceneMotion = "active";
      context = gsap.context(() => {
        // Only decorative layers move. Native scroll, no pinning, no moving text.
        gsap.fromTo(".cover-paths", { yPercent: -5, scale: .94 }, {
          yPercent: 9, scale: 1.08, ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: .5 }
        });
        gsap.fromTo(".cover-art-window", { y: 18 }, {
          y: -18, ease: "none",
          scrollTrigger: { trigger: root, start: "top bottom", end: "bottom top", scrub: .5 }
        });
      }, root);
    };
    sync();
    media.addEventListener("change", sync);
    desktop.addEventListener("change", sync);
    document.addEventListener("ierc-preferences-changed", sync);
    return () => {
      context?.revert();
      media.removeEventListener("change", sync);
      desktop.removeEventListener("change", sync);
      document.removeEventListener("ierc-preferences-changed", sync);
    };
  }, []);

  return (
    <div ref={ref} className="hero-art discovery-art" aria-hidden="true" data-scene-motion="static">
      <svg className="cover-paths" viewBox="0 0 800 520" fill="none" preserveAspectRatio="xMidYMid slice" focusable="false">
        <g stroke="#e6c174" strokeWidth="1.4" opacity=".75">
          {Array.from({ length: 13 }, (_, i) => <path key={i} d={`M${-130+i*27} 580 C${15+i*28} 290 ${-45+i*28} 115 ${250+i*22} 70 S${690+i*10} 165 930 ${-170+i*30}`} />)}
        </g>
        <g fill="#f2c65e">
          {Array.from({ length: 20 }, (_, i) => <circle key={i} cx={35+(i%5)*22} cy={35+Math.floor(i/5)*22} r={i%4===0?3.5:1.7} />)}
          <circle cx="720" cy="445" r="5"/><circle cx="741" cy="445" r="5"/><circle cx="762" cy="445" r="5"/>
        </g>
      </svg>
      <div className="cover-art-window">
        <div className="hero-art-visual">
          <Image src="/illustrations/leitura-tatil.svg" alt="" fill unoptimized priority
            sizes="(max-width: 760px) 100vw, 65vw" className="hero-art-illustration" />
        </div>
      </div>
      <span className="cover-art-caption">O conhecimento também se lê com as mãos.</span>
    </div>
  );
}
