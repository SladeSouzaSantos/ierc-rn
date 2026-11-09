import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function PageHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="interior-hero">
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
