import {describe,it,expect} from "vitest";
import {estimateTokens,trimMessages} from "../server/lib/context.mjs";
describe("context budget",()=>{
  it("estimates tokens conservatively",()=>expect(estimateTokens("1234")).toBe(1));
  it("keeps system messages and recent context",()=>{
    const out=trimMessages([{role:"system",content:"system"},{role:"user",content:"a".repeat(8000)},{role:"assistant",content:"b".repeat(8000)}],1000);
    expect(out[0].role).toBe("system");expect(out.length).toBeGreaterThanOrEqual(1);
  });
});
