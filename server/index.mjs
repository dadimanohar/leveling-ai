import http from "node:http";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { URL } from "node:url";
import archiver from "archiver";
import { providerCatalog } from "./lib/catalog.mjs";
import { encryptSecret, decryptSecret } from "./lib/crypto.mjs";
import { ProviderRouter } from "./lib/router.mjs";
import { safePath, runCommand, walkTree } from "./lib/sandbox.mjs";
import { isDueToday } from "./lib/scheduler.mjs";
import { connectorCatalog, publishConnector } from "./lib/connectors.mjs";
import { buildFallbackPlan, parseModelPlan } from "./lib/agent.mjs";\nimport { trimMessages } from "./lib/context.mjs";

const PORT = Number(process.env.PORT || 4174);
const ROOT = path.resolve(process.env.LEVELING_WORKSPACE || "./workspace");
const DATA = path.join(ROOT, ".leveling");
const PROVIDERS_FILE = path.join(DATA, "providers.json");
const TASKS_FILE = path.join(DATA, "tasks.json");
const MASTER = process.env.LEVELING_MASTER_KEY || "";
const DEV_MASTER = "replace-with-a-long-random-secret";
const MAX_BODY = 5_000_000;\nconst CONTEXT_BUDGET = Number(process.env.LEVELING_CONTEXT_TOKENS || 32768);

async function ensure() {
  await fs.mkdir(ROOT, { recursive: true });
  await fs.mkdir(DATA, { recursive: true });
  for (const file of [PROVIDERS_FILE, TASKS_FILE]) {
    try { await fs.access(file); } catch { await fs.writeFile(file, "[]", "utf8"); }
  }
}
async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); } catch { return []; }
}
async function writeJson(file, data) { await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8"); }
function cryptoRandom() { return crypto.randomUUID(); }
function send(res, status, data, extra = {}) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra });
  res.end(JSON.stringify(data));
}
function getBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", chunk => {
      raw += chunk;
      if (raw.length > MAX_BODY) reject(new Error("payload too large"));
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error("invalid JSON")); }
    });
    req.on("error", reject);
  });
}
function presetById(id) { return providerCatalog.find(p => p.id === id); }
function masterKey() {
  if (!MASTER || MASTER === DEV_MASTER) throw new Error("Set a strong LEVELING_MASTER_KEY in .env before storing API keys.");
  return MASTER;
}
async function providerList() { return readJson(PROVIDERS_FILE); }

async function callProvider(provider, apiKey, payload) {
  const model = payload.model || provider.model;
  const maxTokens = Number(payload.maxTokens || 1400);
  const messages = Array.isArray(payload.messages) ? payload.messages : [];

  if (provider.adapter === "anthropic") {
    const r = await fetch(provider.baseUrl + "/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model, max_tokens: maxTokens, temperature: payload.temperature ?? 0.3,
        system: messages.filter(m => m.role === "system").map(m => String(m.content)).join("\n"),
        messages: messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content) }))
      })
    });
    if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
    const x = await r.json();
    return { content: (x.content || []).map(a => a.text || "").join(""), usage: x.usage || {} };
  }

  if (provider.adapter === "gemini") {
    const u = provider.baseUrl + "/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(apiKey);
    const r = await fetch(u, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: messages.filter(m => m.role !== "system").map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content) }] })),
        generationConfig: { temperature: payload.temperature ?? 0.3, maxOutputTokens: maxTokens }
      })
    });
    if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
    const x = await r.json();
    return { content: x.candidates?.[0]?.content?.parts?.map(a => a.text || "").join("") || "", usage: x.usageMetadata || {} };
  }

  if (provider.adapter === "replicate") {
    const e = new Error("Replicate requires a model-specific prediction contract and is therefore a guarded preset in v0.12.");
    e.status = 501;
    throw e;
  }

  const base = String(provider.baseUrl || "").replace(/\/$/, "");
  if (!base) { const e = new Error("Provider base URL is empty"); e.status = 400; throw e; }

  const r = await fetch(base + "/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", "authorization": "Bearer " + apiKey },
    body: JSON.stringify({ model, messages, temperature: payload.temperature ?? 0.3, max_tokens: maxTokens })
  });
  if (!r.ok) { const e = new Error(await r.text()); e.status = r.status; throw e; }
  const x = await r.json();
  return { content: x.choices?.[0]?.message?.content || "", usage: x.usage || {} };
}

