const {app,BrowserWindow}=require("electron");
const {spawn}=require("child_process");
const path=require("path");
let core;
function startCore(){const root=app.getAppPath();core=spawn(process.execPath,[path.join(root,"server","index.mjs")],{cwd:root,env:{...process.env,PORT:"4174",LEVELING_WORKSPACE:path.join(app.getPath("userData"),"workspace"),ELECTRON_RUN_AS_NODE:"1"},stdio:"ignore"});}
function createWindow(){const win=new BrowserWindow({width:1440,height:920,minWidth:980,minHeight:680,backgroundColor:"#060910",webPreferences:{contextIsolation:true,nodeIntegration:false}});win.loadURL("http://127.0.0.1:4174");}
app.whenReady().then(()=>{startCore();setTimeout(createWindow,900);});
app.on("window-all-closed",()=>{if(core)core.kill();if(process.platform!=="darwin")app.quit();});
