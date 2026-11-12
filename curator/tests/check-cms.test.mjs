import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';

async function localCms(status, body, action){
  const requests=[];
  const server=createServer((req,res)=>{
    requests.push({method:req.method,url:req.url,authorization:req.headers.authorization});
    const response=typeof status==='function' ? status(req) : {status,body};
    res.writeHead(response.status,{'Content-Type':'application/json'});
    res.end(response.body);
  });
  server.listen(0,'127.0.0.1');
  await once(server,'listening');
  try{
    const port=server.address().port;
    return await action('http://127.0.0.1:'+port,requests);
  }finally{
    await new Promise((resolve,reject)=>
      server.close(error=>error?reject(error):resolve()));
  }
}
async function runCheck(baseUrl){
  const entry=fileURLToPath(new URL('../src/check-cms.mjs',import.meta.url));
  const child=spawn(process.execPath,[entry],{
    env:{...process.env,
      CURATOR_INSTANCE_KIND:'dev',
      CURATOR_ENABLED:'false',CURATOR_WRITE_DRAFTS:'false',
      CURATOR_CMS_URL:baseUrl,CURATOR_STRAPI_DRAFT_TOKEN:'test-token-123456',
      CURATOR_OPENROUTER_API_KEY:'',
    },stdio:['ignore','pipe','pipe'],
  });
  let stdout='';let stderr='';
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const [code]=await once(child,'close');
  return {code,stdout,stderr};
}
test('cms:check uses only authenticated draft GET, not Redis, LLM or POST',async()=>{
  await localCms(200,JSON.stringify({data:[]}),async(base,requests)=>{
    const result=await runCheck(base);
    assert.equal(result.code,0);
    assert.equal(result.stderr,'');
    assert.match(result.stdout,/"status":"ok"/);
    assert.match(result.stdout,/"readOnly":true/);
    assert.equal(requests.length,1);
    assert.equal(requests[0].method,'GET');
    assert.equal(requests[0].authorization,'Bearer test-token-123456');
    const u=new URL(requests[0].url,base);
    assert.equal(u.pathname,'/api/news-articles');
    assert.equal(u.searchParams.get('status'),'draft');
    assert.equal(u.searchParams.get('filters[dedupeKey][$eq]'),'0'.repeat(64));
  });
});
test('cms:check 403 reports fixed category and status only, never token/server message',async()=>{
  const message='VERY_PRIVATE_REMOTE_ERROR_BEARER_DATA';
  await localCms(403,JSON.stringify({error:{message}}),async(base,requests)=>{
    const result=await runCheck(base);
    assert.equal(result.code,1);
    assert.match(result.stderr,/"httpStatus":403/);
    assert.match(result.stderr,/"category":"permission"/);
    assert.ok(!result.stderr.includes(message));
    assert.ok(!result.stderr.includes('test-token-123456'));
    assert.equal(requests.length,1);
    assert.equal(requests[0].method,'GET');
  });
});

test('cms:check diagnoses 400 by testing isolated REST parameters, never performs POST',async()=>{
  const privateInfo='secret-data-DO-NOT-LOG';
  await localCms(req=>{
    const url=new URL(req.url,'http://127.0.0.1');
    // Simulate Strapi rejecting a filter field that is missing from a
    // deployed schema, while other draft and pagination parameters work.
    const filtered=url.searchParams.has('filters[dedupeKey][$eq]');
    return filtered
      ? {status:400,body:JSON.stringify({error:{message:privateInfo}})}
      : {status:200,body:JSON.stringify({data:[]})};
  },null,async(base,requests)=>{
    const result=await runCheck(base);
    assert.equal(result.code,1);
    assert.equal(result.stdout,'');
    const output=JSON.parse(result.stderr.trim());
    assert.equal(output.status,'failed');
    assert.equal(output.category,'invalid_query');
    assert.equal(output.httpStatus,400);
    assert.equal(output.readOnly,true);
    assert.deepEqual(output.diagnosticChecks.map(x=>[x.step,x.httpStatus]),[
      ['collection',200],['draft_status',200],['pagination',200],
      ['dedupe_filter',400],['combined',400],
    ]);
    assert.equal(requests.length,6); // main check + five isolated GETs
    assert.ok(requests.every(x=>x.method==='GET'));
    assert.ok(requests.every(x=>x.authorization==='Bearer test-token-123456'));
    assert.ok(!result.stderr.includes(privateInfo));
    assert.ok(!result.stderr.includes('test-token-123456'));
    assert.ok(!result.stderr.includes('0'.repeat(64)));
    assert.ok(!result.stderr.includes('filters%5B'));
  });
});
test('cms:check HTTP 400 diagnostics stop if permissions change to 403',async()=>{
  let n=0;
  await localCms(req=>++n===1
    ? {status:400,body:JSON.stringify({error:{message:'secret'}})}
    : {status:403,body:JSON.stringify({error:{message:'secret'}})}
  ,null,async(base,requests)=>{
    const result=await runCheck(base);
    assert.equal(result.code,1);
    const output=JSON.parse(result.stderr.trim());
    assert.equal(output.httpStatus,400);
    assert.equal(output.diagnosticChecks.length,1);
    assert.equal(output.diagnosticChecks[0].httpStatus,403);
    assert.ok(requests.every(x=>x.method==='GET'));
  });
});
