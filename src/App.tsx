import React, { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Bot, ChevronDown, ChevronRight, Code2, FileCode2, Folder, FolderOpen, Globe2, History, Layers3, Menu, MessageSquare, Mic, MoreHorizontal, Plus, Rocket, Save, Search, Send, Settings2, ShieldCheck, Sparkles, TestTube2, Upload, Workflow, Wrench, X, Cpu } from "lucide-react";

type Mode = "chat" | "automations" | "build" | "agent" | "skills" | "media" | "training" | "settings";
type Message = { role: "user" | "assistant"; content: string; model?: string; meta?: string };
type Provider = { id: string; name: string; model: string; priority: number; enabled: boolean; baseUrl: string; providerPreset: string };
type TreeNode = { name: string; type: "file" | "folder"; path: string; children?: TreeNode[] };
type Automation = { id: string; name: string; prompt: string; schedule: string; enabled: boolean; connectors?: string[]; lastRun?: string | null };
type Plan = { summary: string; steps: Array<{ id: string; title: string; detail: string; status: string }>; files: Array<{ path: string; action: string; content: string }>; commands: Array<{ command: string; args: string[] }> };

const NAV: Array<[Mode, string, React.ElementType]> = [
  ["chat", "Chat", MessageSquare], ["automations", "Automations", Workflow], ["build", "Build", Code2],
  ["agent", "Build Agent", Bot], ["skills", "Skills", Wrench], ["media", "Media Studio", Layers3], ["training", "Training", GraduationCap], ["settings", "Settings", Settings2]
];
const starterMessages: Message[] = [{ role: "assistant", content: "I am ready. Ask a question, build an application, or turn a repeated task into a workflow." }];

