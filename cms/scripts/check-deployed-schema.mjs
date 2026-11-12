/**
 * Read-only comparison of CMS schemas from a DEV container snapshot
 * against the source-controlled model declarations. This does NOT inspect the
 * PostgreSQL catalog and does NOT approve or perform a schema migration.
 *
 * Preferred usage on Windows / PowerShell:
 *   docker cp <cms-container-id>:/opt/app/src/api <temporary-folder>
 *   node cms/scripts/check-deployed-schema.mjs --schema-root <temporary-folder>/api
 *
 * JSON via stdin remains available for scripted/Linux use. Native stdout
 * pipelines may corrupt or transcode structured JSON in Windows PowerShell.
 */
import {readFileSync, readdirSync, statSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {models as target} from '../schemas.mjs';

const own=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);
const normalized=value=>JSON.stringify(value,(_key,v)=>
  v&&typeof v==='object'&&!Array.isArray(v)
    ? Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))) : v);
function compare(current, desired=target){
  const additions=[];const hazards=[];
  for(const name of Object.keys(current)){
    if(!own(desired,name))hazards.push({type:'deployed_content_type_missing_from_source',model:name});
  }
  for(const [name,source] of Object.entries(desired)){
    const live=current[name];
    if(!live){hazards.push({type:'source_content_type_not_deployed',model:name});continue;}
    for(const key of ['kind','collectionName']){
      if(live[key]!==source[key])hazards.push({type:'model_identity_change',model:name,field:key});
    }
    for(const key of ['singularName','pluralName']){
      if(live.info?.[key]!==source.info?.[key])
        hazards.push({type:'api_identity_change',model:name,field:key});
    }
    if(normalized(live.options)!==normalized(source.options))
      hazards.push({type:'model_options_change',model:name});
    const old=live.attributes||{};
    const expected=source.attributes||{};
    for(const [field,definition] of Object.entries(old)){
      if(!own(expected,field))hazards.push({type:'removed_attribute',model:name,field});
      else if(normalized(definition)!==normalized(expected[field]))
        hazards.push({type:'changed_attribute',model:name,field});
    }
    for(const [field,definition] of Object.entries(expected)){
      if(own(old,field))continue;
      additions.push({model:name,field,type:definition?.type||'unknown'});
      if(definition?.required===true || definition?.type==='relation' || definition?.type==='component')
        hazards.push({type:'new_field_requires_manual_review',model:name,field});
    }
  }
  return {status:hazards.length?'manual_review_required':'additions_only',
    additions,hazards,readOnly:true,databaseSchemaNotChecked:true};
}
const MAX_SNAPSHOT_BYTES=3_000_000;
function schemasFromDirectory(schemaRoot){
  if(!statSync(schemaRoot).isDirectory())throw new Error('not_a_directory');
  const schemas={};
  let totalBytes=0;
  for(const entry of readdirSync(schemaRoot,{withFileTypes:true})){
    if(!entry.isDirectory())continue;
    const name=entry.name;
    if(!/^[a-z][a-z0-9-]*$/.test(name))throw new Error('invalid_model_directory');
    const path=join(schemaRoot,name,'content-types',name,'schema.json');
    if(!existsSync(path))continue;
    const bytes=readFileSync(path);
    totalBytes+=bytes.length;
    if(totalBytes>MAX_SNAPSHOT_BYTES)throw new Error('oversized_snapshot');
    schemas[name]=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
  }
  if(!Object.keys(schemas).length)throw new Error('no_schemas_found');
  return schemas;
}
function schemasFromStdin(){
  const bytes=readFileSync(0);
  if(!bytes.length)throw new Error('empty_stdin');
  if(bytes.length>MAX_SNAPSHOT_BYTES)throw new Error('oversized_snapshot');
  return JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
}
try{
  const args=process.argv.slice(2);
  const fromDirectory=args.length===2&&args[0]==='--schema-root'&&args[1].trim();
  if(args.length&&!fromDirectory)throw new Error('invalid_arguments');
  const snapshot=fromDirectory?schemasFromDirectory(args[1]):schemasFromStdin();
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
    throw new Error('invalid_schema_mapping');
  const outcome=compare(snapshot);
  console.log(JSON.stringify(outcome));
  process.exitCode=outcome.hazards.length?3:0;
}catch{
  // Do not echo paths, raw JSON or exception messages; fail closed.
  console.error(JSON.stringify({status:'invalid_snapshot',readOnly:true}));
  process.exitCode=2;
}
