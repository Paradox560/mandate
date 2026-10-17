import { getChatGPTUser } from '../app/chatgpt-auth';
import {portableRuntime,portableAuthConfig,sessionCookie,verifyPortableSession} from './portable-auth';
export class AuthenticationRequired extends Error {
  readonly signInUrl:string;
  constructor(portable:boolean){super(portable?'Open a demo session to use your paper workspace.':'Authentication required. Sign in with ChatGPT to open your workspace.');this.signInUrl=portable?'/access?returnTo=%2F%3Fjudge%3D1':'/signin-with-chatgpt?return_to=%2F';}
}
export function authErrorResponse(error:unknown){return error instanceof AuthenticationRequired?Response.json({error:error.message,authRequired:true,signInUrl:error.signInUrl},{status:401,headers:{'Cache-Control':'no-store'}}):null;}
export async function requestUser(request:Request){
  if(portableRuntime()){
    const user=await verifyPortableSession(sessionCookie(request),portableAuthConfig());
    if(!user)throw new AuthenticationRequired(true);return user;
  }
  const host=new URL(request.url).hostname;
  if(process.env.NODE_ENV==='development'&&['127.0.0.1','localhost','[::1]'].includes(host))return 'local-mandate-owner';
  const user=await getChatGPTUser();if(!user)throw new AuthenticationRequired(false);return user.userId;
}
export function checkOrigin(request:Request){
  const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new Error('Request origin is not authorized. Reload the application and retry.');
}
