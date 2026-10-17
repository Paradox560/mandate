import { getChatGPTUser } from '../app/chatgpt-auth';
export async function requestUser(request:Request){
  const host=new URL(request.url).hostname;
  if(process.env.NODE_ENV==='development'&&['127.0.0.1','localhost','[::1]'].includes(host))return 'local-mandate-owner';
  const user=await getChatGPTUser();if(!user)throw new Error('Authentication required. Sign in with ChatGPT to open your workspace.');return user.userId;
}
export function checkOrigin(request:Request){
  const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)throw new Error('Request origin is not authorized. Reload the application and retry.');
}
