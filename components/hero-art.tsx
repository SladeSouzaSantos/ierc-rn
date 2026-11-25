import Image from "next/image";

/** Stable, decorative editorial art; all essential information is in adjacent text. */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <div className="hero-art-visual">
        <Image src="/illustrations/leitura-tatil.svg" alt="" fill unoptimized priority
          sizes="(max-width: 760px) 94vw, (max-width: 1200px) 52vw, 760px"
          className="hero-art-illustration" />
      </div>
    </div>
  );
}
