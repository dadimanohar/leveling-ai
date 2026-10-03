import http from "node:http";
function request(url,options={}){return new Promise((resolve,reject)=>{const req=http.request(url,options,res=>{let s="";res.on("data",d=>s+=d);res.on("end",()=>resolve({status:res.statusCode,body:s}))});req.on("error",reject);if(options.body)req.write(options.body);req.end()})}
const base=process.env.LEVELING_TEST_URL||"http://127.0.0.1:4174";
for(const route of ["/api/health","/api/providers","/api/workspace/tree","/api/automations","/api/connectors"]){const r=await request(base+route);if(r.status!==200)throw new Error(route+" failed with "+r.status)}
const w=await request(base+"/api/workspace/file",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:"smoke.txt",content:"leveling smoke"})});
if(w.status!==200)throw new Error("write failed");
const r=await request(base+"/api/workspace/file?path=smoke.txt");if(!JSON.parse(r.body).content.includes("leveling smoke"))throw new Error("readback failed");
console.log("leveling smoke: PASS");
