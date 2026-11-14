// Conservative pre-review guard for fresh full-article drafts.
// Lexical consistency is a rejection filter, NEVER a proof of factual support.
// Every accepted draft still requires independent, evidence-quoted review.
const FIELDS=['title','summary','body','whyItMatters'];
const canonical=s=>String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\s+/g,' ').trim();
const alphaNum=s=>canonical(s).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const numeric=s=>[...String(s).matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*(?:%)?(?![\p{L}\p{N}])/gu)]
  .map(m=>m[0].replace(/[.,]/g,''));
const fullNames=text=>[...String(text||'').matchAll(
  /\b[\p{Lu}][\p{L}\p{M}-]{2,}(?:\s+(?:(?:de|da|do|das|dos)\s+)?[\p{Lu}][\p{L}\p{M}-]{2,})+/gu
)].map(x=>x[0]).filter(x=>!new Set([
  'Segundo','Conforme','Durante','Entre','Outras','Todos',
  'Para','Quando','Apos','Ainda','Neste','Nesta','Essa',
  'Esse','Por','Como','Sobre','Primeiro',
]).has(x.split(/\s+/)[0]));
const specificVisualAudience=/\b(?:pessoas? com deficiencia visual|pessoas? cegas?|estudantes cegos|deficientes visuais|pessoas? com baixa visao|pessoas? de baixa visao|publico cego)\b/u;
const visualSourceEvidence=/\b(?:blind|low vision|visually impaired|visual impairment|visual disability|deficiencia visual|pessoas? cegas?|cegos?|baixa visao|deficientes visuais)\b/u;
function deny(field,rule){
  const error=new Error('Unsupported source-anchored editorial claim');
  // The router logs only these fixed attributes; NEVER model/source text.
  error.editorialField=field;
  error.editorialConstraint=rule;
  throw error;
}
export function validateSourceAnchoredDraft(draft,source,evidence){
  if(!draft||FIELDS.some(k=>typeof draft[k]!=='string')||
     !evidence||evidence.verified!==true||evidence.mode!=='full_article'||
     !Array.isArray(evidence.blocks)||evidence.blocks.length<3||
     evidence.blocks.some(b=>typeof b.text!=='string')||
     !source||typeof source.title!=='string')
    throw new Error('Validated source and full article required');
  const reference=[source.title,source.source||'',...evidence.blocks.map(b=>b.text)].join(' ');
  const allowedNumbers=new Set(numeric(reference));
  const refText=alphaNum(reference);
  const hasAudienceEvidence=visualSourceEvidence.test(canonical(reference));
  for(const field of FIELDS){
    const text=draft[field];
    if(numeric(text).some(n=>!allowedNumbers.has(n)))
      deny(field,'source_new_number');
    // A multiword proper name must appear IN the licensed source or its
    // canonical title/provider; matching does not grant factual approval.
    if(fullNames(text).some(name=>!refText.includes(alphaNum(name))))
      deny(field,'source_new_name');
    if(!hasAudienceEvidence&&specificVisualAudience.test(canonical(text)))
      deny(field,'unverified_visual_audience');
  }
  return draft;
}
