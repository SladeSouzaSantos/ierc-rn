import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relevanceAssessment, rankArticles } from '../src/relevance.mjs';
const article = (title, summary='') => ({
  title, summary, url:'https://www.w3.org/WAI/news/example',
  publishedAt:'2026-11-02T12:00:00Z'
});
test('stronger relevance for blindness, Braille and goalball than general WCAG', () => {
  const wcag = relevanceAssessment(article('WCAG 3 Working Draft'), {id:'w3c-wai'});
  const braille = relevanceAssessment(article('Braille literacy for blind students'), {id:'wbu'});
  const sports = relevanceAssessment(article('Goalball development across Latin America'), {id:'ibsa'});
  assert.ok(braille.score > wcag.score);
  assert.ok(sports.score > wcag.score);
  assert.ok(braille.topics.includes('educação e Braille'));
  assert.ok(sports.topics.includes('esporte adaptado'));
});
test('generic unrelated news is rejected even from a source focused on blindness', () => {
  assert.equal(relevanceAssessment(article('Weather this week'), {id:'rnib'}).relevant, false);
  assert.equal(relevanceAssessment(article('Shiny website launches')).relevant, false);
});
test('topic priority is stable and determined before LLM', () => {
  const ranked=rankArticles([article('WCAG 3 Working Draft'),article('Braille literacy for blind students')],{id:'w3c-wai'});
  assert.equal(ranked.length,2);
  assert.match(ranked[0].title,/Braille/);
  assert.ok(ranked.every(x=>x.relevance.score>0));
});