async function route(payload) {
  const list = await providerList();
  if (!list.length) {
    const last = payload.messages?.[payload.messages.length - 1]?.content || "";
    return {
      provider: "leveling local",
      providerId: "local",
      content: "Local fallback is active.\n\nYou said:\n" + String(last) + "\n\nAdd an external model in Add APIs for live inference.",
      usage: {}, fallback: true
    };
  }
  const router = new ProviderRouter({
    providers: list,
    decrypt: box => decryptSecret(box, masterKey()),
    callProvider
  });
  try { return await router.run(payload, payload.providerId); }
  catch (error) {
    return {
      provider: "routing error",
      providerId: "none",
      content: "All configured providers failed.\n" + JSON.stringify(error.failures || [], null, 2),
      usage: {}, fallback: true, failures: error.failures || []
    };
  }
}

function escapeHtml(text) {
  return String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

async function gatherAINews(limit = 8) {
  const url = "https://news.google.com/rss/search?q=AI&hl=en-IN&gl=IN&ceid=IN:en";
  const r = await fetch(url, { headers: { "user-agent": "leveling/0.12" } });
  if (!r.ok) throw new Error("AI news feed returned HTTP " + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, limit).map(m => {
    const block = m[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[|\]\]>/g, "") || "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] || "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || "";
    return { title, link, pubDate };
  }).filter(x => x.title);
}

async function generateEmailReport(prompt, providerId) {
  const news = await gatherAINews(8);
  const digest = news.map((n, i) => (i + 1) + ". " + n.title + "\n" + n.link).join("\n");
  const routed = await route({
    providerId,
    messages: [
      { role: "system", content: "Summarize only the supplied news items. Return a concise email with a subject, bullets, and the source links. Do not invent facts." },
      { role: "user", content: "Goal: " + prompt + "\n\nNews:\n" + digest }
    ],
    maxTokens: 1100
  });
  return { news, routed };
}

async function sendEmail({ to, subject, text, html }) {
  const { default: nodemailer } = await import("nodemailer");
  const host = process.env.SMTP_HOST, user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("SMTP is not configured");
  const transport = nodemailer.createTransport({
    host, port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: { user, pass }
  });
  return transport.sendMail({ from: process.env.MAIL_FROM || user, to, subject, text, html });
}

async function publish(id, payload) {
  if (id === "email") return sendEmail(payload);
  if (id === "youtube") {
    if (!process.env.YOUTUBE_ACCESS_TOKEN) throw new Error("YOUTUBE_ACCESS_TOKEN is not configured");
    return { ok: false, connector: id, message: "YouTube publish hook is guarded; add a refreshable OAuth upload implementation before production publishing." };
  }
  if (id === "instagram") {
    if (!process.env.INSTAGRAM_ACCESS_TOKEN) throw new Error("INSTAGRAM_ACCESS_TOKEN is not configured");
    return { ok: false, connector: id, message: "Instagram publish hook is guarded; add Meta Graph publishing permissions before production publishing." };
  }
  if (id === "x") {
    if (!process.env.X_BEARER_TOKEN) throw new Error("X_BEARER_TOKEN is not configured");
    return { ok: false, connector: id, message: "X publish hook is guarded; add a posting-capable OAuth token before production publishing." };
  }
  throw new Error("Unknown connector: " + id);
}

async function runAutomation(task, providerId, testOnly = false) {
  const report = await generateEmailReport(task.prompt, providerId);
  const connectorResults = [];
  if (!testOnly) {
    for (const connector of task.connectors || []) {
      try {
        const result = await publish(connector, {
          to: process.env.MAIL_TO || process.env.SMTP_USER,
          subject: String(task.name) + " — " + new Date().toLocaleDateString("en-IN"),
          text: report.routed.content,
          html: "<pre>" + escapeHtml(report.routed.content) + "</pre>"
        });
        connectorResults.push({ id: connector, ok: true, result });
      } catch (e) {
        connectorResults.push({ id: connector, ok: false, error: String(e.message || e) });
      }
    }
  }
  return { content: report.routed.content, news: report.news, provider: report.routed.provider, connectorResults, testOnly };
}

async function createZip() {
  const outputPath = path.join(ROOT, "leveling-workspace-" + Date.now() + ".zip");
  await new Promise((resolve, reject) => {
    const output = fsSync.createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve); archive.on("error", reject); archive.pipe(output);
    archive.glob("**/*", { cwd: ROOT, ignore: [".leveling/**", "node_modules/**", "dist/**", "*.zip"] });
    archive.finalize();
  });
  return outputPath;
}

function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml"
  })[ext] || "text/plain; charset=utf-8";
}

