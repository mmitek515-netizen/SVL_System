import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID, timingSafeEqual} from 'node:crypto';
import type {AgentName, AgentState, Bootstrap, Message, ServerHealth, Session} from './src/lib/types';
import {OpenCodeBridge} from './src/lib/opencodeBridge';

dotenv.config();
const app=express();
app.disable('x-powered-by');
app.use(express.json({limit:'2mb'}));
const AGENTS:AgentName[]=['Alex','Aria','Astyria','Aurelius'];
const dataDir=path.resolve(process.env.DATA_DIR||'data');
const storePath=path.join(dataDir,'bastilla-state.json');
const modelUrl=(process.env.OLLAMA_BASE_URL||'http://127.0.0.1:11434').replace(/\/$/,'');
const configuredModel=(process.env.OLLAMA_MODEL||'auto').trim();
const geminiKey=(process.env.GEMINI_API_KEY||'').trim();
const geminiModel=(process.env.GEMINI_MODEL||'gemini-2.5-flash').trim();
const openCode = new OpenCodeBridge({baseUrl:process.env.OPENCODE_BASE_URL, username:process.env.OPENCODE_SERVER_USERNAME, password:process.env.OPENCODE_SERVER_PASSWORD, allowRemote:process.env.OPENCODE_ALLOW_REMOTE==='true'});
const allowOllamaFallback=process.env.SVL_ALLOW_OLLAMA_FALLBACK==='true';
const heartbeats=new Map<AgentName,{lastSeen:string;workerId:string}>();
interface Job{id:string;sessionId:string;messageId:string;to:AgentName;content:string;status:'queued'|'running'|'done';leaseUntil:number;workerId?:string;attempts:number;}
interface Db{sessions:Session[];messages:Message[];avatars:Record<string,string>;jobs:Job[];opencodeSessions:Record<string,string>;revision:number;updatedAt:string}
fs.mkdirSync(dataDir,{recursive:true});
function loadDb():Db {try{const raw=JSON.parse(fs.readFileSync(storePath,'utf8'));return {sessions:Array.isArray(raw.sessions)?raw.sessions:[],messages:Array.isArray(raw.messages)?raw.messages:[],avatars:raw.avatars&&typeof raw.avatars==='object'?raw.avatars:{},jobs:Array.isArray(raw.jobs)?raw.jobs:[],opencodeSessions:raw.opencodeSessions&&typeof raw.opencodeSessions==='object'?raw.opencodeSessions:{},revision:Number(raw.revision)||0,updatedAt:String(raw.updatedAt||'')}}catch{return {sessions:[],messages:[],avatars:{},jobs:[],opencodeSessions:{},revision:0,updatedAt:''}}}
let db=loadDb();
function persist(){db.revision++;db.updatedAt=new Date().toISOString();const tmp=storePath+'.tmp-'+process.pid;fs.writeFileSync(tmp,JSON.stringify(db,null,2),{mode:0o600});fs.renameSync(tmp,storePath)}
const listeners=new Set<express.Response>();
function publish(topic='update'){for(const res of listeners){if(res.writableEnded||res.destroyed){listeners.delete(res);continue;}res.write('event: update\ndata: '+JSON.stringify({topic,at:new Date().toISOString(),revision:db.revision})+'\n\n')}}
function sendError(res:express.Response,error:string,status=400){res.status(status).json({error});}
function validateOrigin(req:express.Request,res:express.Response,next:express.NextFunction){
  if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
  const origin=req.header('origin');
  // Browser cross-origin writes are rejected. Operators must protect the app with hosting authentication.
  if(origin){try{if(new URL(origin).host!==req.get('host'))return sendError(res,'Odrzucono zapis z obcej domeny.',403)}catch{return sendError(res,'Błędny Origin.',403)}}
  next();
}
app.use('/api',validateOrigin);
app.use('/api',(req,res,next)=>{
  if(req.path==='/health'||req.path==='/auth/login'||req.path==='/linux/ingest'||req.path.startsWith('/worker/'))return next();
  if(!operatorAuthorized(req))return sendError(res,'Wymagana autoryzacja operatora (SVL_OPERATOR_TOKEN).',401);
  next();
});

