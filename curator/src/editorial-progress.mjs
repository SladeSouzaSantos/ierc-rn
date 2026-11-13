import {createCipheriv,createDecipheriv,createHash,createHmac,randomBytes}
  from 'node:crypto';
import {validateDraft} from './editorial.mjs';

const TTL_SECONDS=14*24*60*60;
const FIELDS=['title','summary','body','whyItMatters','category'];
const sha=s=>createHash('sha256').update(s).digest('hex');

export function editorialProgressFingerprint({documentId,dedupeKey,original,evidence}){
  if(!/^[a-zA-Z0-9]{12,90}$/.test(documentId||'')||
     !/^[a-f0-9]{64}$/.test(dedupeKey||'')||
     !/^[a-f0-9]{64}$/.test(evidence?.digest||'')||
     evidence?.verified!==true||evidence?.mode!=='full_article')
    throw new Error('Editorial progress requires licensed full article and documentId');
  const base=validateDraft(JSON.stringify(original));
  if(!base||FIELDS.some(k=>base[k]!==original?.[k]))
    throw new Error('Editorial progress original Draft failed integrity check');
  return {
    documentId,dedupeKey,evidenceDigest:evidence.digest,
    originalDigest:sha(JSON.stringify(FIELDS.map(k=>base[k]))),
  };
}

const sanitizedNotes=list=>{
  if(!Array.isArray(list)||list.length>8||list.some(v=>typeof v!=='string'))
    throw new Error('Invalid private editorial notes');
  return list.slice(0,4).map(v=>v.trim().slice(0,240));
};
const normalizeAssessment=input=>{
  if(!input)return null;
  if(input.decision!=='hold'||input.factualSupport!=='insufficient'||
     !Array.isArray(input.issues)||!Array.isArray(input.unsupportedClaims))
    throw new Error('Invalid private editorial objection');
  return {decision:'hold',factualSupport:'insufficient',
    issues:sanitizedNotes(input.issues),
    unsupportedClaims:sanitizedNotes(input.unsupportedClaims)};
};
function normalizeProgress(progress){
  if(!progress||!['review','repair','terminal'].includes(progress.phase)||
     !Number.isInteger(progress.correctionsDone)||
     progress.correctionsDone<0||progress.correctionsDone>2||
     !Array.isArray(progress.history)||progress.history.length>3)
    throw new Error('Invalid editorial progress');
  const draft=validateDraft(JSON.stringify(progress.draft));
  if(!draft||FIELDS.some(k=>draft[k]!==progress.draft?.[k]))
    throw new Error('Invalid stored editorial draft');
  const history=progress.history.map(h=>{
    if(!Number.isInteger(h.afterCorrection)||
       h.afterCorrection<0||h.afterCorrection>progress.correctionsDone)
      throw new Error('Invalid stored editorial history');
    return {
      afterCorrection:h.afterCorrection,
      issues:sanitizedNotes(h.issues),
      unsupportedClaims:sanitizedNotes(h.unsupportedClaims),
    };
  });
  const assessment=normalizeAssessment(progress.assessment);
  if(progress.phase==='repair'&&(!assessment||
     progress.correctionsDone>=2))
    throw new Error('Invalid repair-stage editorial objection');
  if(progress.phase!=='repair'&&assessment!==null)
    throw new Error('Unreviewed private editorial objection');
  return {phase:progress.phase,correctionsDone:progress.correctionsDone,
    draft,assessment,history};
}

/**
 * AES-256-GCM encrypted, short-lived progress held ONLY in private DEV Redis.
 * No original news-source paragraphs, CMS tokens, or provider credentials
 * are persisted. AAD binds the ciphertext to EXACT original CMS text,
 * source URL hash and freshly verified full-article evidence digest.
 *
 * Explicit secret is mandatory. Do not reuse LLM/CMS API keys.
 */
export function encryptedEditorialProgressStore({
  redis,secret,instanceKind,
}={}){
  if(instanceKind!=='dev')
    throw new Error('Encrypted progress is DEV-only until separately homologated');
  if(typeof secret!=='string'||!/^[a-fA-F0-9]{64}$/.test(secret))
    throw new Error('CURATOR_EDITORIAL_PROGRESS_KEY must be 32 random bytes (hex)');
  if(!redis||!['get','set','del'].every(k=>typeof redis[k]==='function'))
    throw new Error('Private Redis progress requires GET/SET/DEL');
  const key=Buffer.from(secret,'hex');
  const keyFor=f=>'ierc:curator:editorial:v1:'+
    createHmac('sha256',key).update(f.documentId).digest('hex');
  const aad=f=>Buffer.from(JSON.stringify([
    1,f.documentId,f.dedupeKey,f.originalDigest,f.evidenceDigest,
  ]),'utf8');
  return {
    async load(fingerprint){
      const entry=await redis.get(keyFor(fingerprint));
      if(entry===null)return null;
      try{
        if(typeof entry!=='string'||entry.length>17000)
          throw new Error('Invalid encrypted progress');
        const box=JSON.parse(entry);
        if(box?.v!==1||!/^[a-f0-9]{24}$/.test(box.iv||'')||
           !/^[a-f0-9]{32}$/.test(box.tag||'')||
           !/^[a-f0-9]{2,30000}$/.test(box.ciphertext||''))
          throw new Error('Invalid encrypted progress');
        const decipher=createDecipheriv('aes-256-gcm',key,
          Buffer.from(box.iv,'hex'));
        decipher.setAAD(aad(fingerprint));
        decipher.setAuthTag(Buffer.from(box.tag,'hex'));
        const plaintext=Buffer.concat([
          decipher.update(Buffer.from(box.ciphertext,'hex')),decipher.final(),
        ]).toString('utf8');
        return normalizeProgress(JSON.parse(plaintext));
      }catch{
        // Fail closed: no revision restored and NO publication attempt.
        // Never log ciphertext, CMS content or decryption error.
        throw new Error('Private editorial progress integrity failed');
      }
    },
    async save(fingerprint,progress){
      const safe=normalizeProgress(progress);
      const iv=randomBytes(12);
      const cipher=createCipheriv('aes-256-gcm',key,iv);
      cipher.setAAD(aad(fingerprint));
      const ciphertext=Buffer.concat([
        cipher.update(JSON.stringify(safe),'utf8'),cipher.final(),
      ]);
      const box=JSON.stringify({v:1,iv:iv.toString('hex'),
        tag:cipher.getAuthTag().toString('hex'),
        ciphertext:ciphertext.toString('hex')});
      await redis.set(keyFor(fingerprint),box,'EX',TTL_SECONDS);
    },
    async clear(fingerprint){
      await redis.del(keyFor(fingerprint));
    },
  };
}
