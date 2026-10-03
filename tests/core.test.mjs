import {describe,it,expect} from "vitest";
import {parseDailySchedule,isDueToday} from "../server/lib/scheduler.mjs";
import {safePath,assertAllowedCommand} from "../server/lib/sandbox.mjs";
import {buildFallbackPlan} from "../server/lib/agent.mjs";
describe("core guards",()=>{
  it("parses a daily schedule",()=>expect(parseDailySchedule("daily 15:00")).toEqual({hour:15,minute:0}));
  it("rejects invalid schedules",()=>expect(parseDailySchedule("daily 25:70")).toBeNull());
  it("does not repeat a task on the same day",()=>expect(isDueToday({enabled:true,schedule:"daily 15:00",lastRun:"2026-10-03T15:00:00+05:30"},new Date("2026-10-03T15:00:01+05:30"))).toBe(false));
  it("blocks path traversal",()=>expect(()=>safePath("/tmp/leveling","../secret")).toThrow());
  it("blocks arbitrary shell commands",()=>expect(()=>assertAllowedCommand("rm")).toThrow());
  it("creates a safe fallback plan",()=>expect(buildFallbackPlan("build a landing page").files[0].path).toContain("landing-page"));
});
