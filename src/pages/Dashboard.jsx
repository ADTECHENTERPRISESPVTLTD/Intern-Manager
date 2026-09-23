import { Activity, CheckCircle2, Clock3, ListTodo, Play, ShieldCheck, TimerReset } from "lucide-react";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { formatDuration } from "../hooks/useSession";
import { useVerificationStatus } from "../verificationContext";
import { useWorkSession } from "../sessionContext";
import { useAuth } from "../authContext";

const tasks = [
  { id:"TASK-01", title:"DevOps, Deployment & Release Management", project:"Intern Manager", progress:72, status:"In Progress", priority:"High" },
  { id:"TASK-02", title:"Vercel & Render Setup", project:"Deployment", progress:100, status:"Submitted", priority:"Medium" },
  { id:"TASK-03", title:"Frontend API Service Architecture", project:"Intern Manager", progress:40, status:"In Progress", priority:"High" }
];

const STATUS_LABEL = { ACTIVE: "Active", BREAK: "On Break", COMPLETED: "Completed" };

export default function Dashboard() {
  const { user } = useAuth();
  const { session, start } = useWorkSession();
  const { status } = useVerificationStatus();
  // Real value once the backend has answered at least once; "Checking..." only very briefly on load.
  const verifyState = status?.sessionVerificationStatus ?? "CHECKING";

  const sessionStatus = session?.status ?? "NOT_STARTED";
  const seconds = session?.activeSeconds ?? 0;
  const target = session?.targetSeconds ?? 28800;
  const percent = Math.min(100, Math.round((seconds / target) * 100));
  const completed = session?.completedIntervals ?? 0;
  const total = session ? Math.round(session.targetSeconds / 30) : 960;

  return (
    <>
      <div className="page-header">
        <div><div className="eyebrow">Wednesday, 23 September 2026</div><h1>Good morning, {user?.name?.split(" ")[0] ?? ""}.</h1><p>{user?.designation}</p></div>
        <StatusBadge tone={sessionStatus === "ACTIVE" ? "success" : "default"}><Activity size={13}/> {STATUS_LABEL[sessionStatus] ?? "Not started"}</StatusBadge>
      </div>

      <div className="hero-session">
        <div className="session-copy">
          <div className="eyebrow">Official work session</div>
          <h2>{sessionStatus === "BREAK" ? "On Break" : formatDuration(seconds)}</h2>
          <div className="session-target"><span>Official target</span><strong>{formatDuration(target)}</strong></div>
          <div className="progress"><span style={{width:`${percent}%`}}/></div>
          <div className="progress-meta"><span>{percent}% complete</span><span>Backend authoritative</span></div>
        </div>
        <div className="session-ring"><div><strong>{completed}</strong><span>/ {total}</span><small>30-sec sessions</small></div></div>
        <div className="session-actions">
          {sessionStatus === "NOT_STARTED" || sessionStatus === "COMPLETED" ? (
            <button className="btn btn-primary" onClick={start}><Play size={16}/> Start Official Work Session</button>
          ) : (
            <button className="btn btn-primary" disabled><Play size={16}/> {STATUS_LABEL[sessionStatus] ?? "Work Session Active"}</button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard icon={Clock3} label="Work time today" value={formatDuration(seconds)} detail="Official session display" tone="blue"/>
        <StatCard icon={TimerReset} label="30-sec sessions" value={`${completed} / ${total}`} detail={`${total-completed} remaining`} tone="purple"/>
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
          <div className="verification-summary"><div className="verify-icon"><ShieldCheck/></div><div><strong>{{
            VERIFIED: "Presence Verified", UNVERIFIED: "Presence Unverified", PENDING: "Verification In Progress",
          }[verifyState] ?? "Verification Required"}</strong><p>The backend requests verification automatically, about every 30 minutes. There is nothing for you to click unless a check is due.</p></div></div>
        </Card>
      </div>
    </>
  );
}