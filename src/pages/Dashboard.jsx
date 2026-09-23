import { Activity, CheckCircle2, Clock3, ListTodo, Play, ShieldCheck, TimerReset } from "lucide-react";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import VerificationModal from "../components/VerificationModal";
import { intern } from "../constants/app";
import { formatDuration, useSessionClock } from "../hooks/useSession";
import { useState } from "react";

const tasks = [
  { id:"TASK-01", title:"DevOps, Deployment & Release Management", project:"Intern Manager", progress:72, status:"In Progress", priority:"High" },
  { id:"TASK-02", title:"Vercel & Render Setup", project:"Deployment", progress:100, status:"Submitted", priority:"Medium" },
  { id:"TASK-03", title:"Frontend API Service Architecture", project:"Intern Manager", progress:40, status:"In Progress", priority:"High" }
];

export default function Dashboard() {
  const seconds = useSessionClock(16350, true);
  const [verify, setVerify] = useState(false);
  const [verifyState, setVerifyState] = useState("UNVERIFIED");
  const completed = 545;
  const percent = Math.round((seconds / 28800) * 100);
  const doVerify = () => { setVerifyState("VERIFIED"); };
  return (
    <>
      <div className="page-header">
        <div><div className="eyebrow">Wednesday, 23 September 2026</div><h1>Good morning, {intern.name.split(" ")[0]}.</h1><p>{intern.designation} · {intern.department}</p></div>
        <StatusBadge tone="success"><Activity size={13}/> Active</StatusBadge>
      </div>

      <div className="hero-session">
        <div className="session-copy">
          <div className="eyebrow">Official work session</div>
          <h2>{formatDuration(seconds)}</h2>
          <div className="session-target"><span>Official target</span><strong>08:00:00</strong></div>
          <div className="progress"><span style={{width:`${Math.min(percent,100)}%`}}/></div>
          <div className="progress-meta"><span>{Math.min(percent,100)}% complete</span><span>Backend authoritative</span></div>
        </div>
        <div className="session-ring"><div><strong>{completed}</strong><span>/ 960</span><small>30-sec sessions</small></div></div>
        <div className="session-actions">
          <button className="btn btn-primary"><Play size={16}/> Work Session Active</button>
          <button className="btn btn-secondary" onClick={() => setVerify(true)}><ShieldCheck size={16}/> Verify Presence</button>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Clock3} label="Work time today" value={formatDuration(seconds)} detail="Official session display" tone="blue"/>
        <StatCard icon={TimerReset} label="30-sec sessions" value={`${completed} / 960`} detail={`${960-completed} remaining`} tone="purple"/>
        <StatCard icon={ListTodo} label="Assigned tasks" value="3" detail="2 currently active" tone="green"/>
        <StatCard icon={CheckCircle2} label="Completed today" value="1" detail="Submission received" tone="orange"/>
      </div>

      <div className="two-col">
        <Card>
          <div className="card-header"><div><div className="eyebrow">Today</div><h2>Assigned tasks</h2></div><a href="/tasks">View all</a></div>
          <div className="task-list">
            {tasks.map(t => <div className="task-row" key={t.id}>
              <div className="task-main"><span className="task-id">{t.id}</span><strong>{t.title}</strong><span>{t.project}</span></div>
              <div className="task-progress"><div className="progress small"><span style={{width:`${t.progress}%`}}/></div><small>{t.progress}%</small></div>
              <StatusBadge tone={t.status==="Submitted"?"success":"warning"}>{t.status}</StatusBadge>
            </div>)}
          </div>
        </Card>
        <Card>
          <div className="card-header"><div><div className="eyebrow">Presence</div><h2>Verification status</h2></div></div>
          <div className="verification-summary"><div className="verify-icon"><ShieldCheck/></div><div><strong>{verifyState === "VERIFIED" ? "Presence Verified" : "Verification Required"}</strong><p>{verifyState === "VERIFIED" ? "Your latest presence check was successful." : "The backend can request verification approximately every 30 minutes."}</p></div></div>
          <button className="btn btn-secondary btn-wide" onClick={() => setVerify(true)}>Open verification</button>
        </Card>
      </div>
      <VerificationModal open={verify} state={verifyState} onClose={() => setVerify(false)} onVerify={doVerify}/>
    </>
  );
}