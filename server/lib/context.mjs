const DEFAULT_MAX_TOKENS=32768;
export function estimateTokens(text){return Math.ceil(String(text||"").length/4);}
export function trimMessages(messages,maxTokens=DEFAULT_MAX_TOKENS){
  const list=Array.isArray(messages)?messages.slice():[];
  let total=list.reduce((n,m)=>n+estimateTokens(m.content),0);
  if(total<=maxTokens)return list;
  const system=list.filter(m=>m.role==="system");
  const rest=list.filter(m=>m.role!=="system");
  const kept=[];
  let budget=Math.max(1024,maxTokens-system.reduce((n,m)=>n+estimateTokens(m.content),0));
  for(let i=rest.length-1;i>=0 && budget>0;i--){
    const cost=estimateTokens(rest[i].content);
    if(cost<=budget){kept.unshift(rest[i]);budget-=cost}
  }
  return system.concat(kept);
}