function validSession(id:string){return db.sessions.find(s=>s.id===id&&!s.archived)}
function ensureSession(){let session=db.sessions.filter(s=>!s.archived).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];if(!session){const now=new Date().toISOString();session={id:randomUUID(),title:'Nowa rozmowa',createdAt:now,updatedAt:now,archived:false};db.sessions.push(session);persist()}return session}
async function ollamaStatus():Promise<ServerHealth['ollama']>{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),1800);
  try{const response=await fetch(modelUrl+'/api/tags',{signal:ctrl.signal});if(!response.ok)throw Error('HTTP '+response.status);const json=await response.json() as {models?:{name?:string}[]};const models=(json.models||[]).map(m=>m.name||'').filter(Boolean);const model=configuredModel==='auto'?models[0]||null:(models.find(m=>m===configuredModel||m.startsWith(configuredModel+':'))||null);return {reachable:true,model,models,configuredUrl:modelUrl,error:!model?'Brak dostępnego, skonfigurowanego modelu.':null}}catch(e){return {reachable:false,model:null,models:[],configuredUrl:modelUrl,error:e instanceof Error?e.message:'Błąd połączenia'}}finally{clearTimeout(timer)}
}
function agentStatus():AgentState[]{const now=Date.now();return AGENTS.map(name=>{const h=heartbeats.get(name);const connected=Boolean(h&&now-Date.parse(h.lastSeen)<40000);return {name,connected,lastSeen:h?.lastSeen||null,workerId:connected?h!.workerId:null}})}
async function health():Promise<ServerHealth>{const [ollama,opencode]=await Promise.all([ollamaStatus(),openCode.status()]);return {backend:'online',observedAt:new Date().toISOString(),ollama,opencode,geminiConfigured:Boolean(geminiKey),agents:agentStatus(),limitations:['Przeglądarka i AI Studio nie są hostowym Linuxem.','Root i usługi systemd wymagają oddzielnego uwierzytelnionego backendu.','Status agenta ONLINE wyłącznie po jego uwierzytelnionym heartbeat.']}}
app.get('/api/health',async (_req,res)=>res.json(await health()));
app.get('/api/opencode/status',async (_req,res)=>{res.set('Cache-Control','no-store');res.json(await openCode.status());});
app.get('/api/bootstrap',async (_req,res)=>{ensureSession();const payload:Bootstrap={sessions:db.sessions,messages:db.messages,avatars:db.avatars,health:await health()};res.set('Cache-Control','no-store');res.json({...payload,revision:db.revision,updatedAt:db.updatedAt})});
app.get('/api/events',(req,res)=>{res.set({'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders?.();res.write(': connected\n\n');listeners.add(res);const id=setInterval(()=>{if(!res.destroyed)res.write(': keep-alive\n\n')},20000);req.on('close',()=>{listeners.delete(res);clearInterval(id)})});
app.post('/api/sessions',(_req,res)=>{const now=new Date().toISOString();const s:Session={id:randomUUID(),title:'Nowa rozmowa',createdAt:now,updatedAt:now,archived:false};db.sessions.push(s);persist();publish('sessions');res.status(201).json(s)});
app.post('/api/sessions/:id/archive',(req,res)=>{const session=validSession(req.params.id);if(!session)return sendError(res,'Rozmowa nie istnieje.',404);session.archived=true;persist();publish('sessions');res.json({success:true})});
app.put('/api/avatars',(req,res)=>{const name=String(req.body?.name||'');const value=String(req.body?.value||'');if(!['Operator',...AGENTS].includes(name))return sendError(res,'Nieznany profil.');if(value.length>600000)return sendError(res,'Awatar jest zbyt duży.',413);if(value&&!(/^https:\/\//i.test(value)||/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(value)))return sendError(res,'Tylko HTTPS lub plik obrazu.');db.avatars[name]=value;persist();publish('avatars');res.json({success:true,avatars:db.avatars})});
function redactError(e:unknown){return String(e instanceof Error?e.message:e).slice(0,280)}
async function answerWithOllama(input:string,history:Message[]):Promise<{content:string;provider:string}>{
  const status=await ollamaStatus();if(!status.reachable||!status.model)throw Error(status.error||'Ollama offline');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),100000);
  try{const turns=history.slice(-18).filter(m=>m.role==='user'||m.role==='assistant').map(m=>({role:m.role,content:m.content}));
    const response=await fetch(modelUrl+'/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},signal:ctrl.signal,body:JSON.stringify({model:status.model,stream:false,messages:[{role:'system',content:'Jesteś asystentem Bastilla OS. Odpowiadaj po polsku. Nie wymyślaj wykonanych działań, statusów agentów ani hosta. Możesz zwrócić elementy interaktywne jako blok ```svl-ui z JSON {"components":[{"type":"progress","title":"...","value":20}]} ``` tylko wtedy, gdy poprawiają odpowiedź.'},...turns]})});
    if(!response.ok)throw Error('Ollama HTTP '+response.status);
    const data=await response.json() as {message?:{content?:string}};const content=data.message?.content?.trim();if(!content)throw Error('Ollama zwróciła pustą wiadomość.');return {content,provider:'Ollama · '+status.model};
  }finally{clearTimeout(timer)}
}
async function answerWithGemini(input:string):Promise<{content:string;provider:string}>{
  if(!geminiKey)throw Error('Gemini nie skonfigurowane.');
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),60000);
  try{const url=`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(geminiModel)}:generateContent`;const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':geminiKey},body:JSON.stringify({contents:[{parts:[{text:'Odpowiedz po polsku jako asystent Bastilla OS. Nie twierdź, że wykonałeś operację hosta lub agenta.\n\n'+input}]}]}),signal:ctrl.signal});if(!r.ok)throw Error('Gemini HTTP '+r.status);const v=await r.json() as {candidates?:{content?:{parts?:{text?:string}[]}}[]};const content=v.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join('').trim();if(!content)throw Error('Gemini zwróciło pustą odpowiedź.');return {content,provider:'Gemini · '+geminiModel};}finally{clearTimeout(timer)}
}
// The mapping is stored in the single authoritative Bastilla database.
// Multiple devices share one OpenCode session per Bastilla conversation.
const inflightOpenCodeSessions = new Map<string,Promise<string>>();
async function openCodeSession(bastillaSessionId:string):Promise<string>{
  if(db.opencodeSessions[bastillaSessionId])return db.opencodeSessions[bastillaSessionId];
  const existing=inflightOpenCodeSessions.get(bastillaSessionId);
  if(existing)return existing;
  const operation=(async()=>{
    const title=db.sessions.find(s=>s.id===bastillaSessionId)?.title||'Bastilla OS';
    const id=await openCode.createSession(title);
    db.opencodeSessions[bastillaSessionId]=id;persist();publish('sessions');return id;
  })();
  inflightOpenCodeSessions.set(bastillaSessionId,operation);
  try{return await operation}finally{inflightOpenCodeSessions.delete(bastillaSessionId)}
}
app.post('/api/messages',async(req,res)=>{
  const sessionId=String(req.body?.sessionId||'');const content=typeof req.body?.content==='string'?req.body.content.trim():'';const target=req.body?.target;
  if(!validSession(sessionId))return sendError(res,'Nie znaleziono aktywnej rozmowy.',404);
  if(!content||content.length>12000)return sendError(res,'Wiadomość musi mieć 1–12000 znaków.');
  if(!['Wszyscy',...AGENTS].includes(target))return sendError(res,'Nieznany odbiorca.');
  const now=new Date().toISOString();const session=validSession(sessionId)!;
  const user:Message={id:randomUUID(),sessionId,role:'user',author:target==='Wszyscy'?'Operator':'Operator → '+target,content,createdAt:now,status:'saved'};
  db.messages.push(user);session.updatedAt=now;
  if(session.title==='Nowa rozmowa')session.title=content.slice(0,48);
  if(target!=='Wszyscy'){
    db.jobs.push({id:randomUUID(),sessionId,messageId:user.id,to:target as AgentName,content,status:'queued',leaseUntil:0,attempts:0});persist();publish('messages');return res.status(202).json({user,response:null,provider:null,jobQueued:true});
  }
  persist();publish('messages');
  let answer:{content:string;provider:string}|null=null;let error='';
  try{
    const upstream=await openCode.status();
    if(!upstream.reachable)throw Error('Serwer OpenCode niedostępny: '+upstream.message);
    if(!upstream.openaiConnected)throw Error('Podłącz konto OpenAI przez: opencode auth login openai → Sign in with ChatGPT');
    if(!upstream.defaultOpenAiModel)throw Error('Wybierz model OpenAI w OpenCode przez /models');
    const upstreamSession=await openCodeSession(sessionId);
    const reply=await openCode.send(upstreamSession,content,upstream.defaultOpenAiModel);
    answer={content:reply.content,provider:'OpenCode · OpenAI (metoda logowania niezweryfikowana)'};
  }catch(e){
    error='OpenCode: '+redactError(e);
    // Optional, explicitly enabled fallback. Never silently pretend Ollama is ChatGPT.
    if(allowOllamaFallback){
      try{answer=await answerWithOllama(content,db.messages.filter(m=>m.sessionId===sessionId));error='';}
      catch(e2){error+='; Ollama: '+redactError(e2)}
    }
  }
  let responseMessage:Message|null=null;
  if(answer){responseMessage={id:randomUUID(),sessionId,role:'assistant',author:'Asystent',content:answer.content,provider:answer.provider,createdAt:new Date().toISOString(),status:'delivered'};db.messages.push(responseMessage);session.updatedAt=responseMessage.createdAt;persist();publish('messages')}
  else{const failure:Message={id:randomUUID(),sessionId,role:'system',author:'Diagnostyka',content:'Nie udało się uzyskać odpowiedzi z modelu. '+error,createdAt:new Date().toISOString(),status:'failed',error};db.messages.push(failure);persist();publish('messages')}
  res.status(answer?200:503).json(answer?{user,response:responseMessage,provider:answer.provider}:{error:'Nie uzyskano odpowiedzi modelu. Wiadomość zapisana lokalnie.',details:error,user});
});
// Authenticated real worker callbacks. Profiles alone NEVER imply an online agent.
let tokens:Record<string,string>={};try{tokens=JSON.parse(process.env.SVL_WORKER_TOKENS||'{}')}catch{}
const tokensValid=AGENTS.every(a=>typeof tokens[a]==='string'&&tokens[a].length>=32)&&new Set(AGENTS.map(a=>tokens[a])).size===4;
function workerAuth(req:express.Request,res:express.Response,next:express.NextFunction){
  if(!tokensValid)return sendError(res,'Nie skonfigurowano czterech unikalnych tokenów agentów.',503);
  const provided=(req.header('authorization')||'').replace(/^Bearer /i,'');const entry=AGENTS.find(a=>{const t=tokens[a];return Buffer.byteLength(t)===Buffer.byteLength(provided)&&timingSafeEqual(Buffer.from(t),Buffer.from(provided))});
  if(!entry)return sendError(res,'Nieprawidłowy token workera.',401);
  res.locals.agent=entry;next();
}
app.post('/api/worker/heartbeat',workerAuth,(req,res)=>{const agent=res.locals.agent as AgentName;const workerId=typeof req.body?.workerId==='string'?req.body.workerId.slice(0,100):agent;heartbeats.set(agent,{workerId,lastSeen:new Date().toISOString()});publish('workers');res.json({ok:true,agent})});
app.post('/api/worker/next',workerAuth,(req,res)=>{const agent=res.locals.agent as AgentName;const workerId=typeof req.body?.workerId==='string'?req.body.workerId.slice(0,100):agent;const job=db.jobs.find(j=>j.to===agent&&(j.status==='queued'||j.status==='running'&&j.leaseUntil<Date.now()));if(!job)return res.json({job:null});job.status='running';job.leaseUntil=Date.now()+60000;job.attempts++;job.workerId=workerId;persist();publish('workers');res.json({job})});
app.post('/api/worker/complete',workerAuth,(req,res)=>{const agent=res.locals.agent as AgentName;const job=db.jobs.find(j=>j.id===req.body?.jobId&&j.to===agent&&j.status==='running'&&j.leaseUntil>Date.now());if(!job||job.workerId!==req.body?.workerId)return sendError(res,'Brak ważnej dzierżawy zadania.',409);const content=String(req.body?.content||'').trim();if(!content||content.length>16000)return sendError(res,'Nieprawidłowa odpowiedź workera.');job.status='done';const m:Message={id:randomUUID(),sessionId:job.sessionId,role:'agent',author:agent,content,createdAt:new Date().toISOString(),status:'delivered',provider:'Worker · '+agent};db.messages.push(m);persist();publish('messages');res.json({ok:true,messageId:m.id})});
app.get('/api/system/status',(_req,res)=>res.json({observedAt:new Date().toISOString(),origin:'node-process / app-container',hostname:os.hostname(),platform:process.platform,arch:process.arch,pid:process.pid,uptimeSeconds:Math.floor(process.uptime()),memory:{rssMB:Math.round(process.memoryUsage().rss/1048576),totalMB:Math.round(os.totalmem()/1048576)},hostRootVerified:false,notes:'Wyniki dotyczą procesu Node; nie dowodzą uprawnień root hosta.'}));
// Operator session: public previews are not automatically trusted. Do not put secrets into frontend JavaScript.
const operatorSecret=(process.env.SVL_OPERATOR_TOKEN||'').trim();
if(process.env.NODE_ENV==='production' && operatorSecret.length<32) throw new Error('Production requires SVL_OPERATOR_TOKEN with 32+ characters');
const operatorSessions=new Map<string,number>();
function isLocalConnection(req:express.Request){const ip=req.socket.remoteAddress||'';return ip==='127.0.0.1'||ip==='::1'||ip==='::ffff:127.0.0.1'}
function secureEqual(a:string,b:string){return Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b))}
function operatorAuthorized(req:express.Request){
  if(!operatorSecret)return isLocalConnection(req);
  const cookie=String(req.header('cookie')||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('svl_session='));
  const session=cookie?.slice('svl_session='.length)||'';
  const expiry=operatorSessions.get(session)||0;
  return expiry>Date.now();
}
app.post('/api/auth/login',(req,res)=>{
  const given=typeof req.body?.token==='string'?req.body.token:'';
  if(!operatorSecret||operatorSecret.length<32)return sendError(res,'SVL_OPERATOR_TOKEN musi mieć co najmniej 32 znaki.',503);
  if(!secureEqual(given,operatorSecret))return sendError(res,'Nieprawidłowy token operatora.',401);
  const ticket=randomUUID()+randomUUID();operatorSessions.set(ticket,Date.now()+12*60*60*1000);
  res.cookie('svl_session',ticket,{httpOnly:true,sameSite:'strict',secure:process.env.SVL_HTTPS==='true',path:'/',maxAge:12*60*60*1000});
  res.json({ok:true});
});
// Real host observer telemetry, pushed by an authenticated daemon. Never infer 'host' from a container.
type HostSnapshot={hostname:string;os:string;kernel?:string;scope:string;uid?:number;observedAt:string;memoryPercent:number;diskPercent?:number;processCount?:number;services:{name:string;state:string}[];ollama?:{reachable:boolean;models:string[]}};
let hostData:HostSnapshot|null=null;let hostReceivedAt=0;
const linuxSecret=(process.env.SVL_LINUX_SYNC_TOKEN||'').trim();
app.post('/api/linux/ingest',(req,res)=>{
  const provided=(req.header('authorization')||'').replace(/^Bearer /i,'');
  if(linuxSecret.length<32||!secureEqual(provided,linuxSecret))return sendError(res,'Brak autoryzacji obserwatora Linux.',401);
  const body=req.body||{};
  if(typeof body.hostname!=='string'||body.hostname.length>128||body.scope!=='linux-host'||typeof body.os!=='string'||typeof body.memoryPercent!=='number'||!Array.isArray(body.services)||body.services.length>512)return sendError(res,'Niepoprawna próbka Linux.');
  hostData={hostname:body.hostname,os:body.os.slice(0,150),kernel:String(body.kernel||'').slice(0,150),scope:'linux-host',uid:Number.isInteger(body.uid)?body.uid:undefined,observedAt:String(body.observedAt||'').slice(0,50),memoryPercent:Math.max(0,Math.min(100,body.memoryPercent)),diskPercent:Number(body.diskPercent)||0,processCount:Number(body.processCount)||0,services:body.services.map((item:any)=>({name:String(item.name||'').slice(0,120),state:String(item.state||'').slice(0,32)})),ollama:body.ollama&&typeof body.ollama==='object'?{reachable:body.ollama.reachable===true,models:Array.isArray(body.ollama.models)?body.ollama.models.filter((x:unknown)=>typeof x==='string').slice(0,40):[]}:undefined};
  hostReceivedAt=Date.now();publish('linux');res.json({ok:true,revision:db.revision});
});
app.get('/api/linux/status',(_req,res)=>{
  const connected=hostData!==null&&Date.now()-hostReceivedAt<45000;
  res.json({connected,receivedAt:connected?new Date(hostReceivedAt).toISOString():null,host:connected?hostData:null,note:connected?'Rzeczywisty odczyt z uwierzytelnionego obserwatora Linux':'Brak świeżego odczytu hosta. GUI nie oznacza usług jako ONLINE bez pomiarów.'});
});
const PORT=Number(process.env.PORT)||3000;
if(process.env.NODE_ENV==='production'){
  const dist=path.resolve('dist');app.use(express.static(dist));app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html')));
}else{
  const {createServer}=await import('vite');const vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);
}
app.listen(PORT,'0.0.0.0',()=>console.log('Bastilla OS GUI First listening on '+PORT));
