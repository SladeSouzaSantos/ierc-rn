"use client";

import { useEffect } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function BeyondMotion(){
  useEffect(()=>{
    const root=document.querySelector<HTMLElement>(".beyond-home");
    if(!root)return;
    gsap.registerPlugin(ScrollTrigger);
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    const desktop=window.matchMedia("(min-width: 1024px) and (min-height: 640px)");
    let ctx:gsap.Context|undefined;
    const setup=()=>{
      ctx?.revert();
      ctx=undefined;
      const prefs=document.documentElement.dataset;
      if(reduced.matches||!desktop.matches||prefs.reduceMotion==="true"||prefs.highContrast==="true"||prefs.largeText==="true"){
        root.dataset.storyMotion="static";
        return;
      }
      root.dataset.storyMotion="active";
      ctx=gsap.context(()=>{
        const cover=root.querySelector(".beyond-cover");
        if(!cover)return;
        // The three images converge as the reader approaches the composition.
        // No scroll pinning, no hidden text, no required interaction.
        const tl=gsap.timeline({scrollTrigger:{trigger:cover,start:"top top+=80",end:"bottom top+=120",scrub:.65}});
        tl.fromTo('[data-beyond-layer="left"]',{xPercent:-8,yPercent:8,rotation:-6},{xPercent:7,yPercent:-5,rotation:0,ease:"none"},0)
          .fromTo('[data-beyond-layer="center"]',{scale:.93},{scale:1.08,ease:"none"},0)
          .fromTo('[data-beyond-layer="right"]',{xPercent:8,yPercent:-4,rotation:6},{xPercent:-7,yPercent:8,rotation:0,ease:"none"},0);
        gsap.to(".collage-orbit",{rotation:24,ease:"none",scrollTrigger:{trigger:cover,start:"top top+=80",end:"bottom top",scrub:.7}});
        const sport=root.querySelector(".beyond-sport-photo");
        if(sport)gsap.fromTo(sport.querySelector(".beyond-photo"),{scale:.96},{scale:1.035,ease:"none",scrollTrigger:{trigger:sport,start:"top bottom",end:"bottom top",scrub:.7}});
      },root);
    };
    setup();
    reduced.addEventListener("change",setup);
    desktop.addEventListener("change",setup);
    document.addEventListener("ierc-preferences-changed",setup);
    return()=>{ctx?.revert();reduced.removeEventListener("change",setup);desktop.removeEventListener("change",setup);document.removeEventListener("ierc-preferences-changed",setup);};
  },[]);
  return null;
}
