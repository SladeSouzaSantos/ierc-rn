import { existsSync } from "node:fs";
import { join } from "node:path";
import Image from "next/image";
import manifest from "@/data/beyond-photos.json";

export function availablePhotos(): string[] {
  return manifest.filter(photo => existsSync(join(process.cwd(), "public", "experiment-photos", photo.file))).map(photo=>photo.id);
}

export function BeyondPhoto({id,available,priority=false}:{id:string;available:string[];priority?:boolean}) {
  const photo=manifest.find(p=>p.id===id);
  if(!photo) throw new Error("Fotografia experimental desconhecida");
  return <div className="beyond-photo" data-photo={id} data-available={available.includes(id)}>
    {available.includes(id) ? <Image src={"/experiment-photos/"+photo.file} alt={photo.alt} fill unoptimized priority={priority} sizes="(max-width: 760px) 90vw, 65vw"/> :
      <div className="beyond-photo-fallback" aria-hidden="true"><span/><span/><span/><strong>{id==="goalball"?"Esporte":id==="music"?"Música":id==="mobility"?"Mobilidade":"Tato"}</strong></div>}
  </div>;
}

export function PhotoCredits(){
  return <section className="beyond-credits" id="creditos-fotos" aria-labelledby="creditos-titulo">
    <h3 id="creditos-titulo">Créditos das fotografias ilustrativas</h3>
    <p>Imagens de acervos externos, utilizadas apenas no protótipo. Não representam alunos, instalações ou atividades do IERC-RN. As fotografias são apresentadas com recortes de enquadramento no layout; os arquivos originais não são alterados. Imagens CC BY-SA conservam a respectiva licença.</p>
    <ul>{manifest.map(p=><li key={p.id}><a href={p.source}>{p.title}</a> — {p.author} · <a href={p.licenseUrl}>{p.license}</a></li>)}</ul>
  </section>;
}