export default function App() {
  const [mode, setMode] = useState<Mode>("chat");
  const [mobileNav, setMobileNav] = useState(false);
  const [messages, setMessages] = useState<Message[]>(starterMessages);
  const [input, setInput] = useState("");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [selectedModel, setSelectedModel] = useState(localStorage.getItem("leveling:selectedModel") || "local");
  const [modelOpen, setModelOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const [serverOnline, setServerOnline] = useState(false);
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [workspace, setWorkspace] = useState("");

  useEffect(() => {
    refresh();
    const t = window.setInterval(refresh, 5000);
    return () => window.clearInterval(t);
  }, []);
  useEffect(() => { localStorage.setItem("leveling:selectedModel", selectedModel); }, [selectedModel]);

  async function refresh() {
    try {
      const health = await fetch("/api/health").then(r => r.json());
      setServerOnline(Boolean(health.ok));
      setWorkspace(health.workspace || "");
      const p = await fetch("/api/providers").then(r => r.json());
      setProviders(p.configured || []);
      const a = await fetch("/api/automations").then(r => r.json());
      setAutomations(a.tasks || []);
    } catch { setServerOnline(false); }
  }

  const selectedLabel = useMemo(() => {
    if (selectedModel === "local") return "leveling local";
    return providers.find(p => p.id === selectedModel)?.model || "Model unavailable";
  }, [providers, selectedModel]);

  async function sendChat() {
    const text = input.trim();
    if (!text) return;
    const next = messages.concat([{ role: "user", content: text }]);
    setMessages(next);
    setInput("");
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ messages: next, providerId: selectedModel === "local" ? undefined : selectedModel }) });
      const x = await r.json();
      if (!r.ok) throw new Error(x.error || "Request failed");
      setMessages(next.concat([{ role: "assistant", content: x.content || "No response.", model: x.provider || "local", meta: x.fallback ? "local fallback" : "routed inference" }]));
    } catch (e) {
      setMessages(next.concat([{ role: "assistant", content: String(e), meta: "request error" }]));
    }
  }

  return <div className="appShell">
    {mobileNav && <button className="mobileOverlay" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
    <aside className={"sidebar " + (mobileNav ? "mobileOpen" : "")}>
      <div className="brandRow">
        <div className="brandGlyph"><Sparkles size={17}/></div>
        <div><strong>leveling</strong><span>AI workspace · v0.12</span></div>
        <button className="mobileClose iconButton" onClick={() => setMobileNav(false)}><X size={16}/></button>
      </div>
      <button className="newTask" onClick={() => { setMode("chat"); setMessages(starterMessages); }}>
        <Plus size={16}/> New task <kbd>Ctrl K</kbd>
      </button>
      <div className="navBlock"><div className="sectionLabel">WORKSPACES</div>
        {NAV.map(([id, label, Icon]) => <button key={id} className={"navButton " + (mode === id ? "active" : "")} onClick={() => { setMode(id); setMobileNav(false); }}>
          <Icon size={16}/><span>{label}</span>{id === "automations" && automations.filter(a => a.enabled).length > 0 && <em>{automations.filter(a => a.enabled).length}</em>}
        </button>)}
      </div>
      <div className="sidebarBottom">
        <div className="runtimeStatus"><span className={"statusDot " + (serverOnline ? "online" : "")}/><div><strong>{serverOnline ? "Local core online" : "Core offline"}</strong><span>{workspace || "workspace runtime"}</span></div></div>
        <div className="modelMini"><Cpu size={14}/><div><span>ACTIVE MODEL</span><strong>{selectedLabel}</strong></div></div>
      </div>
    </aside>
    <main className="mainArea">
      <header className="topBar">
        <button className="mobileMenu iconButton" onClick={() => setMobileNav(true)}><Menu size={18}/></button>
        <div className="crumb">{NAV.find(n => n[0] === mode)?.[1]}</div>
        <div className="topActions">
          <div className="modelSelector">
            <button className="modelButton" onClick={() => setModelOpen(v => !v)}><Cpu size={14}/><span>{selectedLabel}</span><ChevronDown size={13}/></button>
            {modelOpen && <ModelMenu providers={providers} selected={selectedModel} select={m => { setSelectedModel(m); setModelOpen(false); }} add={() => { setApiOpen(true); setModelOpen(false); }} />}
          </div>
          <button className="iconButton"><Search size={16}/></button>
          <button className="iconButton"><MoreHorizontal size={17}/></button>
        </div>
      </header>
      {mode === "chat" && <ChatPage messages={messages} input={input} setInput={setInput} send={sendChat} setInputFromQuick={setInput}/>}
      {mode === "automations" && <AutomationsPage automations={automations} refresh={refresh} selectedModel={selectedModel}/>}
      {(mode === "build" || mode === "agent") && <BuildPage agentMode={mode === "agent"} selectedModel={selectedModel}/>}
      {mode === "skills" && <SkillsPage selectedModel={selectedModel}/>}\n      {mode === "training" && <TrainingPage/>}
      {mode === "media" && <MediaPage selectedModel={selectedModel}/>}
      {mode === "settings" && <SettingsPage serverOnline={serverOnline} providers={providers} openApi={() => setApiOpen(true)}/>}
    </main>
    {apiOpen && <ApiModal close={() => setApiOpen(false)} created={p => { setProviders(providers.concat([p])); setSelectedModel(p.id); setApiOpen(false); }}/>}
  </div>;
}

function ModelMenu(p: { providers: Provider[]; selected: string; select: (id: string) => void; add: () => void }) {
  return <div className="popover modelPopover">
    <div className="popoverHeader"><span>Active model</span><button onClick={p.add}><Plus size={13}/> Add APIs</button></div>
    <button className={"modelOption " + (p.selected === "local" ? "chosen" : "")} onClick={() => p.select("local")}><span className="modelDot local"/><div><strong>leveling local</strong><small>offline-safe fallback</small></div></button>
    {p.providers.map(x => <button key={x.id} className={"modelOption " + (p.selected === x.id ? "chosen" : "")} onClick={() => p.select(x.id)}><span className="modelDot"/><div><strong>{x.name}</strong><small>{x.model} · priority {x.priority}</small></div></button>)}
  </div>;
}

