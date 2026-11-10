const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {resolve,join}=require('node:path');
const {mkdtempSync,mkdirSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
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

test('directory-based schema comparison detects additive dedupeKey without a PowerShell pipeline',async()=>{
 const {models}=await import('../schemas.mjs');
 const root=mkdtempSync(join(tmpdir(),'ierc-schema-test-'));
 try{
   for(const [name,model] of Object.entries(models)){
     const dest=join(root,name,'content-types',name);
     mkdirSync(dest,{recursive:true});
     const snapshot=structuredClone(model);
     if(name==='news-article')delete snapshot.attributes.dedupeKey;
     writeFileSync(join(dest,'schema.json'),JSON.stringify(snapshot),'utf8');
   }
   const child=spawnSync(process.execPath,[runner,'--schema-root',root],{
     encoding:'utf8',timeout:5000,
   });
   assert.equal(child.status,0,child.stderr);
   assert.equal(child.stderr,'');
   const result=JSON.parse(child.stdout);
   assert.equal(result.status,'additions_only');
   assert.deepEqual(result.additions,[{model:'news-article',field:'dedupeKey',type:'string'}]);
   assert.deepEqual(result.hazards,[]);
   assert.equal(result.databaseSchemaNotChecked,true);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('directory-based comparison blocks changed deployed field definitions',async()=>{
 const {models}=await import('../schemas.mjs');
 const root=mkdtempSync(join(tmpdir(),'ierc-schema-test-'));
 try{
   for(const [name,model] of Object.entries(models)){
     const dest=join(root,name,'content-types',name);
     mkdirSync(dest,{recursive:true});
     const snapshot=structuredClone(model);
     if(name==='news-article')snapshot.attributes.summary={type:'integer'};
     writeFileSync(join(dest,'schema.json'),JSON.stringify(snapshot),'utf8');
   }
   const child=spawnSync(process.execPath,[runner,'--schema-root',root],{encoding:'utf8',timeout:5000});
   assert.equal(child.status,3,child.stderr);
   const result=JSON.parse(child.stdout);
   assert.equal(result.status,'manual_review_required');
   assert.ok(result.hazards.some(x=>x.type==='changed_attribute'&&x.field==='summary'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('empty directory and invalid JSON snapshots fail closed without showing path',()=>{
 const root=mkdtempSync(join(tmpdir(),'ierc-schema-private-'));
 try{
   const child=spawnSync(process.execPath,[runner,'--schema-root',root],{encoding:'utf8',timeout:5000});
   assert.equal(child.status,2);
   assert.equal(child.stdout,'');
   assert.equal(JSON.parse(child.stderr).status,'invalid_snapshot');
   assert.ok(!child.stderr.includes(root));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('stdin snapshot tolerates UTF-8 BOM',async()=>{
 const {models}=await import('../schemas.mjs');
 const result=await check('\uFEFF'+JSON.stringify(models));
 assert.equal(result.code,0);
 assert.equal(result.out.status,'additions_only');
 assert.deepEqual(result.out.additions,[]);
});
