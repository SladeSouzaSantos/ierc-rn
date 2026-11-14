#!/usr/bin/env node
// Administrative provisioning for Asaas monthly DONATION links.
// Sandbox only. No API/secret is included in the portal or in Git.
// Live payment links must be provisioned by an authorized officer in the
// IERC's approved Asaas account and then configured server-side.
const API='https://api-sandbox.asaas.com/v3/paymentLinks';
const AMOUNTS=[20,50,100,'custom'];
const METHODS=[
  {id:'pix',billingType:'PIX'},
  {id:'credit',billingType:'CREDIT_CARD'},
];
export function plannedLinks(){
  return METHODS.flatMap(method=>AMOUNTS.map(amount=>({
    method:method.id,amount,
    payload:{
      billingType:method.billingType,
      chargeType:'RECURRENT',subscriptionCycle:'MONTHLY',
      name:amount==='custom'
        ? 'Doação mensal IERC-RN - outro valor'
        : 'Doação mensal IERC-RN - R$ '+amount.toFixed(2).replace('.',','),
      description:'Contribuição mensal voluntária ao IERC-RN. Para cancelar, entre em contato com o Instituto.',
      ...(amount==='custom'?{}:{value:amount}),notificationEnabled:true,
      externalReference:'iercrn-donation-'+method.id+'-'+amount,
    },
  })));
}
function validSandboxUrl(value){
  try{
    const u=new URL(value);
    return u.protocol==='https:'&&
      ['sandbox.asaas.com','www.asaas.com'].includes(u.hostname)&&
      !u.username&&!u.password&&!u.search&&!u.hash;
  }catch{return false;}
}
export async function createSandboxLinks({key,fetchImpl=fetch}){
  if(typeof key!=='string'||key.length<20)
    throw new Error('Sandbox API key required; never print it');
  const links={pix:{},credit:{}};
  for(const option of plannedLinks()){
    // A successful response proves a link exists in the sandbox, NOT that
    // the live account or beneficiary is approved for receiving donations.
    const response=await fetchImpl(API,{
      method:'POST',
      redirect:'error',
      headers:{
        'access_token':key,
        'Content-Type':'application/json',
        'Accept':'application/json',
        'User-Agent':'IERC-RN-Donation-Provisioning/1.0',
      },
      body:JSON.stringify(option.payload),
      signal:AbortSignal.timeout(15000),
    });
    if(!response.ok)
      throw new Error('Sandbox link creation failed: HTTP '+response.status+
        '. Check provider dashboard for partial prior creations before retry.');
    const record=await response.json();
    if(typeof record?.url!=='string'||!validSandboxUrl(record.url))
      throw new Error('Sandbox returned invalid hosted URL; check dashboard before retry');
    links[option.method][option.amount]=record.url;
  }
  return links;
}
async function main(){
  const mode=process.argv[2]||'--plan';
  if(process.argv.length>3||!['--plan','--sandbox-create'].includes(mode))
    throw new Error('Use --plan or --sandbox-create');
  if(mode==='--plan'){
    console.log(JSON.stringify({mode:'offline_plan',
      outboundRequests:0,requests:plannedLinks()},null,2));
    return;
  }
  if(process.env.IERCRN_SANDBOX_LINKS_ACK!=='SANDBOX_LINKS_ONLY_NO_LIVE_CHARGES')
    throw new Error('Sandbox ACK required; production links are not created by this command');
  const links=await createSandboxLinks({key:process.env.ASAAS_SANDBOX_API_KEY});
  console.log(JSON.stringify({mode:'sandbox_links_created',
    note:'URLs refer to SANDBOX only. Never place them in PROD environment.',
    links},null,2));
}
if(process.argv[1]?.endsWith('/asaas-recurring-links.mjs')){
  main().catch(error=>{
    // Do not print provider error bodies or credentials.
    console.error('SANDBOX_PROVISIONING_DENIED: '+(
      /^Sandbox link creation failed: HTTP \d+\./.test(error?.message)
        ? error.message.split(' Check provider')[0]
        : error?.message?.includes('Sandbox ACK')?'sandbox_ack_missing'
        :error?.message?.includes('Sandbox API key')?'sandbox_key_missing'
        :'provider_validation_failed'));
    process.exitCode=1;
  });
}
