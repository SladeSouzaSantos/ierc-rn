/**
 * Editorial tracks:
 * - ierc: externally documented direct mention of the Institute
 * - brasil: Brazilian disability/inclusion developments with practical relevance
 * - internacional: external practices that merit reflection in Brazil
 *
 * No third-party source is ever converted into an institutional announcement.
 */
const institutional = /\b(?:I\s*E\s*R\s*C\s*[-/]?\s*R\s*N|instituto\s+de\s+educa[cç][aã]o\s+e\s+reabilita[cç][aã]o\s+de\s+cegos(?:\s+do\s+rio\s+grande\s+do\s+norte)?)\b/i;
const overseas = /\b(?:no\s+(?:exterior|reino unido|canad[aá]|jap[aã]o|m[eé]xico|chile|peru|uruguai|paraguai|equador)|na\s+(?:alemanha|fran[cç]a|indon[eé]sia|col[oô]mbia|argentina|europa|[aá]frica|[aá]sia)|nos\s+(?:estados unidos|eua)|international|internacional|global|united states|united kingdom|europe|abroad)\b/i;
export function mentionsIerc(article){
 const text=(article?.title||'')+' '+(article?.summary||'');
 return institutional.test(text);
}
export function coverageFor(article,source={}){
 if(mentionsIerc(article))return {track:'ierc',scope:'local',country:'Brasil',priority:3,
   perspective:'Referência externa sobre o IERC-RN, não comunicado institucional'};
 const foreign=source.country && !['Brasil','Brazil','Internacional'].includes(source.country);
 const abroad=foreign||source.section==='internacional'||
   (overseas.test((article?.title||'')+' '+(article?.summary||'')) && source.country==='Internacional');
 if(abroad)return {track:'internacional',scope:'internacional',
   country:foreign?source.country:(source.country==='Brasil'?'Brasil':source.country||'Internacional'),
   priority:1,
   perspective:'Experiência externa; contextualizar possíveis aprendizados para o Brasil, sem afirmar adoção'};
 return {track:'brasil',scope:'brasil',country:'Brasil',priority:2,
   perspective:'Relevância nacional para direitos, educação, acessibilidade e esporte adaptado'};
}
export const editorialTrackPriority=article=>({ierc:3,brasil:2,internacional:1})[
  article?.coverageTrack||'internacional']||1;
