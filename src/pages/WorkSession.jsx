import { Pause, Play, ShieldCheck, Coffee, RotateCcw } from "lucide-react";
import { useState } from "react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatDuration, useSessionClock } from "../hooks/useSession";

export default function WorkSession(){
  const [state,setState]=useState("ACTIVE");
  const seconds=useSessionClock(16350,state==="ACTIVE");
  const badgeTone={ACTIVE:"success",BREAK:"warning",UNVERIFIED:"danger",COMPLETED:"success"}[state]||"default";
  return <>
    <PageHeader eyebrow="Attendance / session" title="Work Session" description="Official attendance data is authoritative on the backend. This screen is the presentation layer." action={<StatusBadge tone={badgeTone}>{state}</StatusBadge>}/>
    <div className="session-page-grid">
      <Card className="session-big"><div className="eyebrow">Official work session</div><div className="big-timer">{state==="BREAK"?"On Break":formatDuration(seconds)}</div><p>Target: 08:00:00 · 30-second sessions: 545 / 960</p><div className="progress"><span style={{width:"57%"}}/></div><div className="button-row">
        {state==="ACTIVE" && <button className="btn btn-secondary" onClick={()=>setState("BREAK")}><Coffee/> Take Break</button>}
        {state==="BREAK" && <button className="btn btn-primary" onClick={()=>setState("ACTIVE")}><Play/> Resume Work</button>}
        {state==="ACTIVE" && <button className="btn btn-ghost" onClick={()=>setState("COMPLETED")}><Pause/> Mark UI Completed</button>}
      </div></Card>
      <div className="stack">
        <Card><div className="card-title"><RotateCcw/> Session state</div><div className="state-list">{["NOT STARTED","ACTIVE","BREAK","UNVERIFIED","COMPLETED"].map(s=><button key={s} className={state===s?"state-item selected":"state-item"} onClick={()=>setState(s)}>{s}</button>)}</div></Card>
        <Card><div className="card-title"><ShieldCheck/> Presence verification</div><p className="muted">Handled globally by the platform: the backend requests a check about every 30 minutes, and the popup appears on its own wherever you are in the app.</p></Card>
      </div>
    </div>
  </>;
}