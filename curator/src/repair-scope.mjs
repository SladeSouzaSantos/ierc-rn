// A conservative *rewrite-only* gate: a correction must not introduce
// new numerals or multiword named entities absent from the held draft.
// This is not a substitute for source review or a claim that the previous
// draft was factual. It reduces the attack surface for off-topic additions.
const FIELDS=['title','summary','body','whyItMatters'];
const norm=s=>String(s||'').normalize('NFKD')
  .replace(/[\u0300-\u036f]/g,'').toLowerCase()
  .replace(/\s+/g,' ').trim();
const numerals=s=>[...String(s).matchAll(/(?<![\p{L}\p{N}])\d+(?:[.,]\d+)*(?![\p{L}\p{N}])/gu)]
  .map(m=>m[0]);
const namePattern=/\b[\p{Lu}][\p{L}\p{M}-]{2,}(?:\s+(?:(?:de|da|do|das|dos)\s+)?[\p{Lu}][\p{L}\p{M}-]{2,})+/gu;
// These ordinary phrase starts are not an introduction of a person/company.
const genericStart=new Set([
  'Segundo','Conforme','Durante','Entre','Outros','Outras','Todos',
  'Todas','Para','Quando','Após','Ainda','Neste','Nesta','Essa','Essas',
  'Esse','Esses','Isso','Por','Como','Agora','Sobre','Primeiro',
]);
function namedPhrases(text){
  return [...text.matchAll(namePattern)].map(m=>m[0])
    .filter(v=>!genericStart.has(v.split(/\s+/)[0]))
    .map(norm);
}
function scopeError(field,reason){
  // Router emits only this controlled field+rule; never LLM text.
  const error=new Error('Unscoped editorial correction');
  error.editorialField=field;
  error.editorialConstraint=reason;
  throw error;
}
export function validateConservativeRepairScope(previous,next){
  if(!previous||!next||FIELDS.some(f=>typeof previous[f]!=='string'||
     typeof next[f]!=='string'))
    throw new Error('Canonical previous and corrected drafts required');
  const prior=FIELDS.map(k=>previous[k]).join(' ');
  const numbers=new Set(numerals(prior));
  const knownNames=new Set(namedPhrases(prior));
  // Keep the "previous" document as the only source for whether a claim
  // counts as a *new addition*. Source blocks still go to a separate reviewer.
  for(const field of FIELDS){
    if(numerals(next[field]).some(n=>!numbers.has(n)))
      scopeError(field,'new_number');
    if(namedPhrases(next[field]).some(n=>!knownNames.has(n)))
      scopeError(field,'new_proper_name');
  }
  return next;
}
