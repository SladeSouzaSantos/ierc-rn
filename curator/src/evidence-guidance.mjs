// Lexical *hints* for a held claim. These are never factual approvals.
// The independent reviewer still receives ALL original, numbered blocks.
const STOP=new Set([
  'para','como','com','sem','por','pela','pelo','pelas','pelos','uma','uns',
  'das','dos','que','isso','este','esta','essas','esses','tambem','entre',
  'sobre','onde','quando','ter','tem','sao','ser','foi','foram','nas','nos',
  'seus','sua','suas','seja','aos','ainda','mais','muito','outras','outros',
  'pela','depois','antes','segundo','reportagem','noticia','texto','fonte',
  'afirmacao','alegacao','evidencia','nao','se','em','do','da','de','um','o',
  'a','os','as','e','ou',
]);
function tokens(s){
  return new Set(String(s||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .toLowerCase().match(/[a-z0-9]{3,}/g)?.filter(w=>!STOP.has(w))||[]);
}
export function candidateEvidenceForObjections(assessment,evidence){
  if(!assessment||!Array.isArray(evidence?.blocks))return [];
  const questions=[
    ...(Array.isArray(assessment.unsupportedClaims)?assessment.unsupportedClaims:[]),
    ...(Array.isArray(assessment.issues)?assessment.issues:[]),
  ].filter(x=>typeof x==='string').slice(0,8);
  return questions.map((objection,index)=>{
    const search=tokens(objection);
    if(search.size<2)return {objectionIndex:index,candidateBlockIds:[]};
    const ranked=evidence.blocks.map(b=>{
      const available=tokens(b.text);
      const common=[...search].filter(t=>available.has(t)).length;
      return {id:b.id,common};
    }).filter(x=>/^E\d{2}$/.test(x.id)&&x.common>=2)
      .sort((a,b)=>b.common-a.common||a.id.localeCompare(b.id));
    return {objectionIndex:index,
      candidateBlockIds:ranked.slice(0,3).map(x=>x.id)};
  });
}
