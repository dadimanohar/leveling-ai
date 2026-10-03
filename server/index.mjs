import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import {spawn} from "node:child_process";
import {URL} from "node:url";

const PORT=Number(process.env.PORT||4174);
const ROOT=path.resolve(process.env.LEVELING_WORKSPACE||"./workspace");
const DATA=path.join(ROOT,".leveling");
const PROVIDERS_FILE=path.join(DATA,"providers.json");
const TASKS_FILE=path.join(DATA,"tasks.json");
const catalog=[
["openai","OpenAI","openai-compatible","https://api.openai.com/v1"],["anthropic","Anthropic","anthropic","https://api.anthropic.com/v1"],
["gemini","Google Gemini","gemini","https://generativelanguage.googleapis.com/v1beta"],["groq","Groq","openai-compatible","https://api.groq.com/openai/v1"],
["mistral","Mistral","openai-compatible","https://api.mistral.ai/v1"],["deepseek","DeepSeek","openai-compatible","https://api.deepseek.com/v1"],
["openrouter","OpenRouter","openai-compatible","https://openrouter.ai/api/v1"],["together","Together AI","openai-compatible","https://api.together.xyz/v1"],
["fireworks","Fireworks AI","openai-compatible","https://api.fireworks.ai/inference/v1"],["cerebras","Cerebras","openai-compatible","https://api.cerebras.ai/v1"],
["perplexity","Perplexity","openai-compatible","https://api.perplexity.ai"],["xai","xAI","openai-compatible","https://api.x.ai/v1"],
["cohere","Cohere","openai-compatible","https://api.cohere.com/compatibility/v1"],["ai21","AI21 Labs","openai-compatible","https://api.ai21.com/studio/v1"],
["sambanova","SambaNova","openai-compatible","https://api.sambanova.ai/v1"],["huggingface","Hugging Face","openai-compatible","https://router.huggingface.co/v1"],
["nvidia","NVIDIA NIM","openai-compatible","https://integrate.api.nvidia.com/v1"],["deepinfra","DeepInfra","openai-compatible","https://api.deepinfra.com/v1/openai"],
["replicate","Replicate","custom","https://api.replicate.com/v1"],["azure-openai","Azure OpenAI","openai-compatible",""],
["github-models","GitHub Models","openai-compatible","https://models.inference.ai.azure.com"],["siliconflow","SiliconFlow","openai-compatible","https://api.siliconflow.cn/v1"],
["novita","Novita AI","openai-compatible","https://api.novita.ai/v3/openai"],["moonshot","Moonshot AI","openai-compatible","https://api.moonshot.ai/v1"],
["zhipu","Zhipu AI","openai-compatible","https://open.bigmodel.cn/api/paas/v4"],["minimax","MiniMax","openai-compatible","https://api.minimax.io/v1"],
["baichuan","Baichuan","openai-compatible","https://api.baichuan-ai.com/v1"],["yi","01.AI Yi","openai-compatible","https://api.lingyiwanwu.com/v1"],
["volcengine","Volcengine Ark","openai-compatible","https://ark.cn-beijing.volces.com/api/v3"],["qwen","Alibaba Qwen","openai-compatible","https://dashscope-intl.aliyuncs.com/compatible-mode/v1"],
["aleph-alpha","Aleph Alpha","custom","https://api.aleph-alpha.com"]
].map(function(x){return {id:x[0],name:x[1],adapter:x[2],baseUrl:x[3]};});

async function ensure(){await fs.mkdir(DATA,{recursive:true}); for(const f of [PROVIDERS_FILE,TASKS_FILE]){try{await fs.access(f)}catch{await fs.writeFile(f,"[]","utf8")}}}
async function readJson(f){try{return JSON.parse(await fs.readFile(f,"utf8"))}catch{return []}}
const writeJson=(f,x)=>fs.writeFile(f,JSON.stringify(x,null,2),"utf8");
function safePath(rel){const root=path.resolve(ROOT);const p=path.resolve(root,rel||"");if(p!==root&&!p.startsWith(root+path.sep))throw new Error("Path escapes workspace");return p}
function send(res,status,x){res.writeHead(status,{"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*"});res.end(JSON.stringify(x))}
function getBody(req){return new Promise((resolve,reject)=>{let s="";req.on("data",c=>{s+=c;if(s.length>2000000)reject(new Error("payload too large"))});req.on("end",()=>{try{resolve(s?JSON.parse(s):{})}catch(e){reject(e)}})})}

