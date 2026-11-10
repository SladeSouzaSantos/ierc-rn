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
    res.writeHead(status,{'Content-Type':'application/json'});
    res.end(body);
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
