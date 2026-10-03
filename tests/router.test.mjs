import {describe,it,expect} from "vitest";
import {orderCandidates,shouldFailover} from "../server/lib/router.mjs";
describe("provider router",()=>{
  it("orders enabled providers by priority",()=>expect(orderCandidates([{id:"a",priority:30,enabled:true},{id:"b",priority:10,enabled:true},{id:"c",priority:20,enabled:false}]).map(x=>x.id)).toEqual(["b","a"]));
  it("puts selected provider first",()=>expect(orderCandidates([{id:"a",priority:10,enabled:true},{id:"b",priority:20,enabled:true}],"b").map(x=>x.id)).toEqual(["b","a"]));
  it("fails over on rate limiting",()=>expect(shouldFailover({status:429})).toBe(true));
  it("fails over on server errors",()=>expect(shouldFailover({status:503})).toBe(true));
  it("fails over on context errors",()=>expect(shouldFailover(new Error("context window exceeded"))).toBe(true));
});