function ChatPage(p: { messages: Message[]; input: string; setInput: (s: string) => void; send: () => void; setInputFromQuick: (s: string) => void }) {
  const [voice, setVoice] = useState(false);
  const recognition = useRef<any>(null);
  function toggleVoice() {
    const R = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!R) { setVoice(true); return; }
    if (recognition.current) { recognition.current.stop(); recognition.current = null; setVoice(false); return; }
    const r = new R(); r.lang = "en-IN"; r.continuous = false; r.interimResults = true;
    r.onresult = (e: any) => p.setInput(Array.from(e.results).map((x: any) => x[0].transcript).join(""));
    r.onend = () => { recognition.current = null; setVoice(false); };
    r.start(); recognition.current = r; setVoice(true);
  }
  function speak(text: string) {
    if (window.speechSynthesis) window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
  return <section className="page chatPage">
    <div className="heroBlock">
      <div className="eyebrow"><Sparkles size={13}/> local-first · model-routable · agent-ready</div>
      <h1>What are we building <span>today?</span></h1>
      <p>One place to chat, research, code, automate and ship.</p>
      <div className="quickGrid">
        {[
          ["Build", "Build a website in my workspace"],
          ["Automate", "Every day at 3 PM, gather the latest AI news and email me"],
          ["Research", "Research this topic and cite current sources"]
        ].map(([a,b]) => <button key={a} onClick={() => p.setInputFromQuick(b)}><span>{a}</span><strong>{b}</strong><ChevronRight size={14}/></button>)}
      </div>
    </div>
    <div className="chatPanel">
      <div className="messageList">{p.messages.map((m,i) => <div className={"messageRow " + m.role} key={i}><div className="messageAvatar">{m.role === "assistant" ? <Sparkles size={13}/> : "U"}</div><div className="messageBody"><div className="messageBubble">{m.content}</div>{m.role === "assistant" && <div className="messageMeta">{m.model || "leveling"} · {m.meta || "ready"} <button className="tinyIcon" onClick={() => speak(m.content)}>🔊</button></div>}</div></div>)}</div>
      <div className="composer">
        <textarea value={p.input} onChange={e => p.setInput(e.target.value)} placeholder="Ask leveling to think, build, automate or explain…" onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); p.send(); }}} />
        <div className="composerBar"><div className="composerTools"><button onClick={toggleVoice} className={voice ? "activeTool" : ""}><Mic size={15}/>{voice ? "Listening" : "Voice"}</button><button><Globe2 size={15}/> Web</button><button><Plus size={15}/> Attach</button></div><button className="sendButton" onClick={p.send}><Send size={15}/></button></div>
      </div>
      <div className="disclaimer">AI output can be wrong. Review important information and file changes before execution.</div>
    </div>
  </section>;
}

