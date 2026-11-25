import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHero({ eyebrow, title, description, variant = "editorial" }: { eyebrow: string; title: string; description: string; variant?: string }) {
  return (
    <section className="interior-hero" data-editorial-variant={variant}>
      <div className="container">
        <Link className="back-link" href="/"><ArrowLeft size={17} aria-hidden="true" /> Voltar ao início</Link>
        <p className="eyebrow light">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="interior-lead">{description}</p>
      </div>
      <div className="interior-decoration" aria-hidden="true"><span /><span /><span /></div>
    </section>
  );
}
