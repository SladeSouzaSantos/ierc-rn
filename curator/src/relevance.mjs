import {coverageFor,mentionsIerc,editorialTrackPriority} from './coverage-policy.mjs';

// Relevance is a policy classification, not a general Brazilian news feed.
const SIGNALS=Object.freeze([
  {topic:'educação e Braille',weight:7,regex:/\b(?:braille|leitura\s+t[aá]til|educa[cç][aã]o\s+inclusiva|ensino\s+inclusivo|alfabetiza[cç][aã]o\s+acess[ií]vel|inclusive education|blind students?|visually impaired students?|education for (?:the )?blind|accessible education)\b/i},
  {topic:'esporte adaptado',weight:8,regex:/\b(?:goalball|futebol\s+de\s+cegos|esporte\s+adaptado|esportes\s+adaptados|paradesporto|paral[ií]mpic[oa]s?|paraatleta|paratleta|atleta\s+com\s+defici[eê]ncia|blind football|blind sports?|adapted sports?|adaptive sports?|paralympic|paralympics|para-athlet)\b/i},
  {topic:'tecnologia assistiva',weight:7,regex:/\b(?:tecnologia\s+assistiva|tecnologias\s+assistivas|leitor(?:es)?\s+de\s+tela|bengala\s+inteligente|audiodescri[cç][aã]o|acessibilidade\s+digital|assistive technolog(?:y|ies)|screen readers?|smart glasses|cvi|cortical visual impairment|low vision devices?|mobility tools?|accessible games?|digital inclusion|accessible apps?)\b/i},
  {topic:'deficiência visual',weight:8,regex:/\b(?:defici[eê]ncia\s+visual|pessoas?\s+cegas?|pessoas?\s+com\s+baixa\s+vis[aã]o|cegueira|baixa\s+vis[aã]o|instituto\s+dos\s+cegos|blind(?:ness)?|low vision|sight loss|partially sighted|visually impaired|visual impairments?)\b/i},
  {topic:'direitos e acessibilidade',weight:4,regex:/\b(?:acessibilidade|lei\s+brasileira\s+de\s+inclus[aã]o|direitos\s+das\s+pessoas\s+com\s+defici[eê]ncia|accessib(?:le|ility)|wcag|inclusive|inclusion|disabilit(?:y|ies))\b/i},
  {topic:'participação e autonomia',weight:3,regex:/\b(?:mobilidade\s+acess[ií]vel|orienta[cç][aã]o\s+e\s+mobilidade|educa[cç][aã]o\s+especial|inclus[aã]o\s+de\s+pessoas\s+com\s+defici[eê]ncia|independent living)\b/i},
]);
const SOURCE_FOCUS=Object.freeze({'rnib':1,'ibsa':2,'wbu':1,'w3c-wai':0,'perkins':1});
export function relevanceAssessment(article,source={}){
  // Short RNIB listing descriptions may resolve otherwise ambiguous titles.
  // Never use discovery-only excerpts for publishable RSS sources.
  const text=(article.title||'')+' '+(article.summary||'')+
    (source.previewOnly===true&&source.id==='rnib'
      ? ' '+(article.discoveryText||'') : '');
  const coverage=coverageFor(article,source);
  const hits=SIGNALS.filter(s=>s.regex.test(text));
  // Direct, explicitly named references to the Institute are always relevant.
  const direct=mentionsIerc(article);
  const score=direct?100:Math.min(22,hits.reduce((n,s)=>n+s.weight,0)+(SOURCE_FOCUS[source.id]||0));
  return {relevant:direct||score>=6||(source.id==='w3c-wai'&&/\bwcag\b/i.test(text)&&score>=3),score,topics:hits.map(x=>x.topic),
    coverageTrack:coverage.track,scope:coverage.scope,priority:coverage.priority,
    perspective:coverage.perspective};
}
export function rankArticles(articles,source){
  return articles.map(a=>({...a,relevance:relevanceAssessment(a,source),
    coverageTrack:coverageFor(a,source).track,
    coverageScope:coverageFor(a,source).scope,
    coverageCountry:coverageFor(a,source).country}))
    .filter(a=>a.relevance.relevant)
    .sort((a,b)=>editorialTrackPriority(b)-editorialTrackPriority(a)||
      b.relevance.score-a.relevance.score||
      Date.parse(b.publishedAt)-Date.parse(a.publishedAt)||
      a.url.localeCompare(b.url));
}