function AutomationsPage(p: { automations: Automation[]; refresh: () => void; selectedModel: string }) {
  const [prompt, setPrompt] = useState("Every day at 3 PM, gather the latest AI news, summarize it, create a short video script, and email the report.");
  const [name, setName] = useState("AI News Daily");
  const [schedule, setSchedule] = useState("daily 15:00");
  const [connectors, setConnectors] = useState<string[]>(["email"]);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    await fetch("/api/automations", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name,prompt,schedule,connectors,providerId:p.selectedModel==="local"?null:p.selectedModel}) });
    await p.refresh(); setBusy(false);
  }
  async function test() {
    setBusy(true);
    await fetch("/api/automations/test", { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({name,prompt,connectors,providerId:p.selectedModel==="local"?undefined:p.selectedModel}) });
    setBusy(false); await p.refresh();
  }
  return <section className="page">
    <div className="pageHeader"><div><div className="eyebrow"><Workflow size={13}/> orchestration</div><h2>Automations that keep running.</h2><p>Describe the outcome. The runtime persists it, schedules it, executes it and records a result.</p></div><div className="headerActions"><button className="ghostButton"><History size={14}/> Run history</button><button className="primaryButton" onClick={save}><Save size={14}/> {busy ? "Saving…" : "Save automation"}</button></div></div>
    <div className="automationLayout">
      <div className="card largeCard"><div className="cardTitle"><span>Workflow designer</span><span className="pill"><ShieldCheck size={12}/> approval-aware</span></div>
        <label>Workflow name<input value={name} onChange={e=>setName(e.target.value)}/></label>
        <label>Natural-language goal<textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/></label>
        <div className="formGrid"><label>Schedule<select value={schedule} onChange={e=>setSchedule(e.target.value)}><option>daily 08:00</option><option>daily 12:00</option><option>daily 15:00</option><option>daily 18:00</option><option>manual</option></select></label>
        <label>Connectors<div className="connectorPicker">{["email","youtube","instagram","x"].map(id=><button type="button" key={id} className={connectors.includes(id)?"selected":""} onClick={()=>setConnectors(c=>c.includes(id)?c.filter(x=>x!==id):c.concat([id]))}>{id}</button>)}</div></label></div>
        <div className="flowCanvas">{["Trigger · schedule","Search + verify","Summarize + generate","Media · ≤20s clips","Deliver · connectors"].map((x,i)=><React.Fragment key={x}><div className="flowNode"><span>{String(i+1).padStart(2,"0")}</span><div><strong>{x}</strong><small>{i===0?"Persistent trigger":"Worker step"}</small></div></div>{i<4&&<div className="flowLine"><ChevronDown size={13}/></div>}</React.Fragment>)}</div>
      </div>
      <div className="card controlCard"><div className="cardTitle"><span><Activity size={14}/> Runtime controls</span></div><Toggle label="Enabled" on/><Toggle label="Retry failed runs" on/><Toggle label="Approval before publishing"/><div className="metric"><span>Schedule</span><strong>{schedule}</strong></div><div className="metric"><span>Connectors</span><strong>{connectors.join(", ")||"none"}</strong></div><button className="secondaryButton full" onClick={test}><TestTube2 size={14}/> {busy?"Testing…":"Test workflow now"}</button></div>
    </div>
    <div className="sectionHeader"><span>Saved automations</span><small>{p.automations.length} total</small></div>
    <div className="automationList">{p.automations.map(a=><div className="automationRow" key={a.id}><div className="rowIcon"><Workflow size={15}/></div><div><strong>{a.name}</strong><span>{a.schedule} · {a.enabled?"enabled":"paused"} · {a.lastRun?"last run "+new Date(a.lastRun).toLocaleString():"never run"}</span></div><button className="tinyIcon"><MoreHorizontal size={16}/></button></div>)}</div>
  </section>;
}

function Toggle({label,on}:{label:string;on?:boolean}){return <div className="toggleRow"><span>{label}</span><span className={"toggle "+(on?"on":"")}><i/></span></div>}

