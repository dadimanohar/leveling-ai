import fs from "node:fs/promises";
import path from "node:path";
import {spawn} from "node:child_process";
export function safePath(root,relativePath){
  const base=path.resolve(root),target=path.resolve(base,relativePath||"");
  if(target!==base && !target.startsWith(base+path.sep)) throw new Error("Path escapes workspace");
  return target;
}
const ALLOWED=new Set(["node","npm","npx","pnpm","python","python3","git","vite"]);
export function assertAllowedCommand(command){ if(!ALLOWED.has(command)) throw new Error("Command not permitted: "+command); }
export function runCommand(root,command,args=[],timeoutMs=30000){
  assertAllowedCommand(command);
  return new Promise((resolve,reject)=>{
    const child=spawn(command,args.map(String),{cwd:root,shell:false,env:{...process.env,LEVELING_WORKSPACE:root}});
    let stdout="",stderr="";
    const timer=setTimeout(()=>{child.kill("SIGKILL");reject(new Error("Process timeout ("+timeoutMs+"ms)"));},timeoutMs);
    child.stdout.on("data",d=>stdout+=d);child.stderr.on("data",d=>stderr+=d);
    child.once("error",e=>{clearTimeout(timer);reject(e)});
    child.once("close",code=>{clearTimeout(timer);resolve({code,stdout,stderr})});
  });
}
export async function walkTree(root,rel="",depth=0){
  if(depth>6) return [];
  const dir=safePath(root,rel),entries=await fs.readdir(dir,{withFileTypes:true});
  const ignored=new Set([".leveling","node_modules",".git","dist"]),result=[];
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
    if(ignored.has(entry.name)) continue;
    const p=path.join(rel,entry.name);
    result.push(entry.isDirectory()?{name:entry.name,type:"folder",path:p,children:await walkTree(root,p,depth+1)}:{name:entry.name,type:"file",path:p});
    if(result.length>=300) break;
  }
  return result;
}
