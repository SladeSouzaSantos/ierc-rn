const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {resolve}=require('node:path');
const runner=resolve(__dirname,'../scripts/check-deployed-schema.mjs');
async function check(input){
  const child=spawnSync(process.execPath,[runner],{
    input:typeof input==='string'?input:JSON.stringify(input),
    encoding:'utf8',timeout:5000
  });
  assert.equal(child.error,undefined);
  return {code:child.status,out:child.stdout?JSON.parse(child.stdout):null,
    err:child.stderr?JSON.parse(child.stderr):null};
}
test('current deployed schema with only missing dedupeKey is flagged as additive',async()=>{
  const {models}=await import('../schemas.mjs');
  const current=structuredClone(models);
  delete current['news-article'].attributes.dedupeKey;
  const result=await check(current);
  assert.equal(result.code,0);
  assert.equal(result.out.status,'additions_only');
  assert.deepEqual(result.out.additions,
    [{model:'news-article',field:'dedupeKey',type:'string'}]);
  assert.equal(result.out.hazards.length,0);
  assert.equal(result.out.readOnly,true);
  assert.equal(result.out.databaseSchemaNotChecked,true);
});
test('preflight stops on schema field removals or changed existing attributes',async()=>{
  const {models}=await import('../schemas.mjs');
  const current=structuredClone(models);
  current['news-article'].attributes.sourceUrl={type:'integer'};
  current['event'].attributes.deployedOnlyField={type:'string'};
  const result=await check(current);
  assert.equal(result.code,3);
  assert.equal(result.out.status,'manual_review_required');
  assert.ok(result.out.hazards.some(x=>x.type==='changed_attribute'&&x.field==='sourceUrl'));
  assert.ok(result.out.hazards.some(x=>x.type==='removed_attribute'&&x.field==='deployedOnlyField'));
});
test('preflight fails closed when input cannot be parsed',async()=>{
  const result=await check('not-a-json-document');
  assert.equal(result.code,2);
  assert.equal(result.out,null);
  assert.equal(result.err.status,'invalid_snapshot');
});