function BuildPage(p:{agentMode:boolean;selectedModel:string}) {
  const [tree,setTree]=useState<TreeNode[]>([]); const [file,setFile]=useState("README.md"); const [content,setContent]=useState("");
  const [task,setTask]=useState(p.agentMode?"Build this application end-to-end, test it, repair failures and prepare a ZIP.":"Build a production-ready app from my idea.");
  const [plan,setPlan]=useState<Plan|null>(null); const [tab,setTab]=useState<"plan"|"diff"|"logs">("plan"); const [logs,setLogs]=useState<string[]>(["Workspace connected","Agent runtime waiting"]); const [busy,setBusy]=useState(false); const [failure,setFailure]=useState("");
  useEffect(()=>{loadTree()},[]);
  async function loadTree(){try{const x=await fetch("/api/workspace/tree").then(r=>r.json());setTree(x.tree||[])}catch{}}
  async function openFile(path:string){setFile(path);const x=await fetch("/api/workspace/file?path="+encodeURIComponent(path)).then(r=>r.json());setContent(x.content||"")}
  async function saveFile(){await fetch("/api/workspace/file",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({path:file,content})});setLogs(l=>l.concat(["Saved "+file]));loadTree()}
  async function createPlan(){if(!task.trim())return;setBusy(true);setLogs(["Planning task…"]);try{const r=await fetch("/api/agent/plan",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:task,providerId:p.selectedModel==="local"?undefined:p.selectedModel})});const x=await r.json();if(!r.ok)throw new Error(x.error);setPlan(x.plan);setLogs(l=>l.concat(["Plan created · "+x.plan.steps.length+" steps"]));setTab("plan")}catch(e){setLogs(l=>l.concat(["Plan failed: "+String(e)]))}finally{setBusy(false)}}
  async function applyPlan(){if(!plan)return;setBusy(true);setLogs(l=>l.concat(["Applying file changes…"]));try{const r=await fetch("/api/agent/apply",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({plan})});const x=await r.json();if(!r.ok)throw new Error(x.error);setLogs(l=>l.concat((x.results||[]).map((s:string)=>"✓ "+s)));await loadTree()}catch(e){setLogs(l=>l.concat(["Apply failed: "+String(e)]))}finally{setBusy(false)}}
  async function runTests(){setBusy(true);setLogs(l=>l.concat(["Running verification…"]));try{const r=await fetch("/api/workspace/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({command:"npm",args:["run","check"],timeoutMs:60000})});const x=await r.json();const err=[x.stderr||"",x.stdout||""].filter(Boolean).join("\n");setFailure(x.ok?"":err);setLogs(l=>l.concat([x.ok?"✓ Tests PASS":"✕ Tests FAILED",x.stdout||"",x.stderr||""]));setTab("logs")}catch(e){const err=String(e);setFailure(err);setLogs(l=>l.concat(["Test execution failed: "+err]));setTab("logs")}finally{setBusy(false)}} 
  async function repair(){if(!failure)return;if(p.selectedModel==="local"){setLogs(l=>l.concat(["Automatic repair needs a configured external model."]));setTab("logs");return}setBusy(true);setLogs(l=>l.concat(["Asking the selected model for a repair plan…"]));try{const r=await fetch("/api/agent/repair",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt:task,error:failure,providerId:p.selectedModel})});const x=await r.json();if(!r.ok)throw new Error(x.error||"Repair planning failed");setPlan(x.plan);setFailure("");setLogs(l=>l.concat(["✓ Repair plan created with "+x.plan.files.length+" file changes"]));setTab("plan")}catch(e){setLogs(l=>l.concat(["Repair failed: "+String(e)]))}finally{setBusy(false)}}
  async function exportZip(){const x=await fetch("/api/workspace/export",{method:"POST"}).then(r=>r.json());setLogs(l=>l.concat(["ZIP: "+(x.path||x.error||"failed")]));if(x.path){const name=String(x.path).split("/").pop();window.open("/api/workspace/export?name="+encodeURIComponent(name),"_blank")}setTab("logs")}
  return <section className="page"><div className="pageHeader compact"><div><div className="eyebrow"><Code2 size={13}/> {p.agentMode?"agent-first engineering":"build workspace"}</div><h2>{p.agentMode?"Build Agent":"Build"}</h2><p>Plan → inspect → edit → run → test → repair → preview → package.</p></div><div className="headerActions"><button className="ghostButton"><Folder size={14}/> Workspace</button><button className="primaryButton" onClick={createPlan} disabled={busy}><Rocket size={14}/> {busy?"Working…":"Run agent"}</button></div></div>
    <div className="taskBar"><textarea value={task} onChange={e=>setTask(e.target.value)} placeholder="Describe the app or automation to build…"/><button onClick={createPlan}><Send size={15}/> Plan</button></div>
    <div className="ideShell">
      <div className="idePane filePane"><div className="paneHeader"><span>EXPLORER</span></div>{tree.length?tree.map(n=><TreeNode key={n.path} node={n} open={openFile}/>):<div className="emptyState">Workspace is empty. The agent can create files here.</div>}</div>
      <div className="idePane editorPane"><div className="paneHeader"><span><FileCode2 size={13}/> {file}</span><button className="tinyIcon" onClick={saveFile}><Save size={13}/></button></div><textarea value={content} onChange={e=>setContent(e.target.value)} spellCheck={false}/><div className="editorStatus">UTF-8 · autosave off · explicit save</div></div>
      <div className="idePane agentPane"><div className="paneTabs">{(["plan","diff","logs"] as const).map(t=><button key={t} className={tab===t?"active":""} onClick={()=>setTab(t)}>{t}</button>)}</div>
        {tab==="plan" && <div className="agentContent">{plan?<><div className="planSummary">{plan.summary}</div>{plan.steps.map(s=><div className="planStep" key={s.id}><span className="stepDot"/><div><strong>{s.title}</strong><small>{s.detail}</small></div></div>)}<div className="agentActions"><button className="secondaryButton full" onClick={applyPlan}>Apply plan</button><button className="secondaryButton full" onClick={runTests}><TestTube2 size={14}/> Run tests</button>{failure&&<button className="secondaryButton full" onClick={repair}>Repair failure with agent</button>}<button className="secondaryButton full" onClick={exportZip}><Upload size={14}/> Export ZIP</button></div></>:<EmptyPlan task={task}/>}</div>}
        {tab==="diff" && <div className="agentContent">{plan?.files.map(f=><pre key={f.path} className="diffBlock"><code>{f.action.toUpperCase()+" "+f.path}</code>{String.fromCharCode(10)+f.content}</pre>)||<div className="diffNotice">No plan changes yet.</div>}</div>}
        {tab==="logs" && <div className="agentContent logs">{logs.map((l,i)=><div key={i}><span>›</span>{l}</div>)}</div>}
      </div>
    </div>
  </section>;
}
function EmptyPlan({task}:{task:string}){return <div className="emptyPlan"><Bot size={24}/><strong>No plan yet</strong><p>Describe the outcome and run the agent. A configured model can return a structured implementation plan; without one, the server uses a safe local starter plan.</p><code>{task}</code></div>}
function TreeNode({node,open}:{node:TreeNode;open:(p:string)=>void}){const [expanded,setExpanded]=useState(node.type==="folder");return <div className="treeItem">{node.type==="folder"?<><button className="treeRow" onClick={()=>setExpanded(v=>!v)}>{expanded?<FolderOpen size={13}/>:<Folder size={13}/>}<span>{node.name}</span><ChevronRight size={11} className={expanded?"rotated":""}/></button>{expanded&&node.children?.map(c=><TreeNode key={c.path} node={c} open={open}/>)}</>:<button className="treeRow file" onClick={()=>open(node.path)}><FileCode2 size={13}/><span>{node.name}</span></button>}</div>}

