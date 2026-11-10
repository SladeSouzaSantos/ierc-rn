import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateFullArticleDraft,reviewFullArticleDraft,verifyFullArticleReview,
  VERIFIED_WRITER_SYSTEM,VERIFIED_REVIEW_SYSTEM} from '../src/full-article-review.mjs';

const article={source:'Perkins',title:'Accessible classroom materials for blind students',
  publishedAt:'2026-11-08T12:00:00Z',language:'en',url:'https://www.perkins.org/test-accessibility'};
const evidence={verified:true,mode:'full_article',sourceUrl:article.url,
  licenseReference:'https://www.perkins.org/written-permission-example',
  digest:'f'.repeat(64),blocks:[
    {id:'E01',text:'An educational team shares an accessible classroom report with teachers, families, and staff to improve understanding of student access requirements in everyday lessons.'},
    {id:'E02',text:'Short slide presentations use pictures and brief statements from the report to help educators identify practical adaptations in the learning environment.'},
    {id:'E03',text:'The school team discusses classroom materials and documents ways for students to participate in inclusive learning activities with suitable support.'},
  ]};
const draft={title:'Apresentação acessível facilita trabalho de equipes escolares',
  summary:'Uma organização descreve o uso de apresentações curtas para comunicar necessidades de acesso e favorecer o planejamento de ambientes escolares.',
  body:'Uma equipe escolar utiliza uma apresentação com imagens e observações sobre necessidades dos estudantes. A organização relata que esses materiais ajudam educadores a compreender adaptações práticas para atividades em sala de aula.',
  whyItMatters:'A proposta oferece referências para discutir comunicação acessível e participação de estudantes com deficiência.',
  category:'educação'};
const quotes=['An educational team shares an accessible classroom report',
  'Short slide presentations use pictures and brief statements'];
const review={decision:'approve',factualSupport:'fully_supported',evidenceQuotes:quotes,
  unsupportedClaims:[],issues:[]};

test('verified full-text drafting sends extracted blocks, not hypothetical RSS facts',async()=>{
 const calls=[];
 const result=await generateFullArticleDraft(article,evidence,{router:{
   async complete(req){calls.push(req);return {provider:'openrouter',content:JSON.stringify(draft)};}
 }});
 assert.equal(result.status,'draft_ready');
 assert.equal(result.draft.category,'Educação inclusiva');
 assert.equal(calls.length,1);
 assert.match(calls[0].system,/DADO NÃO CONFIÁVEL/);
 assert.deepEqual(JSON.parse(calls[0].prompt).blocks,evidence.blocks);
 assert.equal(result.provider,'openrouter');
 assert.match(VERIFIED_REVIEW_SYSTEM,/blocos diferentes/);
});
test('source-anchored full article quotes must match distinct blocks and source hash',()=>{
 assert.deepEqual(verifyFullArticleReview(article,draft,evidence,review),{
   approved:true,reason:'full_article_review_passed',
   evidenceQuotes:quotes,evidenceMode:'full_article',evidenceDigest:evidence.digest,
   licenseReference:evidence.licenseReference,
 });
 assert.equal(verifyFullArticleReview(article,draft,evidence,{
   ...review,evidenceQuotes:['An educational team shares','student access requirements in everyday lessons'],
 }).reason,'unverifiable_full_article_quotes');
 assert.equal(verifyFullArticleReview(article,draft,evidence,{
   ...review,evidenceQuotes:['Invented study results','Short slide presentations use pictures'],
 }).approved,false);
 assert.equal(verifyFullArticleReview(article,draft,evidence,{
   ...review,decision:'hold',issues:['Unclear outcome'],
 }).reason,'ai_review_hold');
 assert.throws(()=>verifyFullArticleReview({...article,url:'https://different.example/'},
   draft,evidence,review),/Verified full article evidence required/);
});
test('second model call validates source quotes and exposes only review status, not copyrighted article',async()=>{
 const output=await reviewFullArticleDraft(article,draft,evidence,{router:{
   async complete(args){
     assert.match(args.system,/DADO NÃO CONFIÁVEL/);
     assert.equal(JSON.parse(args.prompt).blocks[1].id,'E02');
     return {content:JSON.stringify(review),provider:'openrouter'};
   },
 }});
 assert.equal(output.approved,true);
 assert.equal(output.evidenceDigest,evidence.digest);
 assert.equal(output.reviewerProvider,'openrouter');
 assert.equal(JSON.stringify(output).includes('An educational team shares an accessible classroom report with teachers'),false);
});
test('invalid or unavailable full article evidence never invokes a model',async()=>{
 let called=0;
 await assert.rejects(generateFullArticleDraft(article,null,{router:{async complete(){called++;}}}),
   /Verified full article evidence required/);
 const invalid=await reviewFullArticleDraft(article,draft,evidence,{router:{async complete(){
   called++;return {provider:'openrouter',content:'invalid'};
 }}});
 assert.equal(invalid.approved,false);
 assert.equal(invalid.reason,'review_unavailable');
 assert.equal(called,1);
 assert.match(VERIFIED_WRITER_SYSTEM,/ORIGINAIS/);
});