const master=process.env.LEVELING_MASTER_KEY||"dev-only-change-this";
const key=crypto.scryptSync(master,"leveling-v12",32);
function encrypt(text){const iv=crypto.randomBytes(12);const c=crypto.createCipheriv("aes-256-gcm",key,iv);const data=Buffer.concat([c.update(text,"utf8"),c.final()]);return {iv:iv.toString("base64"),tag:c.getAuthTag().toString("base64"),data:data.toString("base64")}}
function decrypt(box){const d=crypto.createDecipheriv("aes-256-gcm",key,Buffer.from(box.iv,"base64"));d.setAuthTag(Buffer.from(box.tag,"base64"));return Buffer.concat([d.update(Buffer.from(box.data,"base64")),d.final()]).toString("utf8")}

function shouldFailover(e){const s=e.status||0;return s===429||s===408||s>=500||/context|token|timeout|inference/i.test(String(e.message))}
async function callProvider(p,apiKey,body){
  if(p.adapter==="anthropic"){
    const r=await fetch(p.baseUrl+"/messages",{method:"POST",headers:{"content-type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01"},body:JSON.stringify({model:body.model,max_tokens:body.maxTokens||1200,temperature:body.temperature||0.3,system:body.messages.filter(m=>m.role==="system").map(m=>m.content).join("\n"),messages:body.messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"assistant":"user",content:m.content}))})});
    if(!r.ok){const e=new Error(await r.text());e.status=r.status;throw e} const x=await r.json();return {content:(x.content||[]).map(function(a){return a.text||""}).join(""),usage:x.usage||{}};
  }
  if(p.adapter==="gemini"){
    const u=p.baseUrl+"/models/"+encodeURIComponent(body.model)+":generateContent?key="+encodeURIComponent(apiKey);
    const r=await fetch(u,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({contents:body.messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]})),generationConfig:{temperature:body.temperature||0.3,maxOutputTokens:body.maxTokens||1200}})});
    if(!r.ok){const e=new Error(await r.text());e.status=r.status;throw e} const x=await r.json();return {content:x.candidates?.[0]?.content?.parts?.map(function(a){return a.text||""}).join("")||"",usage:x.usageMetadata||{}};
  }
  const r=await fetch(p.baseUrl.replace(/\/$/,"")+"/chat/completions",{method:"POST",headers:{"content-type":"application/json","authorization":"Bearer "+apiKey},body:JSON.stringify({model:body.model,messages:body.messages,temperature:body.temperature||0.3,max_tokens:body.maxTokens||1200})});
  if(!r.ok){const e=new Error(await r.text());e.status=r.status;throw e} const x=await r.json();return {content:x.choices?.[0]?.message?.content||"",usage:x.usage||{}};
}
async function route(body){
  const list=(await readJson(PROVIDERS_FILE)).filter(p=>p.enabled).sort((a,b)=>(a.priority||100)-(b.priority||100));
  const preferred=body.providerId?list.filter(p=>p.id===body.providerId):[];
  const rest=list.filter(p=>!preferred.includes(p));
  const candidates=[...preferred,...rest];
  if(!candidates.length)return {provider:"leveling-local-demo",content:"No external model is configured. Add an API from the model menu to enable live inference.",fallback:true};
  const failures=[];
  for(const p of candidates){try{const result=await callProvider(p,decrypt(p.secret),body);return {...result,provider:p.name,providerId:p.id}}catch(e){failures.push({provider:p.name,status:e.status||0,message:String(e.message)});if(!shouldFailover(e))throw Object.assign(e,{failures})}}
  const e=new Error("All configured models failed");e.failures=failures;throw e;
}
async function runCommand(command,args){const allow=new Set(["node","npm","pnpm","npx","python","python3","git"]);if(!allow.has(command))throw new Error("Command not permitted");return new Promise((resolve,reject)=>{const p=spawn(command,args,{cwd:ROOT,shell:false,env:{...process.env,LEVELING_WORKSPACE:ROOT}});let stdout="",stderr="";p.stdout.on("data",d=>stdout+=d);p.stderr.on("data",d=>stderr+=d);const t=setTimeout(function(){p.kill("SIGKILL");reject(new Error("Process timeout (30s)")},30000);p.on("error",reject);p.on("close",code=>{clearTimeout(t);resolve({code,stdout,stderr})})})}
async function walk(dir,rel){const entries=await fs.readdir(dir,{withFileTypes:true});return Promise.all(entries.filter(e=>![".leveling","node_modules",".git"].includes(e.name)).slice(0,300).map(async function(e){const r=path.join(rel,e.name);return e.isDirectory()?{name:e.name,type:"folder",path:r,children:await walk(path.join(dir,e.name),r)}:{name:e.name,type:"file",path:r}})}

const server=http.createServer(async function(req,res){
  try{
    await ensure(); const u=new URL(req.url,"http://"+req.headers.host);
    if(req.method==="GET"&&u.pathname==="/api/health")return send(res,200,{ok:true,version:"0.12.0",workspace:ROOT});
    if(req.method==="GET"&&u.pathname==="/api/providers"){const configured=await readJson(PROVIDERS_FILE);return send(res,200,{catalog,configured:configured.map(function(p){const q={...p};delete q.secret;return q})})}
    if(req.method==="POST"&&u.pathname==="/api/providers"){const b=await getBody(req);if(!b.name||!b.model||!b.apiKey)return send(res,400,{error:"name, model and apiKey are required"});const preset=catalog.find(function(x){return x.id===b.preset});const base=(b.baseUrl||(preset?.baseUrl)||"").replace(/\/$/,"");if(!base)return send(res,400,{error:"baseUrl is required"});const list=await readJson(PROVIDERS_FILE);const p={id:crypto.randomUUID(),name:b.name,model:b.model,baseUrl:base,adapter:b.adapter||preset?.adapter||"openai-compatible",priority:Number(b.priority||100),enabled:true,providerPreset:b.preset||"custom",secret:encrypt(b.apiKey)};list.push(p);await writeJson(PROVIDERS_FILE,list);const out={...p};delete out.secret;return send(res,201,out)}
    if(req.method==="POST"&&u.pathname==="/api/chat"){const result=await route(await getBody(req));return send(res,200,result)}
    if(req.method==="GET"&&u.pathname==="/api/workspace/tree"){await fs.mkdir(ROOT,{recursive:true});return send(res,200,{root:ROOT,tree:await walk(ROOT,"")})}
    if(req.method==="GET"&&u.pathname==="/api/workspace/file"){const rel=u.searchParams.get("path")||"";return send(res,200,{path:rel,content:await fs.readFile(safePath(rel),"utf8")})}
    if(req.method==="POST"&&u.pathname==="/api/workspace/file"){const b=await getBody(req);const target=safePath(b.path||"");await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,String(b.content??""),"utf8");return send(res,200,{ok:true,path:b.path})}
    if(req.method==="POST"&&u.pathname==="/api/workspace/run"){const b=await getBody(req);const r=await runCommand(b.command,b.args||[]);return send(res,200,{ok:r.code===0,...r})}
    if(req.method==="GET"&&u.pathname==="/api/automations")return send(res,200,{tasks:await readJson(TASKS_FILE)});
    if(req.method==="POST"&&u.pathname==="/api/automations"){const b=await getBody(req);const t=await readJson(TASKS_FILE);const row={id:crypto.randomUUID(),name:b.name||"Untitled automation",prompt:b.prompt||"",schedule:b.schedule||"manual",enabled:b.enabled!==false,createdAt:new Date().toISOString(),lastRun:null};t.push(row);await writeJson(TASKS_FILE,t);return send(res,201,row)}
    return send(res,404,{error:"Not found"});
  }catch(e){return send(res,500,{error:String(e.message),failures:e.failures})}
});
server.listen(PORT,function(){console.log("leveling server listening on http://127.0.0.1:"+PORT)});