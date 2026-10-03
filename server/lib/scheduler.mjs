export function parseDailySchedule(schedule){
  const m=String(schedule||"").trim().match(/^daily\s+(\d{1,2}):(\d{2})$/i);
  if(!m) return null;
  const hour=Number(m[1]),minute=Number(m[2]);
  if(hour>23||minute>59) return null;
  return {hour,minute};
}
export function isDueToday(task,now=new Date()){
  if(!task.enabled) return false;
  const p=parseDailySchedule(task.schedule);if(!p) return false;
  if(task.lastRun){
    const last=new Date(task.lastRun);
    if(last.getFullYear()===now.getFullYear()&&last.getMonth()===now.getMonth()&&last.getDate()===now.getDate()) return false;
  }
  return now.getHours()===p.hour&&now.getMinutes()===p.minute;
}
