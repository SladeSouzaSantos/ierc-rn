"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * Arte exclusivamente editorial. O h1, a introdução e os links adjacentes
 * carregam a informação essencial para leitores de tela.
 */
export function HeroArt() {
  const systemReducedMotion = useReducedMotion();
  const [userReducedMotion, setUserReducedMotion] = useState(false);

  useEffect(() => {
    const sync = () => setUserReducedMotion(document.documentElement.dataset.reduceMotion === "true");
    sync();
    document.addEventListener("ierc-preferences-changed", sync);
    return () => document.removeEventListener("ierc-preferences-changed", sync);
  }, []);

  const reduceMotion = systemReducedMotion || userReducedMotion;

  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-grid" />
      <span className="hero-art-texture">I · E · R · C</span>
      <motion.div
        className="hero-art-visual"
        animate={reduceMotion ? { y: 0 } : { y: [0, -7, 0] }}
        transition={reduceMotion ? { duration: 0 } : { duration: 9, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image
          src="/illustrations/leitura-tatil.svg"
          alt=""
          fill
          unoptimized
          priority
          sizes="(max-width: 760px) 90vw, (max-width: 1200px) 45vw, 560px"
          className="hero-art-illustration"
        />
      </motion.div>
      <div className="hero-art-caption"><span className="hero-art-caption-line" />Leitura tátil, autonomia e novos caminhos.</div>
      <span className="hero-art-index">01 / 08</span>
    </div>
  );
}
