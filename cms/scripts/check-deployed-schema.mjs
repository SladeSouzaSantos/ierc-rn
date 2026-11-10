/**
 * Read-only comparison of CMS schemas from a running DEV container (stdin)
 * against the source-controlled model declarations. This does NOT inspect the
 * PostgreSQL catalog and does NOT approve or perform a schema migration.
 *
 * Host usage:
 *   docker compose ... exec -T cms node -e "<emit JSON schemas>" |
 *     node cms/scripts/check-deployed-schema.mjs
 */
import {readFileSync} from 'node:fs';
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
let snapshot;
try {
  const input=readFileSync(0,'utf8');
  if(input.length>3_000_000)throw new Error('oversized snapshot');
  snapshot=JSON.parse(input);
  if(!snapshot||typeof snapshot!=='object'||Array.isArray(snapshot))
    throw new Error('invalid schema mapping');
  const outcome=compare(snapshot);
  console.log(JSON.stringify(outcome));
  process.exitCode=outcome.hazards.length?3:0;
}catch{
  console.error(JSON.stringify({status:'invalid_snapshot',readOnly:true}));
  process.exitCode=2;
}
