import {
  createCipheriv,createDecipheriv,createHash,createHmac,randomBytes,
} from 'node:crypto';
import {validateDraft} from './editorial.mjs';

const FIELDS=['title','summary','body','whyItMatters','category'];
const sha=v=>createHash('sha256').update(v).digest('hex');
const NOTE_LIMIT=240;
const DAYS_45=45*86400;
function notes(values){
  if(!Array.isArray(values)||values.length>8||
     values.some(x=>typeof x!=='string'||x.length>1200))
    throw new Error('Invalid private audit feedback');
  return values.slice(0,4).map(x=>x.trim().slice(0,NOTE_LIMIT));
}
function normalizedAssessment(a){
  if(a===null||a===undefined)return null;
  if(a.decision!=='hold'||a.factualSupport!=='insufficient')
    throw new Error('Invalid private audit assessment');
  return {decision:'hold',factualSupport:'insufficient',
    issues:notes(a.issues),unsupportedClaims:notes(a.unsupportedClaims)};
}
function normalizedRecord(record){
  if(!record||!['review','repair','terminal','published'].includes(record.phase)||
     !Number.isInteger(record.correctionsDone)||record.correctionsDone<0||
     record.correctionsDone>2||
     !['in_progress','ai_review_hold','rewrite_unavailable',
       'review_unavailable','unchanged_draft','insufficient_evidence',
       'source_claims_unverified','approved','publication_failed',
       'published'].includes(record.outcome)||
     !Array.isArray(record.history)||record.history.length>3)
    throw new Error('Invalid private audit state');
  const draft=validateDraft(JSON.stringify(record.draft));
  if(!draft||FIELDS.some(k=>draft[k]!==record.draft?.[k]))
    throw new Error('Private audit corrected draft failed validation');
  const history=record.history.map(h=>{
    if(!Number.isInteger(h.afterCorrection)||h.afterCorrection<0||
       h.afterCorrection>record.correctionsDone)
      throw new Error('Invalid private audit history');
    return {afterCorrection:h.afterCorrection,issues:notes(h.issues),
      unsupportedClaims:notes(h.unsupportedClaims)};
  });
  const assessment=normalizedAssessment(record.assessment);
  if(record.phase==='repair'&&assessment===null)
    throw new Error('Private repair assessment missing');
  if(record.phase==='published'&&record.outcome!=='published')
    throw new Error('Inconsistent editorial audit publication');
  if(record.outcome==='published'&&record.phase!=='published')
    throw new Error('Inconsistent editorial audit status');
  return {phase:record.phase,outcome:record.outcome,
    correctionsDone:record.correctionsDone,draft,assessment,history};
}
export function prodEditorialAuditFingerprint({
  documentId,dedupeKey,original,evidence,revision,
}={}){
  if(!/^[A-Za-z0-9]{12,90}$/.test(documentId||'')||
     !/^[a-f0-9]{64}$/.test(dedupeKey||'')||
     !/^[a-f0-9]{64}$/.test(evidence?.digest||'')||
     !/^[a-f0-9]{64}$/.test(revision||'')||
     evidence?.verified!==true||evidence?.mode!=='full_article')
    throw new Error('PROD audit requires verified full-article evidence');
  const content=validateDraft(JSON.stringify(original));
  if(!content||FIELDS.some(k=>content[k]!==original[k]))
    throw new Error('PROD audit requires an unchanged canonical proposal');
  if(sha(JSON.stringify(FIELDS.map(k=>content[k])))!==revision)
    throw new Error('PROD audit revision fingerprint mismatch');
  return Object.freeze({documentId,dedupeKey,
    originalDigest:revision,evidenceDigest:evidence.digest});
}

/** AES-256-GCM, dedicated PROD key, independent of DEV's progress key.
 *  AAD ties each record to the exact source/evidence and proposal revision.
 *  No source blocks, keys, provider raw output, or plaintext notes in Redis.
 *  Only the scoped operator CLI can decrypt; no public API is introduced.
 */
export function encryptedProdEditorialAudit({redis,secret,instanceKind}={}){
  if(instanceKind!=='prod')
    throw new Error('PROD audit refuses non-production instance');
  if(!/^[0-9a-fA-F]{64}$/.test(secret||''))
    throw new Error('Dedicated CURATOR_PROD_EDITORIAL_AUDIT_KEY required (32 random bytes, hex)');
  if(!redis||['get','set'].some(name=>typeof redis[name]!=='function'))
    throw new Error('PROD audit Redis client unavailable');
  const key=Buffer.from(secret,'hex');
  const keyFor=f=>'ierc:curator:prod-editorial-audit:v1:'+
    createHmac('sha256',key).update(JSON.stringify([
      f.documentId,f.originalDigest,f.evidenceDigest,
    ])).digest('hex');
  const aad=f=>Buffer.from(JSON.stringify([
    1,'prod',f.documentId,f.dedupeKey,f.originalDigest,f.evidenceDigest,
  ]));
  function validateFingerprint(f){
    if(!/^[a-zA-Z0-9]{12,90}$/.test(f?.documentId||'')||
       ![f.dedupeKey,f.originalDigest,f.evidenceDigest]
         .every(x=>/^[a-f0-9]{64}$/.test(x||'')))
      throw new Error('Invalid PROD audit fingerprint');
  }
  return {
    async save(fingerprint,record){
      validateFingerprint(fingerprint);
      const safe=normalizedRecord(record);
      const iv=randomBytes(12);
      const cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(aad(fingerprint));
      const ciphertext=Buffer.concat([
        cipher.update(JSON.stringify(safe),'utf8'),cipher.final(),
      ]);
      const payload=JSON.stringify({v:1,iv:iv.toString('hex'),
        tag:cipher.getAuthTag().toString('hex'),
        ciphertext:ciphertext.toString('hex')});
      if(payload.length>20000)
        throw new Error('Private audit record exceeds safe size');
      await redis.set(keyFor(fingerprint),payload,'EX',DAYS_45);
    },
    async load(fingerprint){
      validateFingerprint(fingerprint);
      const raw=await redis.get(keyFor(fingerprint));
      if(raw===null)return null;
      try{
        if(typeof raw!=='string'||raw.length>20000)
          throw new Error('Invalid encrypted audit blob');
        const v=JSON.parse(raw);
        if(v.v!==1||!/^[0-9a-f]{24}$/.test(v.iv||'')||
           !/^[0-9a-f]{32}$/.test(v.tag||'')||
           !/^[0-9a-f]{2,30000}$/.test(v.ciphertext||''))
          throw new Error('Invalid encrypted audit envelope');
        const decipher=createDecipheriv('aes-256-gcm',key,
          Buffer.from(v.iv,'hex'));
        decipher.setAAD(aad(fingerprint));
        decipher.setAuthTag(Buffer.from(v.tag,'hex'));
        const plain=Buffer.concat([
          decipher.update(Buffer.from(v.ciphertext,'hex')),
          decipher.final(),
        ]).toString('utf8');
        return normalizedRecord(JSON.parse(plain));
      }catch{
        throw new Error('Private PROD audit integrity failed');
      }
    },
  };
}