function TrainingPage(){
  return <section className="page">
    <div className="pageHeader"><div><div className="eyebrow"><GraduationCap size={13}/> model improvement</div><h2>Training</h2><p>Curate → SFT → preference optimization → evaluate → promote or rollback.</p></div></div>
    <div className="settingsGrid">
      <div className="card settingCard wide"><div className="cardTitle"><span>Self-training pipeline</span><span className="pill"><ShieldCheck size={12}/> gated</span></div>
        <div className="flowCanvas">
          {["Allowed sources","Quality + dedupe","Train / validation split","SFT checkpoint","Preference optimization","Evaluation gate","Promote / rollback"].map((x,i)=><React.Fragment key={x}><div className="flowNode"><span>{String(i+1).padStart(2,"0")}</span><div><strong>{x}</strong><small>{i<3?"Data stage":i===5?"Quality gate":"Model stage"}</small></div></div>{i<6&&<div className="flowLine"><ChevronDown size={13}/></div>}</React.Fragment>)}
        </div>
      </div>
      <div className="card settingCard"><div className="cardTitle"><span>Runtime rules</span></div><div className="setting"><span>Internet ingestion</span><strong>Allowlist only</strong></div><div className="setting"><span>Deduplication</span><strong>SHA-256</strong></div><div className="setting"><span>Evaluation required</span><strong>Yes</strong></div><div className="setting"><span>Rollback checkpoint</span><strong>Keep previous</strong></div></div>
      <div className="card settingCard"><div className="cardTitle"><span>Local commands</span></div><div className="setting"><span>Dataset curation</span><code>python training/prepare_dataset.py</code></div><div className="setting"><span>SFT</span><code>python training/run_sft.py</code></div><div className="setting"><span>Preference</span><code>python training/run_preference.py</code></div><div className="setting"><span>Evaluation</span><code>python training/evaluate.py</code></div></div>
    </div>
    <div className="card infoBanner"><ShieldCheck size={15}/><span>The runtime does not claim frontier-level quality from source code alone. Training accepts a user-supplied base model and keeps quality gates before promotion.</span></div>
  </section>;
}

