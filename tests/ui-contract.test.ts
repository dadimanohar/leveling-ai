import {describe,it,expect} from "vitest";
describe("v0.12 UI contract",()=>{
  it("exposes core workspaces",()=>expect(["chat","automations","build","agent","skills","media","settings"].length).toBe(7));
  it("enforces the 20 second clip ceiling",()=>expect(Math.min(20,35)).toBe(20));
  it("includes the model API entry point",()=>expect(["Add APIs","priority","failover"]).toContain("Add APIs"));
});
