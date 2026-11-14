import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cmsPublisher} from './cms-publish.mjs';
import {fetchArticleEvidence} from './article-evidence.mjs';
import {createPacedEbcFetch} from './ebc-archive-worker.mjs';
import {prepareEnemEditorialPublication,publishEnemHumanReviewed}
  from './enem-human-publication.mjs';

async function main(){
  const env=process.env;
  const mode=process.argv[2],digest=process.argv[3];
  if(env.CURATOR_INSTANCE_KIND!=='dev'||
     env.CURATOR_ENABLED!=='true'||env.CURATOR_WRITE_DRAFTS!=='true'||
     !['preview','publish'].includes(mode)||
     (mode==='preview'&&process.argv.length!==3)||
     (mode==='publish'&&(process.argv.length!==4||
       !/^[a-f0-9]{64}$/.test(digest||''))))
    throw new Error('DEV-only explicit editorial preview or digest approval required');
  const cmsUrl=env.CURATOR_CMS_URL||'http://cms:1337';
  const token=env.CURATOR_STRAPI_PUBLISH_TOKEN;
  const publisher=cmsPublisher({baseUrl:cmsUrl,token,
    draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN});
  const articleReader=(source,article)=>fetchArticleEvidence(source,article,{
    fetchImpl:createPacedEbcFetch(fetch),
  });
  if(mode==='preview'){
    const {preview}=await prepareEnemEditorialPublication({publisher,articleReader});
    console.log(JSON.stringify(preview,null,2));
    return;
  }
  const result=await publishEnemHumanReviewed({publisher,articleReader,
    token,draftToken:env.CURATOR_STRAPI_DRAFT_TOKEN,baseUrl:cmsUrl,
    approvalDigest:digest});
  console.log(JSON.stringify(result));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main().catch(e=>{
    const allowed=[
      'DEV-only explicit editorial preview or digest approval required',
      'ENEM DEV document or source does not match reviewed candidate',
      'Licensed EBC article evidence changed or cannot be verified',
      'Manual editorial proposal must be complete and canonical',
      'Explicit human approval digest and distinct publisher token required',
      'Editorial approval digest mismatch; do not publish',
      'Draft changed after approval; refusing publication',
      'CMS did not confirm exact human-reviewed publication',
      'Published CMS read-back did not match reviewed content',
      'Article is already published',
      'Draft is not an unchanged AI-review-pending candidate',
    ];
    const label=allowed.includes(e?.message)?e.message:
      'DEV editorial publication unavailable; check private CMS, evidence and permissions';
    console.error('ENEM_EDITORIAL_PUBLICATION_DENIED: '+label);
    process.exitCode=1;
  });
}
