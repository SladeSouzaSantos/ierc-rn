import {createHash} from 'node:crypto';
import {load} from 'cheerio';

/**
 * This is an evidence reader, not a general-purpose web scraper.
 * It is deliberately disabled for sources without documented permission.
 * The current catalog grants no site an automated full-text access policy.
 */
export class ArticleEvidenceError extends Error {
  constructor(reason){super(reason);this.name='ArticleEvidenceError';this.reason=reason;}
}
const deny=reason=>{throw new ArticleEvidenceError(reason);};
const norm=s=>String(s||'').replace(/\s+/g,' ').trim();
const MAX_BYTES=340000;
const MAX_TEXT=12000;
const validArticleUrl=(value,source)=>{
  let u;
  try{u=new URL(value);}catch{return null;}
  if(u.protocol!=='https:'||u.hostname!==source.hostname||
     u.username||u.password||u.port||u.hash||u.pathname==='/'||
     u.pathname==='/feed/'||u.pathname.length>240)
    return null;
  return u;
};
function authorized(source){
  const p=source?.fullTextAccess;
  if(source?.previewOnly===true||source?.mode!=='rss'||p?.status!=='approved'||
     typeof p.reference!=='string'||!/^https:\/\//.test(p.reference)||
     !/^\d{4}-\d{2}-\d{2}$/.test(p.verifiedDate||''))
    deny('source_permission_pending');
  // Agência Brasil publicly allows journalistic syndication of its own copy.
  // Partner-agency copy still requires per-article screening and is excluded.
  const ebc=Object.entries({
    'agencia-brasil-direitos':'direitos-humanos',
    'agencia-brasil-educacao':'educacao',
    'agencia-brasil-esportes':'esportes',
    'agencia-brasil-internacional':'internacional',
  }).some(([id,section])=>source.id===id&&source.section===section);
  if(ebc&&source.hostname==='agenciabrasil.ebc.com.br'&&
     p.basis==='published-reproduction-policy'&&
     p.reference==='https://agenciabrasil.ebc.com.br/sobre'&&
     p.usage==='journalistic-noncommercial')
    return {agencyBrasil:true,licenseReference:p.reference};
  if(['perkins','w3c-wai'].includes(source.id)&&
     source.hostname===({perkins:'www.perkins.org','w3c-wai':'www.w3.org'})[source.id]&&
     p.basis==='written-permission')
    return {agencyBrasil:false,licenseReference:p.reference};
  deny('source_permission_pending');
}
function verifyArticleRights(html,source,access){
  if(!access.agencyBrasil)return;
  const $=load(html);
  const author=$('.autor-noticia').first().text().replace(/\s+/g,' ').trim();
  const body=$('.conteudo-noticia').first().text().replace(/\s+/g,' ').trim();
  const path=new URL(source.url);
  if(!new RegExp('^/'+source.section+'/noticia/\\d{4}-\\d{2}/[a-z0-9-]+/?
async function boundedHtml(response){
  const type=(response.headers.get('content-type')||'').toLowerCase();
  if(!/^text\/html(?:\s*;|$)/.test(type))deny('article_not_html');
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>MAX_BYTES)deny('article_too_large');
  if(!response.body||typeof response.body.getReader!=='function')deny('article_body_unavailable');
  const reader=response.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:false});
  let result='',bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX_BYTES)deny('article_too_large');
      result+=decoder.decode(value,{stream:true});
    }
    result+=decoder.decode();
  }finally{
    if(bytes>MAX_BYTES)await reader.cancel().catch(()=>{});
    try{reader.releaseLock();}catch{}
  }
  return result;
}
export function extractArticleEvidence(html,{sourceUrl,sourceId}){
  if(typeof html!=='string'||html.length>MAX_BYTES)deny('article_too_large');
  const $=load(html);
  $('script,style,template,noscript,svg,iframe,form,nav,aside,footer,header,canvas,video,audio,figure,.share,.social,.related,.newsletter,.cookie-banner').remove();
  const containers=['.conteudo-noticia','main article','.entry-content','.wp-block-post-content','article','.post-content','main'];
  let nodes=[];
  for(const selector of containers){
    const container=$(selector).first();
    if(!container.length)continue;
    const found=[];
    container.find('h2,h3,p,li').each((_,el)=>{
      if($(el).parents('p,li,h2,h3').length)return;
      const text=norm($(el).text());
      if(text.length>=25&&text.length<=1100)found.push(text);
    });
    if(found.length>=3&&found.reduce((s,v)=>s+v.length,0)>=400){
      nodes=found;break;
    }
  }
  if(!nodes.length)deny('article_text_incomplete');
  let total=0;
  const blocks=[];
  for(const paragraph of nodes){
    total+=paragraph.length;
    if(total>MAX_TEXT||blocks.length>=45)deny('article_text_incomplete');
    blocks.push(Object.freeze({id:'E'+String(blocks.length+1).padStart(2,'0'),text:paragraph}));
  }
  // Exact page title and text are transient: do not send them to logs or CMS.
  const digest=createHash('sha256').update(blocks.map(b=>b.id+'\0'+b.text).join('\n')).digest('hex');
  return Object.freeze({verified:true,mode:'full_article',sourceId,sourceUrl,
    digest,blocks:Object.freeze(blocks),characters:total});
}
export async function fetchArticleEvidence(source,article,{fetchImpl=fetch}={}){
  const access=authorized(source);
  const approved=validArticleUrl(article?.url,source);
  if(!approved)deny('article_url_invalid');
  const request=async url=>{
    let response;
    try{
      response=await fetchImpl(url,{
        method:'GET',headers:{Accept:'text/html','User-Agent':'IERC-RN-Editorial-Evidence/0.1'},
        redirect:'manual',signal:AbortSignal.timeout(11000),
      });
    }catch{deny('article_unavailable');}
    return response;
  };
  let response=await request(approved.toString());
  if([301,302,303,307,308].includes(response.status)){
    let next;
    try{next=new URL(response.headers.get('location'),approved);}
    catch{deny('article_redirect_blocked');}
    const normalized=path=>path.replace(/\/+$/,'')||'/';
    if(!validArticleUrl(next.toString(),source)||next.search!==approved.search||
       normalized(next.pathname)!==normalized(approved.pathname))
      deny('article_redirect_blocked');
    response=await request(next.toString());
    if([301,302,303,307,308].includes(response.status))deny('article_redirect_blocked');
  }
  if(!response.ok)deny('article_http_error');
  const html=await boundedHtml(response);
  verifyArticleRights(html,{...source,url:article.url},access);
  const result=extractArticleEvidence(html,{sourceUrl:article.url,sourceId:source.id});
  return Object.freeze({...result,licenseReference:access.licenseReference});
}
export function sanitizeArticleEvidenceError(error){
  return error instanceof ArticleEvidenceError?error.reason:'article_unavailable';
}
).test(path.pathname)||
     !body||body.length<400||
     !/(?:Ag[eê]ncia Brasil|Rep[oó]rter(?:a)? da (?:EBC|Ag[eê]ncia Brasil)|EBC - Empresa Brasil de Comunica[cç][aã]o)/i.test(author)||
     /\b(?:Reuters|Associated Press|AFP|AP News|Ansa|EFE)\b/i.test(author)||
     /(?:[eé]\s+proibida\s+a\s+reprodu[cç][aã]o\s+deste\s+conte[uú]do|a\s+republica[cç][aã]o\s+de\s+mat[eé]rias\s+e\s+imagens\s+de\s+parceiros\s+[eé]\s+proibida)/i.test(body))
    deny('article_rights_unverified');
}
async function boundedHtml(response){
  const type=(response.headers.get('content-type')||'').toLowerCase();
  if(!/^text\/html(?:\s*;|$)/.test(type))deny('article_not_html');
  const declared=Number(response.headers.get('content-length')||0);
  if(declared>MAX_BYTES)deny('article_too_large');
  if(!response.body||typeof response.body.getReader!=='function')deny('article_body_unavailable');
  const reader=response.body.getReader();
  const decoder=new TextDecoder('utf-8',{fatal:false});
  let result='',bytes=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      bytes+=value.byteLength;
      if(bytes>MAX_BYTES)deny('article_too_large');
      result+=decoder.decode(value,{stream:true});
    }
    result+=decoder.decode();
  }finally{
    if(bytes>MAX_BYTES)await reader.cancel().catch(()=>{});
    try{reader.releaseLock();}catch{}
  }
  return result;
}
export function extractArticleEvidence(html,{sourceUrl,sourceId}){
  if(typeof html!=='string'||html.length>MAX_BYTES)deny('article_too_large');
  const $=load(html);
  $('script,style,template,noscript,svg,iframe,form,nav,aside,footer,header,canvas,video,audio,figure,.share,.social,.related,.newsletter,.cookie-banner').remove();
  const containers=['main article','.entry-content','.wp-block-post-content','article','.post-content','main'];
  let nodes=[];
  for(const selector of containers){
    const container=$(selector).first();
    if(!container.length)continue;
    const found=[];
    container.find('h2,h3,p,li').each((_,el)=>{
      if($(el).parents('p,li,h2,h3').length)return;
      const text=norm($(el).text());
      if(text.length>=25&&text.length<=1100)found.push(text);
    });
    if(found.length>=3&&found.reduce((s,v)=>s+v.length,0)>=400){
      nodes=found;break;
    }
  }
  if(!nodes.length)deny('article_text_incomplete');
  let total=0;
  const blocks=[];
  for(const paragraph of nodes){
    total+=paragraph.length;
    if(total>MAX_TEXT||blocks.length>=45)deny('article_text_incomplete');
    blocks.push(Object.freeze({id:'E'+String(blocks.length+1).padStart(2,'0'),text:paragraph}));
  }
  // Exact page title and text are transient: do not send them to logs or CMS.
  const digest=createHash('sha256').update(blocks.map(b=>b.id+'\0'+b.text).join('\n')).digest('hex');
  return Object.freeze({verified:true,mode:'full_article',sourceId,sourceUrl,
    digest,blocks:Object.freeze(blocks),characters:total});
}
export async function fetchArticleEvidence(source,article,{fetchImpl=fetch}={}){
  authorized(source);
  const approved=validArticleUrl(article?.url,source);
  if(!approved)deny('article_url_invalid');
  const request=async url=>{
    let response;
    try{
      response=await fetchImpl(url,{
        method:'GET',headers:{Accept:'text/html','User-Agent':'IERC-RN-Editorial-Evidence/0.1'},
        redirect:'manual',signal:AbortSignal.timeout(11000),
      });
    }catch{deny('article_unavailable');}
    return response;
  };
  let response=await request(approved.toString());
  if([301,302,303,307,308].includes(response.status)){
    let next;
    try{next=new URL(response.headers.get('location'),approved);}
    catch{deny('article_redirect_blocked');}
    const normalized=path=>path.replace(/\/+$/,'')||'/';
    if(!validArticleUrl(next.toString(),source)||next.search!==approved.search||
       normalized(next.pathname)!==normalized(approved.pathname))
      deny('article_redirect_blocked');
    response=await request(next.toString());
    if([301,302,303,307,308].includes(response.status))deny('article_redirect_blocked');
  }
  if(!response.ok)deny('article_http_error');
  const html=await boundedHtml(response);
  const result=extractArticleEvidence(html,{sourceUrl:article.url,sourceId:source.id});
  return result;
}
export function sanitizeArticleEvidenceError(error){
  return error instanceof ArticleEvidenceError?error.reason:'article_unavailable';
}
