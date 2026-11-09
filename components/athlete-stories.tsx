import Image from "next/image";
import { ArrowUpRight, CameraOff } from "lucide-react";
import { athleteProfiles } from "@/lib/athlete-stories";

export function AthleteStories() {
  return <section className="athlete-stories" aria-labelledby="athlete-stories-heading">
    <div className="athlete-stories-intro">
      <p className="eyebrow">Trajetórias documentadas</p>
      <h2 id="athlete-stories-heading">Pessoas, caminhos e conquistas</h2>
      <p>Conheça atletas que tiveram passagens comprovadas pelo IERC-RN ou que representaram a instituição em períodos documentados. Os clubes e títulos citados referem-se às datas das fontes, sem presumir vínculos atuais.</p>
    </div>
    <div className="athlete-story-list">
      {athleteProfiles.map((athlete) => <article className="athlete-story" id={athlete.id} key={athlete.id}>
        <div className="athlete-story-media">
          {athlete.photo ? <figure className="athlete-story-figure">
            <div className="athlete-story-frame">
              <Image src={athlete.photo.src} alt={athlete.photo.alt} fill unoptimized
                sizes="(max-width: 760px) 90vw, (max-width: 1180px) 40vw, 470px" />
            </div>
            <figcaption className="athlete-photo-credit">
              {athlete.photo.credit}{" "}
              <a href={athlete.photo.publisherUrl} target="_blank" rel="noopener noreferrer">
                Ver fotografia na fonte<span className="sr-only"> (abre em nova aba)</span>
              </a>.
            </figcaption>
          </figure> : <div className="athlete-photo-pending">
            <CameraOff size={38} strokeWidth={1.4} aria-hidden="true" />
            <p>Retrato individual em verificação</p>
            <span>Sem fotografia identificada e liberada para reprodução.</span>
          </div>}
        </div>
        <div className="athlete-story-content">
          <p className="athlete-story-discipline">{athlete.discipline}</p>
          <h3>{athlete.name}</h3>
          <p className="athlete-story-relation">{athlete.relation}</p>
          <p className="athlete-story-summary">{athlete.summary}</p>
          <h4>Marcos da trajetória</h4>
          <ul className="athlete-story-milestones">{athlete.milestones.map((fact) => <li key={fact}>{fact}</li>)}</ul>
          <div className="athlete-story-sources">
            <p>Fontes consultadas</p>
            <ul>{athlete.sources.map((source) => <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer">
                {source.label}<ArrowUpRight size={15} aria-hidden="true" />
                <span className="sr-only"> (abre em nova aba)</span>
              </a>
            </li>)}</ul>
          </div>
        </div>
      </article>)}
    </div>
    <p className="athlete-stories-note">As fotografias externas são prévias de homologação com crédito e link para a publicação original. Sua licença de reprodução no portal ainda precisa ser autorizada. Nenhuma imagem foi copiada para este repositório. O caso de Maria Clara aguarda identificação inequívoca de retrato e liberação de uso.</p>
  </section>;
}
