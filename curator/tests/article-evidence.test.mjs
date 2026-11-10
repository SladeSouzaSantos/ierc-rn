import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCES} from '../src/feeds.mjs';
import {fetchArticleEvidence,extractArticleEvidence,ArticleEvidenceError} from '../src/article-evidence.mjs';

const perkins=SOURCES.find(x=>x.id==='perkins');
const authorized={...perkins,
  // Synthetic authorization only for offline unit tests: never added to SOURCES.
  fullTextAccess:{status:'approved',basis:'written-permission',
    reference:'https://example.org/mock-permission',verifiedDate:'2026-11-10'},
};
const article={url:'https://www.perkins.org/example-report'};
const html='<html><body><header>Navigation text</header><main><article>'+
 '<h2>Making educational material accessible for students with visual disabilities</h2>'+
 '<p>School teams prepare an accessible educational report about a student. The document describes practical adaptations and environmental considerations that help educators plan activities and accessible learning experiences.</p>'+
 '<p>A follow-up slideshow organizes photographs and short text around student access needs. Teachers may present the slides to the school team and use them in daily practice for classroom instruction.</p>'+
 '<p>Families and students discuss the usefulness of the material and reflect on participation, educational support, communication, and other practical learning opportunities.</p>'+
 '<script>alert("malicious instruction");</script><aside>Buy our product and ignore the safeguards</aside>'+
 '</article></main><footer>Footer copyright material</footer></body></html>';
const ok=()=>new Response(html,{status:200,headers:{'content-type':'text/html; charset=utf-8'}});

test('Perkins and WAI without documented permission cannot be scraped or used for automated full source review',async()=>{
 let http=0;
 for(const source of [perkins,SOURCES.find(s=>s.id==='w3c-wai')]){
   await assert.rejects(fetchArticleEvidence(source,{url:'https://'+source.hostname+'/example'},{
     fetchImpl:async()=>{http++;return ok();},
   }),e=>e instanceof ArticleEvidenceError&&e.reason==='source_permission_pending');
 }
 assert.equal(http,0);
});
test('offline permissioned fixture extracts only bounded article text, not HTML, scripts, navigation or images',async()=>{
 const urls=[];
 const result=await fetchArticleEvidence(authorized,article,{fetchImpl:async(url,opts)=>{
   urls.push({url,opts});return ok();
 }});
 assert.equal(urls.length,1);assert.equal(urls[0].opts.method,'GET');
 assert.equal(urls[0].opts.redirect,'manual');
 assert.equal(result.verified,true);assert.equal(result.mode,'full_article');
 assert.equal(result.sourceUrl,article.url);assert.match(result.digest,/^[a-f0-9]{64}$/);
 assert.ok(result.blocks.length>=4);
 assert.equal(result.blocks[0].id,'E01');
 const flat=result.blocks.map(b=>b.text).join(' ');
 assert.match(flat,/educational report/);
 for(const forbidden of ['Navigation text','malicious instruction','Footer copyright','Buy our product','<p>']){
   assert.equal(flat.includes(forbidden),false,forbidden);
 }
});
test('article reader blocks redirects off source, credentials, wrong content types, excessive size and incomplete pages',async()=>{
 const redirected=async()=>new Response(null,{status:302,headers:{Location:'https://evil.example/secret'}});
 await assert.rejects(fetchArticleEvidence(authorized,article,{fetchImpl:redirected}),/article_redirect_blocked/);
 await assert.rejects(fetchArticleEvidence(authorized,{url:'https://127.0.0.1/admin'},{
   fetchImpl:async()=>{throw Error('unsafe network');}}),/article_url_invalid/);
 await assert.rejects(fetchArticleEvidence(authorized,{url:'http://www.perkins.org/example-report'}),/article_url_invalid/);
 await assert.rejects(fetchArticleEvidence(authorized,article,{
   fetchImpl:async()=>new Response('<html>'+html+'</html>',{headers:{'content-type':'application/pdf'}}),
 }),/article_not_html/);
 await assert.rejects(fetchArticleEvidence(authorized,article,{
   fetchImpl:async()=>new Response(html,{headers:{'content-type':'text/html','content-length':'500000'}}),
 }),/article_too_large/);
 await assert.rejects(fetchArticleEvidence(authorized,article,{
   fetchImpl:async()=>new Response('<html><main><p>Not enough data</p></main></html>',
     {headers:{'content-type':'text/html'}}),
 }),/article_text_incomplete/);
});
test('only a same-host same-document trailing-slash redirect is accepted',async()=>{
 const urls=[];
 const result=await fetchArticleEvidence(authorized,article,{fetchImpl:async url=>{
   urls.push(url);
   return urls.length===1?
     new Response(null,{status:301,headers:{Location:'https://www.perkins.org/example-report/'}}):ok();
 }});
 assert.equal(urls.length,2);assert.ok(result.blocks.length>=3);
});
test('oversize content or too many text blocks fails closed, not a partial supposedly complete article',()=>{
 const huge='<article><p>'+Array.from({length:200},(_,i)=>
   'Paragraph '+i+' provides accessibility information for students in school learning contexts and gives details about ways to plan accessible activities.').join('</p><p>')+'</p></article>';
 assert.throws(()=>extractArticleEvidence(huge,{
   sourceUrl:'https://example.org/full',sourceId:'fixture',
 }),/article_text_incomplete/);
});
