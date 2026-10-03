import fs from "node:fs";
import path from "node:path";
import {execFileSync} from "node:child_process";
const root=path.resolve("server");
const files=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith(".mjs"))files.push(p)}}
walk(root);
for(const file of files)execFileSync(process.execPath,["--check",file],{stdio:"inherit"});
console.log("server syntax: PASS ("+files.length+" modules)");
