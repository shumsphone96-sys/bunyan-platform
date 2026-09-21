// Verify raw bytes, not reserialized JSON. No receipt can be trusted without the app secret.
export async function verifyWebhook(req,env) {
  const secret=env.WHATSAPP_APP_SECRET || env.META_APP_SECRET;
  if(!secret)return new Response('Webhook verification is not configured',{status:503});
  const signature=req.headers.get('x-hub-signature-256')||'';
  if(!/^sha256=[0-9a-f]{64}$/i.test(signature))return new Response('Forbidden',{status:403});
  const bytes=await req.clone().arrayBuffer();
  if(bytes.byteLength>262144)return new Response('Payload too large',{status:413});
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);
  const digest=Uint8Array.from(signature.slice(7).match(/../g),x=>parseInt(x,16));
  return await crypto.subtle.verify('HMAC',key,digest,bytes)?null:new Response('Forbidden',{status:403});
}
