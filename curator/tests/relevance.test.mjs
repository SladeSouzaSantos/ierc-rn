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

test('general disability and parasports news remain suggestions, not direct visual evidence',()=>{
 const para=relevanceAssessment(article('Paratleta ou atleta paralímpico: esporte transforma vidas'),{id:'diario-pcd'});
 assert.equal(para.relevant,true);
 assert.equal(para.editorialFocus,'inclusao_geral');
 assert.ok(para.topics.includes('esporte adaptado'));
 assert.equal(relevanceAssessment(
   article('Teleton 2026 tem podcast sobre capacitismo e inclusão'),{id:'jornalista-inclusivo'}
 ).editorialFocus,'inclusao_geral');
});
test('explicit blindness, low vision, Braille and goalball are direct visual focus',()=>{
 for(const title of [
   'Braille para estudantes cegos',
   'Nova tecnologia com leitor de tela para pessoas com deficiência visual',
   'Goalball na escola',
   'Acesso ao trabalho para pessoas com baixa visão',
   'Blind students use screen readers in inclusive education',
 ]){
   const verdict=relevanceAssessment(article(title),{id:'diario-pcd'});
   assert.equal(verdict.editorialFocus,'visual_direta',title);
   assert.equal(verdict.relevant,true);
 }
});
test('specialist context does not fabricate direct visual relevance',()=>{
 const item=article('An adaptive sports event welcomes students with disabilities');
 assert.equal(relevanceAssessment(item,{id:'rnib',previewOnly:true}).editorialFocus,'contextual');
 assert.equal(relevanceAssessment(item,{id:'diario-pcd',previewOnly:true}).editorialFocus,'inclusao_geral');
 assert.equal(relevanceAssessment(article('Community weather forecast'),{id:'rnib'}).editorialFocus,'fora_do_escopo');
});
test('RNIB listing context is used only when explicitly preview-only',()=>{
 const item={...article('Report finds NHS app falls short on accessibility'),
   summary:'',discoveryText:'Only 3 per cent of blind and partially sighted people can use the NHS App.'};
 assert.equal(relevanceAssessment(item,{id:'rnib',previewOnly:true}).editorialFocus,'visual_direta');
 assert.equal(relevanceAssessment(item,{id:'rnib',previewOnly:false}).editorialFocus,'fora_do_escopo');
});
test('visual evidence ranks ahead of general disability without disabling news eligibility',()=>{
 const general=article('Paratleta conta história de superação e esporte adaptado');
 const direct=article('Goalball e acessibilidade para pessoas cegas');
 const source={id:'agencia-brasil-esportes',country:'Brasil',previewOnly:false};
 const ranked=rankArticles([general,direct],source);
 assert.equal(ranked.length,2);
 assert.equal(ranked[0].relevance.editorialFocus,'visual_direta');
 assert.equal(ranked[1].relevance.editorialFocus,'inclusao_geral');
});
