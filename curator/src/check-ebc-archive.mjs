/**
 * Operator-only EBC archive check. This is NOT the scheduled AI worker.
 * No CMS, no Redis, no LLM, no local writes, no automatic publication.
 */
import {inspectEbcArchive} from './ebc-archive.mjs';

const options={};
for(const arg of process.argv.slice(2)){
  const [name,value,extra]=arg.split('=');
  if(extra!==undefined||!value)throw new Error('Invalid read-only archive arguments');
  if(name==='--section')options.section=value;
  else if(name==='--pages')options.pages=Number(value);
  else if(name==='--max-evidence')options.maxEvidence=Number(value);
  else throw new Error('Unsupported archive argument');
}
await inspectEbcArchive(options);
