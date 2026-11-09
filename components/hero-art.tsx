"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

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
      <div className="hero-art-texture">I · E · R · C</div>
      <motion.div className="hero-orb" animate={reduceMotion ? undefined : { y: [0, -12, 0] }} transition={reduceMotion ? undefined : { duration: 8, ease: "easeInOut", repeat: Infinity }}>
        <div className="hero-orb-ring"><div className="hero-orb-core" /></div>
      </motion.div>
      <div className="hero-art-caption"><span className="hero-art-caption-line" />Um novo jeito de se conectar.</div>
      <div className="hero-art-index">01 / 08</div>
    </div>
  );
}
