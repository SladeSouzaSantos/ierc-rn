"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";

/**
 * Cena exclusivamente decorativa: quadra estática, bola independente
 * e ecos visuais emitidos nos impactos. Nenhum áudio é produzido.
 */
export function GoalballScene() {
  const rootRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLSpanElement>(null);
  const echo1Ref = useRef<HTMLSpanElement>(null);
  const echo2Ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const ball = ballRef.current;
    const shadow = shadowRef.current;
    const echoes = [echo1Ref.current, echo2Ref.current].filter(
      (node): node is HTMLSpanElement => node !== null,
    );
    if (!root || !ball || !shadow || echoes.length !== 2) return;

    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timeline: gsap.core.Timeline | undefined;
    let sceneVisible = false;

    const reset = () => {
      timeline?.kill();
      timeline = undefined;
      gsap.killTweensOf([ball, shadow, ...echoes]);
      gsap.set(ball, { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 });
      gsap.set(shadow, { scale: 1, opacity: 0.35 });
      gsap.set(echoes, { scale: 0.55, opacity: 0 });
    };

    const updateAnimation = () => {
      reset();
      const reduced = preference.matches || document.documentElement.dataset.reduceMotion === "true";
      root.dataset.motion = reduced ? "reduced" : "active";
      if (reduced) return;

      const rise = Math.max(24, Math.min(root.clientHeight * 0.16, 78));
      // O impacto coincide com o início das ondas, sem reprodução sonora.
      const animation = gsap.timeline({
        repeat: -1,
        repeatDelay: 0.85,
        paused: true,
      });
      animation
        .to(ball, { y: -rise, x: -7, rotation: -10, duration: 0.55, ease: "power2.out" })
        .to(shadow, { scale: 0.76, opacity: 0.16, duration: 0.55, ease: "power2.out" }, "<")
        .to(ball, { y: 0, x: 0, rotation: 0, duration: 0.48, ease: "power2.in" })
        .to(shadow, { scale: 1, opacity: 0.35, duration: 0.48, ease: "power2.in" }, "<")
        .addLabel("impacto")
        .to(ball, { scaleX: 1.12, scaleY: 0.86, duration: 0.085, ease: "power1.out" }, "impacto")
        .fromTo(echoes[0], { scale: 0.56, opacity: 0.82 }, { scale: 1.8, opacity: 0, duration: 0.7, ease: "power2.out" }, "impacto")
        .fromTo(echoes[1], { scale: 0.56, opacity: 0.65 }, { scale: 2.3, opacity: 0, duration: 0.83, ease: "power2.out" }, "impacto+=0.11")
        .to(ball, { scaleX: 1, scaleY: 1, duration: 0.2, ease: "back.out(2)" }, "impacto+=0.085")
        .to(ball, { y: -rise * 0.28, duration: 0.25, ease: "power2.out" }, "impacto+=0.16")
        .to(ball, { y: 0, duration: 0.29, ease: "power2.in" }, ">")
        .to(ball, { scaleX: 1.035, scaleY: 0.96, duration: 0.07 }, ">")
        .to(ball, { scaleX: 1, scaleY: 1, duration: 0.18, ease: "power2.out" }, ">");

      timeline = animation;
      if (sceneVisible && !document.hidden) animation.play();
    };

    const observer = new IntersectionObserver(
      (entries) => {
        sceneVisible = entries.some((entry) => entry.isIntersecting);
        if (sceneVisible && !document.hidden) timeline?.play();
        else timeline?.pause();
      },
      { threshold: 0.08 },
    );

    const onVisibility = () => {
      if (document.hidden) timeline?.pause();
      else if (sceneVisible) timeline?.play();
    };
    const onResize = () => updateAnimation();

    observer.observe(root);
    updateAnimation();
    const resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(root);
    document.addEventListener("ierc-preferences-changed", updateAnimation);
    document.addEventListener("visibilitychange", onVisibility);
    preference.addEventListener("change", updateAnimation);

    return () => {
      observer.disconnect();
      resizeObserver.disconnect();
      document.removeEventListener("ierc-preferences-changed", updateAnimation);
      document.removeEventListener("visibilitychange", onVisibility);
      preference.removeEventListener("change", updateAnimation);
      reset();
    };
  }, []);

  return (
    <div ref={rootRef} className="sport-art goalball-scene" aria-hidden="true" data-motion="static">
      <div className="sport-art-visual">
        <Image
          src="/illustrations/goalball-quadra.svg"
          alt=""
          fill
          unoptimized
          sizes="(max-width: 760px) 90vw, (max-width: 1200px) 45vw, 560px"
          className="sport-art-illustration"
        />
      </div>
      <span ref={shadowRef} className="goalball-shadow" />
      <span ref={echo1Ref} className="goalball-echo goalball-echo-first" />
      <span ref={echo2Ref} className="goalball-echo goalball-echo-second" />
      <div className="goalball-ball-position">
        <div ref={ballRef} className="goalball-ball">
          <Image src="/illustrations/goalball-bola.svg" alt="" fill unoptimized sizes="(max-width: 760px) 32vw, 240px" />
        </div>
      </div>
    </div>
  );
}
