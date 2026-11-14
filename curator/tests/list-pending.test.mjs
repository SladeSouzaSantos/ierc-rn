import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {pendingDraftLookup} from '../src/list-pending.mjs';

const id='abc123def456ghi789jklm0';
const token='DEV_READ_ONLY_TEST_TOKEN_NOT_REAL';
const baseUrl='http://cms:1337';

test('DEV pending list is strict GET-only, scoped to held external AI drafts',async()=>{
  const calls=[];
  const lookup=pendingDraftLookup({baseUrl,token,fetchImpl:async(url,opts)=>{
    calls.push({url,opts});
    return new Response(JSON.stringify({data:[
      {documentId:id,title:'Notícia de teste aguardando revisão'},
    ]}),{status:200});
  }});
  const result=await lookup();
  assert.deepEqual(result,{count:1,documents:[
    {documentId:id,title:'Notícia de teste aguardando revisão'},
  ]});
  assert.equal(calls.length,1);
  const u=new URL(calls[0].url);
  assert.equal(u.origin,baseUrl);
  assert.equal(u.pathname,'/api/news-articles');
  assert.equal(u.searchParams.get('status'),'draft');
  assert.equal(u.searchParams.get('filters[originType][$eq]'),'externa');
  assert.equal(u.searchParams.get('filters[aiAssisted][$eq]'),'true');
  assert.equal(u.searchParams.get('filters[editorialStatus][$eq]'),'em_revisao');
  assert.equal(u.searchParams.get('fields[0]'),'title');
  assert.equal(u.searchParams.get('pagination[pageSize]'),'20');
  assert.equal(calls[0].opts.method,'GET');
  assert.equal(calls[0].opts.redirect,'error');
  assert.equal(calls[0].opts.headers.Authorization,'Bearer '+token);
  assert.ok(!JSON.stringify(result).includes(token));
});

test('pending lookup requires private CMS URL and scoped token',()=>{
  for(const url of ['https://external.example','http://evil.example',
    'http://cms:1337/api','http://user:pass@evil.example',
    'file:///etc/passwd','not-a-url']){
    assert.throws(()=>pendingDraftLookup({baseUrl:url,token}),/private CMS URL/);
  }
  assert.throws(()=>pendingDraftLookup({baseUrl,token:'short'}),/read-only token/);
});

test('pending lookup fails closed on bad JSON, invalid record, oversized response, or access denial',async()=>{
  const invalid=[
    new Response('not-json',{status:200}),
    new Response(JSON.stringify({data:{}}),{status:200}),
    new Response(JSON.stringify({data:[{id:5,title:'test'}]}),{status:200}),
    new Response(JSON.stringify({data:[{documentId:id,title:5}]}),{status:200}),
    new Response(JSON.stringify({data:Array(21).fill({documentId:id,title:'test'})}),{status:200}),
    new Response('{}',{status:403}),
  ];
  for(const reply of invalid){
    const lookup=pendingDraftLookup({baseUrl,token,fetchImpl:async()=>reply});
    await assert.rejects(lookup(),/invalid CMS|failed \(HTTP 403\)/);
  }
});

test('DEV lookup CLI refuses PROD before reading tokens or making any HTTP request',()=>{
  const env={...process.env,CURATOR_INSTANCE_KIND:'prod',
    CURATOR_STRAPI_READ_TOKEN:token};
  const result=spawnSync(process.execPath,['src/list-pending.mjs'],{
    cwd:fileURLToPath(new URL('..',import.meta.url)),env,
    encoding:'utf8',timeout:5000,
  });
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/PENDING_DRAFT_LOOKUP_UNAVAILABLE/);
  assert.doesNotMatch(result.stderr,/\bTOKEN_NOT_REAL\b|http:\/\/cms/);
});
