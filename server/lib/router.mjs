export function shouldFailover(error){
  const status=Number(error?.status || 0);
  if([408,409,429].includes(status) || status>=500) return true;
  return /context|token|timeout|rate.?limit|temporar|inference/i.test(String(error?.message || ""));
}
export function orderCandidates(providers,preferredId){
  const enabled=(providers||[]).filter(p=>p.enabled!==false).slice().sort((a,b)=>(a.priority||100)-(b.priority||100));
  if(!preferredId) return enabled;
  return enabled.filter(p=>p.id===preferredId).concat(enabled.filter(p=>p.id!==preferredId));
}
export class ProviderRouter{
  constructor({providers,decrypt,callProvider}){this.providers=providers;this.decrypt=decrypt;this.callProvider=callProvider;}
  async run(body,preferredId){
    const candidates=orderCandidates(this.providers,preferredId);
    if(!candidates.length) return {provider:"leveling local",providerId:"local",content:"No external model is configured. Add an API key from the model selector.",usage:{},fallback:true};
    const failures=[];
    for(const provider of candidates){
      try{
        const secret=this.decrypt(provider.secret);
        const result=await this.callProvider(provider,secret,body);
        return Object.assign({},result,{provider:provider.name,providerId:provider.id,fallback:false});
      }catch(error){
        failures.push({provider:provider.name,status:error?.status||0,message:String(error?.message||error)});
        if(!shouldFailover(error)){ const e=new Error("Provider failed without a failover-safe error"); e.failures=failures;e.status=error?.status||500;throw e; }
      }
    }
    const e=new Error("All configured providers failed");e.failures=failures;e.status=503;throw e;
  }
}