function SkillsPage({selectedModel}:{selectedModel:string}){const [skill,setSkill]=useState("web-research");const [prompt,setPrompt]=useState("Research the latest AI model releases and return a source-backed summary.");const [out,setOut]=useState("");const [busy,setBusy]=useState(false);async function run(){setBusy(true);const r=await fetch("/api/skill/run",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({skill,prompt,providerId:selectedModel==="local"?undefined:selectedModel})});const x=await r.json();setOut(x.output||x.error||"No output");setBusy(false)}return <section className="page"><div className="pageHeader"><div><div className="eyebrow"><Wrench size={13}/> capability layer</div><h2>Skills</h2><p>Reusable operations that use the same routing and permission boundaries.</p></div></div><div className="skillsLayout"><div className="card skillPicker">{["web-research","code-review","rag","browser-task","email-writer","workflow-designer"].map(x=><button key={x} className={skill===x?"selected":""} onClick={()=>setSkill(x)}><Wrench size={14}/><span>{x}</span><ChevronRight size={13}/></button>)}</div><div className="card skillRunner"><label>Skill prompt<textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/></label><button className="primaryButton" onClick={run}>{busy?"Running…":"Run skill"}</button>{out&&<pre className="skillOutput">{out}</pre>}</div></div></section>}

function MediaPage({selectedModel}:{selectedModel:string}){const [prompt,setPrompt]=useState("A cinematic opening for a technology documentary about AI agents.");const [scenes,setScenes]=useState<any[]>([]);const [busy,setBusy]=useState(false);async function generate(){setBusy(true);const r=await fetch("/api/media/storyboard",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({prompt,providerId:selectedModel==="local"?undefined:selectedModel,clipSeconds:20})});const x=await r.json();setScenes(x.scenes||[]);setBusy(false)}return <section className="page"><div className="pageHeader"><div><div className="eyebrow"><Layers3 size={13}/> media orchestration</div><h2>Media Studio</h2><p>Storyboard film scenes and keep every generated clip at or below 20 seconds.</p></div><button className="primaryButton" onClick={generate}><Sparkles size={14}/> {busy?"Generating…":"Generate storyboard"}</button></div><div className="card mediaPrompt"><label>Film direction<textarea value={prompt} onChange={e=>setPrompt(e.target.value)}/></label></div><div className="sceneGridLarge">{(scenes.length?scenes:[1,2,3,4]).map((s:any,i)=><div className="sceneCard" key={i}><div className="scenePreview"><span>SCENE {String(i+1).padStart(2,"0")}</span></div><strong>{s.title||(i===0?"Opening":"Scene "+(i+1))}</strong><small>≤ 20s · {s.status||"storyboard"}</small></div>)}</div><div className="card infoBanner"><ShieldCheck size={15}/><span>Actual media generation and publishing remain provider/connector dependent; no missing provider is treated as a successful run.</span></div></section>}

