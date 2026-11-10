import type { AgentName, Bootstrap, Message, ServerHealth, Session } from './types';
export class ApiFailure extends Error { constructor(message:string, public code:number){super(message);} }
async function request<T>(url:string, init?:RequestInit):Promise<T>{
  const response=await fetch(url,{cache:'no-store',...init,headers:{...((init?.body)?{'Content-Type':'application/json'}:{}),...(init?.headers||{})}});
  const result=await response.json().catch(()=>({error:'Odpowiedź serwera nie jest prawidłowym JSON.'}));
  if(!response.ok) throw new ApiFailure(result.error||`HTTP ${response.status}`,response.status);
  return result as T;
}
export const api={
  login:(token:string)=>request<{ok:boolean}>('/api/auth/login',{method:'POST',body:JSON.stringify({token})}),
  linuxStatus:()=>request<{connected:boolean;receivedAt:string|null;host:unknown}>('/api/linux/status'),
  bootstrap:()=>request<Bootstrap>('/api/bootstrap'),
  health:()=>request<ServerHealth>('/api/health'),
  opencodeStatus:()=>request<ServerHealth['opencode']>('/api/opencode/status'),
  createSession:()=>request<Session>('/api/sessions',{method:'POST',body:'{}'}),
  archiveSession:(id:string)=>request<{success:boolean}>(`/api/sessions/${encodeURIComponent(id)}/archive`,{method:'POST',body:'{}'}),
  sendMessage:(sessionId:string,content:string,target:'Wszyscy'|AgentName)=>request<{user:Message;response:Message|null;provider:string|null}>(`/api/messages`,{method:'POST',body:JSON.stringify({sessionId,content,target})}),
  updateAvatar:(name:string,value:string)=>request<{success:boolean,avatars:Record<string,string>}>('/api/avatars',{method:'PUT',body:JSON.stringify({name,value})})
};
