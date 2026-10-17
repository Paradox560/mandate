import {createPortableSession,portableRuntime,portableAuthConfig,verifyPortableSession,sessionCookie,checkAccessCode,PORTABLE_COOKIE,PortableLoginLimiter} from '../../../lib/portable-auth';
import {checkOrigin} from '../../../lib/request-auth';
const headers={'Cache-Control':'no-store'};
const loginAttempts = new PortableLoginLimiter();
export async function GET(request:Request){
  if(!portableRuntime())return Response.json({error:'This deployment uses ChatGPT sign-in.'},{status:404,headers});
  try {const config=portableAuthConfig();return Response.json({mode:config.mode,authenticated:!!await verifyPortableSession(sessionCookie(request),config)},{headers});}
  catch(error){return Response.json({error:error instanceof Error?error.message:'Session configuration is unavailable.'},{status:503,headers});}
}
export async function POST(request:Request){
  if(!portableRuntime())return Response.json({error:'This deployment uses ChatGPT sign-in.'},{status:404,headers});
  try{
    checkOrigin(request);
    const text=await request.text();if(text.length>1000)throw new Error('Access request is too large.');
    const body=JSON.parse(text) as unknown;const config=portableAuthConfig();
    if(config.mode==='code'){
      const release=loginAttempts.reserve();
      if(!release)return Response.json({error:'Too many failed attempts. Try again in one minute.'},{status:429,headers:{...headers,'Retry-After':'60'}});
      let accepted=false;
      try{const code=body&&typeof body==='object'&&!Array.isArray(body)?(body as {code?:unknown}).code:undefined;accepted=typeof code==='string'&&code.length<=128&&await checkAccessCode(code,config.accessCode!);}
      finally{release(!accepted);}
      if(!accepted)return Response.json({error:'The demo access code is incorrect.'},{status:401,headers});
    }
    const session=await createPortableSession(config);
    const host=new URL(request.url).hostname;
    const secure=!['localhost','127.0.0.1','[::1]'].includes(host);
    return Response.json({authenticated:true},{headers:{...headers,'Set-Cookie':`${PORTABLE_COOKIE}=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${session.maxAge}${secure?'; Secure':''}`}});
  }catch(error){return Response.json({error:error instanceof Error?error.message:'Unable to open a session.'},{status:400,headers});}
}