async function staticFile(res, pathname) {
  const clean = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const distRoot = path.resolve("./dist");
  const target = safePath(distRoot, clean);
  try {
    const data = await fs.readFile(target);
    res.writeHead(200, { "content-type": contentType(target) });
    res.end(data);
    return true;
  } catch { return false; }
}

async function schedulerTick() {
  const tasks = await readJson(TASKS_FILE);
  let changed = false;
  for (const task of tasks) {
    if (!isDueToday(task)) continue;
    try {
      const result = await runAutomation(task, task.providerId, false);
      task.lastRun = new Date().toISOString();
      task.lastResult = { ok: true, ...result };
    } catch (e) {
      task.lastRun = new Date().toISOString();
      task.lastResult = { ok: false, error: String(e.message || e) };
    }
    changed = true;
  }
  if (changed) await writeJson(TASKS_FILE, tasks);
}

const server = http.createServer(async (req, res) => {
  try {
    await ensure();
    const u = new URL(req.url, "http://" + req.headers.host);

    if (req.method === "GET" && u.pathname === "/api/health") {
      return send(res, 200, { ok: true, version: "0.12.0", workspace: ROOT, secureMaster: Boolean(MASTER && MASTER !== DEV_MASTER), contextBudgetTokens: CONTEXT_BUDGET });
    }

    if (req.method === "GET" && u.pathname === "/api/providers") {
      const configured = await providerList();
      return send(res, 200, {
        catalog: providerCatalog,
        configured: configured.map(p => { const q = { ...p }; delete q.secret; return q; })
      });
    }

    if (req.method === "POST" && u.pathname === "/api/providers") {
      const b = await getBody(req);
      const preset = presetById(b.preset);
      if (!b.name || !b.model || !b.apiKey) return send(res, 400, { error: "name, model and apiKey are required" });
      const baseUrl = String(b.baseUrl || preset?.baseUrl || "").trim().replace(/\/$/, "");
      if (!baseUrl && b.preset !== "azure-openai") return send(res, 400, { error: "Base URL is required" });
      const list = await providerList();
      const row = {
        id: cryptoRandom(), name: String(b.name), model: String(b.model), baseUrl,
        adapter: String(b.adapter || preset?.adapter || "openai-compatible"),
        priority: Number(b.priority || 100), enabled: true, providerPreset: String(b.preset || "custom"),
        secret: encryptSecret(String(b.apiKey), masterKey())
      };
      list.push(row); await writeJson(PROVIDERS_FILE, list);
      const safe = { ...row }; delete safe.secret;
      return send(res, 201, safe);
    }

    if (req.method === "DELETE" && u.pathname.startsWith("/api/providers/")) {
      const id = decodeURIComponent(u.pathname.slice("/api/providers/".length));
      const list = await providerList();
      const next = list.filter(p => p.id !== id);
      if (next.length === list.length) return send(res, 404, { error: "Provider not found" });
      await writeJson(PROVIDERS_FILE, next); return send(res, 200, { ok: true });
    }

    if (req.method === "POST" && u.pathname === "/api/chat") return send(res, 200, await route(await getBody(req)));

    if (req.method === "GET" && u.pathname === "/api/workspace/tree") return send(res, 200, { root: ROOT, tree: await walkTree(ROOT) });

    if (req.method === "GET" && u.pathname === "/api/workspace/file") {
      const rel = u.searchParams.get("path") || "";
      return send(res, 200, { path: rel, content: await fs.readFile(safePath(ROOT, rel), "utf8") });
    }

    if (req.method === "POST" && u.pathname === "/api/workspace/file") {
      const b = await getBody(req), target = safePath(ROOT, String(b.path || ""));
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, String(b.content ?? ""), "utf8");
      return send(res, 200, { ok: true, path: b.path });
    }

    if (req.method === "POST" && u.pathname === "/api/workspace/run") {
      const b = await getBody(req);
      const r = await runCommand(ROOT, String(b.command), Array.isArray(b.args) ? b.args : [], Number(b.timeoutMs || 30000));
      return send(res, 200, { ok: r.code === 0, ...r });
    }

    if (req.method === "POST" && u.pathname === "/api/workspace/export") return send(res, 200, { ok: true, path: await createZip() });

    if (req.method === "GET" && u.pathname === "/api/automations") return send(res, 200, { tasks: await readJson(TASKS_FILE) });

    if (req.method === "POST" && u.pathname === "/api/automations") {
      const b = await getBody(req), tasks = await readJson(TASKS_FILE);
      const row = {
        id: cryptoRandom(), name: String(b.name || "Untitled automation"), prompt: String(b.prompt || ""),
        schedule: String(b.schedule || "manual"), providerId: b.providerId || null,
        connectors: Array.isArray(b.connectors) ? b.connectors.map(String) : [],
        enabled: b.enabled !== false, createdAt: new Date().toISOString(), lastRun: null, lastResult: null
      };
      tasks.push(row); await writeJson(TASKS_FILE, tasks); return send(res, 201, row);
    }

    if (req.method === "POST" && u.pathname === "/api/automations/test") {
      const b = await getBody(req);
      const result = await runAutomation({ name: b.name || "Automation test", prompt: b.prompt || "", connectors: b.connectors || [] }, b.providerId, true);
      return send(res, 200, { ok: true, result });
    }

    if (req.method === "GET" && u.pathname === "/api/connectors") return send(res, 200, { catalog: connectorCatalog });

    if (req.method === "POST" && u.pathname === "/api/agent/plan") {
      const b = await getBody(req);
      let plan = null, provider = "local fallback";
      if (b.providerId) {
        try {
          const result = await route({
            providerId: b.providerId,
            messages: [
              { role: "system", content: "You are a software engineering planner. Return ONLY JSON with summary, steps[{id,title,detail}], files[{path,action,content}], commands[{command,args}]. Do not include destructive commands. Keep paths relative to the workspace." },
              { role: "user", content: String(b.prompt || "") }
            ],
            maxTokens: 3000
          });
          if (!result.fallback) { plan = parseModelPlan(result.content); provider = result.provider; }
        } catch {}
      }
      if (!plan) plan = buildFallbackPlan(b.prompt);
      return send(res, 200, { ok: true, plan, provider });
    }

    if (req.method === "POST" && u.pathname === "/api/agent/apply") {
      const b = await getBody(req), plan = b.plan;
      if (!plan || !Array.isArray(plan.files)) return send(res, 400, { error: "plan.files is required" });
      const results = [];
      for (const f of plan.files.slice(0, 100)) {
        const target = safePath(ROOT, String(f.path || ""));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, String(f.content || ""), "utf8");
        results.push("wrote " + f.path);
      }
      return send(res, 200, { ok: true, results });
    }

    if (req.method === "POST" && u.pathname === "/api/skill/run") {
      const b = await getBody(req);
      const result = await route({
        providerId: b.providerId,
        messages: [
          { role: "system", content: "You are the leveling skill runtime: " + String(b.skill || "general") + ". Be explicit about limitations. When web sources are supplied, cite them." },
          { role: "user", content: String(b.prompt || "") }
        ],
        maxTokens: 1800
      });
      return send(res, 200, { ok: true, output: result.content, provider: result.provider });
    }

    if (req.method === "POST" && u.pathname === "/api/media/storyboard") {
      const b = await getBody(req);
      const result = await route({
        providerId: b.providerId,
        messages: [
          { role: "system", content: "Create a 4-scene video storyboard as JSON. Each scene must have durationSeconds <= 20. Output {scenes:[{title,shot,prompt,status,durationSeconds}]}. Do not claim a video file was generated." },
          { role: "user", content: String(b.prompt || "") }
        ],
        maxTokens: 1700
      });
      let scenes = [1,2,3,4].map((_,i) => ({ title: i === 0 ? "Opening" : "Scene " + (i+1), shot: "Cinematic establishing shot", prompt: String(b.prompt || ""), status: "storyboard", durationSeconds: 20 }));
      try {
        const text = result.content || "", start = text.indexOf("{"), end = text.lastIndexOf("}");
        if (start >= 0 && end > start) {
          const parsed = JSON.parse(text.slice(start, end + 1));
          if (Array.isArray(parsed.scenes)) scenes = parsed.scenes.slice(0, 12).map(s => ({ ...s, durationSeconds: Math.min(20, Math.max(1, Number(s.durationSeconds || 20))), status: String(s.status || "storyboard") }));
        }
      } catch {}
      return send(res, 200, { ok: true, scenes, provider: result.provider });
    }

    if (await staticFile(res, u.pathname)) return;
    return send(res, 404, { error: "Not found" });
  } catch (e) {
    return send(res, 500, { error: String(e.message || e), status: e.status, failures: e.failures });
  }
});

server.listen(PORT, () => console.log("leveling v0.12 core listening at http://127.0.0.1:" + PORT));
setInterval(() => schedulerTick().catch(() => {}), 30000);
