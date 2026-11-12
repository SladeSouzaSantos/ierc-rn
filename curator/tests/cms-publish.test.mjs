import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cmsPublisher} from '../src/cms-publish.mjs';

const doc='a1b2c3d4e5f6g7h8i9j0klmn';
const expected={
  title:'Uma iniciativa de esporte adaptado para crianças',
  summary:'A publicação descreve projetos acessíveis para a participação de crianças com deficiência.',
  body:'Atividades esportivas acessíveis são apresentadas em um contexto de participação e aprendizagem.',
  slug:'uma-iniciativa-de-esporte-adaptado-aaaaaaaaaa',
  dedupeKey:'a'.repeat(64),sourceUrl:'https://agenciabrasil.ebc.com.br/esportes/noticia/2026-11/exemplo',
};
const stored={documentId:doc,publishedAt:null,editorialStatus:'em_revisao',
  originType:'externa',aiAssisted:true,image:null,...expected};
const creds={baseUrl:'http://cms:1337',token:'publisher-demo-12345',draftToken:'draft-demo-12345'};
const reviewed={evidenceQuotes:[
  'Accessible adaptive sports programs',
  'structured group activities and participation opportunities',
],reviewerProvider:'openrouter',evidenceMode:'full_article',evidenceDigest:'f'.repeat(64),
 licenseReference:'https://agenciabrasil.ebc.com.br/sobre'};

test('auto publisher uses separate token and checks exact unpublished draft before PUT',async()=>{
 const seen=[];
 const api=cmsPublisher({...creds,fetchImpl:async(url,options)=>{
   seen.push({url,options});
   if(options.method==='GET')return new Response(JSON.stringify({data:stored}),{status:200});
   assert.equal(options.method,'PUT');
   const {data}=JSON.parse(options.body);
   assert.deepEqual(Object.keys(data).sort(),['approvalNote','approvalReference','editorialStatus'].sort());
   assert.equal(data.editorialStatus,'aprovado');
   assert.match(data.approvalReference,/^ai-source-v2-[a-f0-9]{12}$/);
   assert.match(data.approvalNote,/Revisão IA/);
   assert.match(data.approvalNote,/Evidências internas/);
   assert.match(data.approvalNote,/Accessible adaptive sports programs/);
   return new Response(JSON.stringify({data:{...stored,...data,publishedAt:'2026-11-10T16:00:00Z'}}),{status:200});
 }});
 assert.deepEqual(await api.publishApprovedDraft(doc,expected,reviewed),{published:true});
 assert.equal(seen.length,2);
 assert.equal(seen[0].url,'http://cms:1337/api/news-articles/'+doc+'?status=draft');
 assert.equal(seen[1].url,'http://cms:1337/api/news-articles/'+doc+'?status=published');
 assert.equal(seen[0].options.method,'GET');
 assert.equal(seen[1].options.method,'PUT');
 assert.ok(seen.every(x=>x.options.headers.Authorization==='Bearer '+creds.token));
});
test('draft modification, missing source and premature publication prevent any PUT',async()=>{
 for(const mismatch of [
   {title:'Editor changed the title'}, {publishedAt:'2026-11-10T14:00:00Z'},
   {aiAssisted:false},{editorialStatus:'aprovado'},{dedupeKey:'b'.repeat(64)},
   {sourceUrl:'https://example.com/unknown'},{image:{id:1}},
 ]){
   let writes=0;
   const api=cmsPublisher({...creds,fetchImpl:async(_url,opts)=>{
     if(opts.method==='PUT'){writes++;throw Error('unexpected update');}
     return new Response(JSON.stringify({data:{...stored,...mismatch}}),{status:200});
   }});
   await assert.rejects(api.publishApprovedDraft(doc,expected,reviewed),/preflight failed/);
   assert.equal(writes,0);
 }
});
test('publisher validates token, private endpoint, document ID and non-success responses',async()=>{
 assert.throws(()=>cmsPublisher({...creds,token:creds.draftToken}),/Separate scoped/);
 assert.throws(()=>cmsPublisher({...creds,token:''}),/Separate scoped/);
 assert.throws(()=>cmsPublisher({...creds,baseUrl:'https://production.example.com'}),/private/);
 const api=cmsPublisher({...creds,fetchImpl:async()=>new Response('{}',{status:403})});
 await assert.rejects(api.publishApprovedDraft(doc,expected,reviewed),/HTTP 403/);
 await assert.rejects(api.publishApprovedDraft('bad',expected),/Invalid CMS document ID/);
});
test('publisher refuses to report success if PUT response does not confirm publishedAt',async()=>{
 let calls=0;
 const api=cmsPublisher({...creds,fetchImpl:async()=>{
   calls++;
   return new Response(JSON.stringify({data:calls===1?stored:{...stored,editorialStatus:'aprovado',publishedAt:null}}),{status:200});
 }});
 await assert.rejects(api.publishApprovedDraft(doc,expected,reviewed),/did not confirm published status/);
 assert.equal(calls,2);
});

test('publisher requires two fixed-size review quotes, never blind publish',async()=>{
 let network=0;
 const api=cmsPublisher({...creds,fetchImpl:async()=>{network++;return new Response('{}');}});
 await assert.rejects(api.publishApprovedDraft(doc,expected),/full article evidence audit/);
 await assert.rejects(api.publishApprovedDraft(doc,expected,{...reviewed,evidenceQuotes:['only one']}),/full article evidence audit/);
 await assert.rejects(api.publishApprovedDraft(doc,expected,{...reviewed,evidenceMode:'rss'}),/full article evidence audit/);
 await assert.rejects(api.publishApprovedDraft(doc,expected,{...reviewed,evidenceDigest:null}),/full article evidence audit/);
 await assert.rejects(api.publishApprovedDraft(doc,expected,{...reviewed,licenseReference:'https://example.com/other'}),/documented source reuse permission/);
 assert.equal(network,0);
});
