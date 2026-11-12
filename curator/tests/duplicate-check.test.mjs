import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cmsNewsReadOnly,previewDeduper} from '../src/duplicate-check.mjs';

const key='e'.repeat(64);
const config={baseUrl:'http://cms:1337',token:'scoped-news-read-token-123'};
const reply=data=>new Response(JSON.stringify({data}),{status:200});

test('GET-only CMS lookup checks draft THEN published before considering a news item new',async()=>{
 const calls=[];
 const cms=cmsNewsReadOnly({...config,fetchImpl:async(url,opts)=>{
   const query=new URL(url).searchParams;
   calls.push({status:query.get('status'),method:opts.method,token:opts.headers.Authorization,url});
   assert.equal(opts.redirect,'error');
   assert.equal(query.get('filters[dedupeKey][$eq]'),key);
   assert.equal(query.get('pagination[pageSize]'),'1');
   if(query.get('status')==='draft')return reply([]);
   if(query.get('status')==='published')return reply([{documentId:'published-1'}]);
   throw Error('Unexpected status');
 }});
 assert.equal('create' in cms,false);
 assert.equal('publishApprovedDraft' in cms,false);
 assert.equal(await cms.existing(key),true);
 assert.deepEqual(calls.map(c=>c.status),['draft','published']);
 assert.ok(calls.every(c=>c.method==='GET'));
 assert.ok(calls.every(c=>c.token==='Bearer '+config.token));
});
test('draft hit stops before querying published, and completely new items return false',async()=>{
 let calls=0;
 const draft=cmsNewsReadOnly({...config,fetchImpl:async()=>{
   calls++;return reply([{documentId:'draft-1'}]);
 }});
 assert.equal(await draft.existing(key),true);assert.equal(calls,1);
 const news=cmsNewsReadOnly({...config,fetchImpl:async()=>{calls++;return reply([]);}});
 assert.equal(await news.existing(key),false);assert.equal(calls,3);
});
test('unavailable or malformed published lookup fails closed with safe status only',async()=>{
 const SECRET='provider-private-token';
 for(const code of [400,401,403,404,429,500]){
   let n=0;
   const lookup=cmsNewsReadOnly({...config,fetchImpl:async()=>{
     n++;return n===1?reply([]):new Response(JSON.stringify({error:{message:SECRET}}),{status:code});
   }});
   await assert.rejects(lookup.existing(key),e=>{
     assert.equal(e.message,'CMS read-only duplicate lookup failed (HTTP '+code+')');
     assert.ok(!e.message.includes(SECRET));return true;
   });
   assert.equal(n,2);
 }
 const failed=cmsNewsReadOnly({...config,fetchImpl:async()=>{throw Error('do not leak secret');}});
 await assert.rejects(failed.existing(key),e=>e.message==='CMS read-only duplicate lookup unavailable');
 const malformed=cmsNewsReadOnly({...config,fetchImpl:async()=>reply({not:'an array'})});
 await assert.rejects(malformed.existing(key),/Invalid CMS read-only duplicate lookup response/);
});
test('reject unsafe CMS URLs, tokens and malformed fingerprints without any network request',async()=>{
 assert.throws(()=>cmsNewsReadOnly({...config,baseUrl:'https://example.com'}),/private/);
 assert.throws(()=>cmsNewsReadOnly({...config,baseUrl:'http://evil.example.com'}),/private/);
 assert.throws(()=>cmsNewsReadOnly({...config,token:'short'}),/token required/);
 let calls=0;
 const cms=cmsNewsReadOnly({...config,fetchImpl:async()=>{calls++;return reply([]);}});
 await assert.rejects(cms.existing('123'),/fingerprint/);
 assert.equal(calls,0);
});
test('preview dedup checks Redis EXISTS first, otherwise GET only, and never mutates state',async()=>{
 let seen=0;let strapi=0;
 const duplicate=previewDeduper({
   redis:{async exists(keyName){seen++;assert.equal(keyName,'ierc:curator:seen:'+key);return seen===1?1:0;}},
   cms:{async existing(value){strapi++;assert.equal(value,key);return strapi===1;}},
 });
 assert.equal(await duplicate.check({dedupeKey:key}),'redis');
 assert.equal(strapi,0);
 assert.equal(await duplicate.check({dedupeKey:key}),'cms');
 assert.equal(await duplicate.check({dedupeKey:key}),null);
 assert.equal(seen,3);assert.equal(strapi,2);
});
test('preview dedup refuses writer clients and fails closed on Redis outage',async()=>{
 assert.throws(()=>previewDeduper({redis:{async exists(){}},
   cms:{async existing(){},async create(){}}}),/read-only duplicate clients/);
 assert.throws(()=>previewDeduper({redis:{async exists(){}},
   cms:{async existing(){},async publishApprovedDraft(){}}}),/read-only duplicate clients/);
 const duplicate=previewDeduper({
   redis:{async exists(){throw Error('private connection detail');}},
   cms:{async existing(){throw Error('should not reach CMS');}},
 });
 await assert.rejects(duplicate.check({dedupeKey:key}),e=>
   e.message==='Redis read-only seen check unavailable');
});
