// Deterministic topic classifier. No external LLM call at candidate discovery.
const SIGNALS = Object.freeze([
  { topic: 'educação e Braille', weight: 7,
    regex: /\b(braille|tactile literacy|inclusive education|blind students?|visually impaired students?|education for (?:the )?blind|leitura t[aá]til)\b/i },
  { topic: 'esporte adaptado', weight: 7,
    regex: /\b(goalball|blind football|blind sports?|vision classification|paralympic|paralympics|para-athlet|jud[oô] paral[ií]mpico)\b/i },
  { topic: 'tecnologia assistiva', weight: 6,
    regex: /\b(assistive technolog(?:y|ies)|screen readers?|smart glasses|low vision devices?|mobility tools?|accessible games?|digital inclusion|accessible apps?|vis[aã]o computacional)\b/i },
  { topic: 'deficiência visual', weight: 6,
    regex: /\b(blind(?:ness)?|low vision|sight loss|partially sighted|visually impaired|visual impairments?|defici[eê]ncia visual|cegueira)\b/i },
  { topic: 'direitos e acessibilidade', weight: 3,
    regex: /\b(accessib(?:le|ility)|wcag|inclusive|inclusion|disabilit(?:y|ies)|accessibility)\b/i },
]);
const SOURCE_FOCUS = Object.freeze({ 'rnib': 1, 'ibsa': 2, 'wbu': 1, 'w3c-wai': 0 });

export function relevanceAssessment(article, source = {}) {
  const text = (article.title || '') + ' ' + (article.summary || '');
  const hits = SIGNALS.filter(signal => signal.regex.test(text));
  // Cap cumulative score so noisy long feeds cannot overwhelm a specific finding.
  const signalScore = hits.reduce((score, s) => score + s.weight, 0);
  const score = Math.min(18, signalScore + (SOURCE_FOCUS[source.id] || 0));
  return {
    relevant: hits.length > 0 && score >= 3,
    score,
    topics: hits.map(x => x.topic),
  };
}
export function rankArticles(articles, source) {
  return articles.map(article => ({ ...article, relevance: relevanceAssessment(article, source) }))
    .filter(article => article.relevance.relevant)
    .sort((a, b) => b.relevance.score - a.relevance.score ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
      a.url.localeCompare(b.url));
}
