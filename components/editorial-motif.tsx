"use client";

import { useEffect, useRef } from "react";

/** Abstract graphic vocabulary; deliberately not Braille or factual imagery. */
export function EditorialMotif({ variant, className = "", animate = false }: {
  variant: string; className?: string; animate?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !animate || !("IntersectionObserver" in window)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    let played = false;
    const sync = () => {
      observer?.disconnect();
      if (preference.matches || document.documentElement.dataset.reduceMotion === "true" ||
          document.documentElement.dataset.highContrast === "true") {
        delete node.dataset.motifMotion;
        return;
      }
      if (played) return;
      observer = new IntersectionObserver(entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        if (preference.matches || document.documentElement.dataset.reduceMotion === "true" ||
            document.documentElement.dataset.highContrast === "true") return;
        played = true;
        node.dataset.motifMotion = "entered";
        observer?.disconnect();
      }, { threshold: .22 });
      observer.observe(node);
    };
    sync();
    preference.addEventListener("change", sync);
    document.addEventListener("ierc-preferences-changed", sync);
    return () => {
      observer?.disconnect();
      preference.removeEventListener("change", sync);
      document.removeEventListener("ierc-preferences-changed", sync);
    };
  }, [animate]);

  const family = ["instituto", "historias"].includes(variant) ? "heritage" :
    ["esportes", "eventos"].includes(variant) ? "orbit" :
    ["atividades", "galeria"].includes(variant) ? "grid" :
    ["noticias", "radar"].includes(variant) ? "signal" : "connection";

  return <div ref={ref} className={`editorial-motif ${className}`} data-motif={family} aria-hidden="true">
    <svg viewBox="0 0 400 320" fill="none" focusable="false" aria-hidden="true">
      <g className="motif-base" stroke="currentColor" strokeWidth="1.5" opacity=".65">
        <path d="M20 20H380V300H20Z" />
        <path d="M20 160H380M200 20V300" strokeDasharray="3 8" />
        <circle cx="200" cy="160" r="136" />
      </g>
      <g className="motif-gesture" stroke="currentColor" strokeWidth="1.8">
        {family === "heritage" && <>
          {[0,1,2,3,4,5].map(i => <path key={i} d={`M${43+i*16} 282V${150-i*9}C${43+i*16} ${35+i*7} ${357-i*16} ${35+i*7} ${357-i*16} ${150-i*9}V282`} />)}
          <circle cx="200" cy="160" r="27" fill="currentColor" stroke="none" />
        </>}
        {family === "orbit" && <>
          {[0,1,2,3,4].map(i => <ellipse key={i} cx="200" cy="160" rx={42+i*31} ry={30+i*23} transform="rotate(-28 200 160)" />)}
          <circle cx="200" cy="160" r="18" fill="currentColor" stroke="none"/>
        </>}
        {family === "grid" && <>
          {[0,1,2,3,4,5,6].map(x => [0,1,2,3,4].map(y => <circle key={`${x}-${y}`} cx={65+x*45} cy={70+y*45} r={x+y===5?12:4} fill={(x+y)%3===0?"currentColor":"none"}/>))}
          <path d="M65 250L335 70M65 70L335 250" />
        </>}
        {family === "signal" && <>
          {[0,1,2,3,4,5].map(i => <path key={i} d={`M32 ${72+i*34}C110 ${72+i*34} 112 ${24+i*43} 200 ${72+i*34}S290 ${120+i*25} 368 ${72+i*34}`} />)}
          <circle cx="200" cy="160" r="12" fill="currentColor" stroke="none"/>
        </>}
        {family === "connection" && <>
          {[0,1,2,3,4].map(i => <g key={i}><circle cx={115+i*42} cy="160" r="68"/><circle cx={115+i*42} cy="160" r="4" fill="currentColor" /></g>)}
        </>}
      </g>
      <g fill="currentColor"><circle cx="20" cy="20" r="4"/><circle cx="380" cy="300" r="4"/></g>
    </svg>
  </div>;
}