function SettingsPage({serverOnline,providers,openApi}:{serverOnline:boolean;providers:Provider[];openApi:()=>void}){return <section className="page"><div className="pageHeader"><div><div className="eyebrow"><Settings2 size={13}/> platform settings</div><h2>Settings</h2><p>Security, runtime and model routing.</p></div></div><div className="settingsGrid"><div className="card settingCard"><div className="cardTitle"><span>Runtime</span></div><div className="setting"><span>Core</span><strong>{serverOnline?"Online":"Offline"}</strong></div><div className="setting"><span>Workspace</span><strong className="truncate">local filesystem</strong></div><div className="setting"><span>Models</span><strong>{providers.length+1} available</strong></div><div className="setting"><span>Context budget</span><strong>32K runtime ceiling</strong></div></div><div className="card settingCard"><div className="cardTitle"><span>Security</span></div><div className="setting"><span>API keys</span><strong>Encrypted server-side</strong></div><div className="setting"><span>Filesystem</span><strong>workspace sandbox</strong></div><div className="setting"><span>Commands</span><strong>allowlist</strong></div></div><div className="card settingCard wide"><div className="cardTitle"><span>External models</span><button className="secondaryButton" onClick={openApi}><Plus size={13}/> Add APIs</button></div>{providers.length===0?<div className="emptyState">No external models configured.</div>:providers.map(x=><div className="providerRow" key={x.id}><Cpu size={14}/><div><strong>{x.name}</strong><span>{x.model} · priority {x.priority}</span></div><span className="statusBadge">enabled</span></div>)}</div></div></section>}

function ApiModal(p:{close:()=>void;created:(provider:Provider)=>void}){const [catalog,setCatalog]=useState<any[]>([]);const [preset,setPreset]=useState("openai");const [name,setName]=useState("My model");const [model,setModel]=useState("gpt-4.1-mini");const [apiKey,setApiKey]=useState("");const [baseUrl,setBaseUrl]=useState("");const [priority,setPriority]=useState("10");const [error,setError]=useState("");useEffect(()=>{fetch("/api/providers").then(r=>r.json()).then(x=>{setCatalog(x.catalog||[]);if(x.catalog?.length){setPreset(x.catalog[0].id);setBaseUrl(x.catalog[0].baseUrl||"");setModel(x.catalog[0].defaultModel||"")}})},[]);function pick(id:string){const x=catalog.find(c=>c.id===id);setPreset(id);setName((x?.name||"Provider")+" custom");setBaseUrl(x?.baseUrl||"");setModel(x?.defaultModel||"")}async function submit(){setError("");try{const r=await fetch("/api/providers",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({preset,name,model,apiKey,baseUrl,priority})});const x=await r.json();if(!r.ok)throw new Error(x.error||"Could not save");p.created(x)}catch(e){setError(String(e))}}return <div className="modalBackdrop" onMouseDown={e=>e.currentTarget===e.target&&p.close()}><div className="modalCard"><div className="modalHeader"><div><div className="eyebrow">MODEL ROUTING</div><h3>Add APIs</h3><p>Add an external model once, then use it from Chat, Agents, Skills and Automations. API keys are stored encrypted by the local core.</p></div><button className="iconButton" onClick={p.close}><X size={17}/></button></div><div className="modalGrid"><label>Provider<select value={preset} onChange={e=>pick(e.target.value)}>{catalog.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label><label>Model identifier<input value={model} onChange={e=>setModel(e.target.value)}/></label><label>Display name<input value={name} onChange={e=>setName(e.target.value)}/></label><label>Priority<input type="number" min="1" value={priority} onChange={e=>setPriority(e.target.value)}/></label><label className="wide">API key<input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="Paste once; stored encrypted"/></label><label className="wide">Base URL<input value={baseUrl} onChange={e=>setBaseUrl(e.target.value)}/></label></div>{error&&<div className="errorBanner">{error}</div>}<div className="modalFooter"><span>{catalog.length||31} provider presets · priority failover</span><button className="primaryButton" onClick={submit}><Cpu size={14}/> Save model</button></div></div></div>}
