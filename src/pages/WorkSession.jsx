import { Play, ShieldCheck, Coffee } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatDuration } from "../hooks/useSession";
import { useWorkSession } from "../sessionContext";

const BADGE_TONE = { ACTIVE: "success", BREAK: "warning", COMPLETED: "success" };
const LABEL = { ACTIVE: "Work Session Active", BREAK: "Break Active", COMPLETED: "8-Hour Work Session Completed" };

export default function WorkSession() {
  const { session, error, start, takeBreak, resume } = useWorkSession();
  const status = session?.status ?? "NOT_STARTED";
  const seconds = session?.activeSeconds ?? 0;
  const target = session?.targetSeconds ?? 28800;
  const percent = Math.min(100, Math.round((seconds / target) * 100));
  const interval = 30;
  const completed = session?.completedIntervals ?? 0;
  const total = session ? Math.round(session.targetSeconds / interval) : 960;

  return (
    <>
      <PageHeader
        eyebrow="Attendance / session"
        title="Work Session"
        description="Official attendance data is authoritative on the backend. This screen is the presentation layer."
        action={<StatusBadge tone={BADGE_TONE[status] ?? "default"}>{status === "NOT_STARTED" ? "Not started" : status}</StatusBadge>}
      />
      <div className="session-page-grid">
        <Card className="session-big">
          <div className="eyebrow">Official work session</div>
          <div className="big-timer">{status === "BREAK" ? "On Break" : formatDuration(seconds)}</div>
          <p>Target: {formatDuration(target)} · 30-second sessions: {completed} / {total}</p>
          <div className="progress"><span style={{ width: `${percent}%` }}/></div>
          {error && <p className="login-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          <div className="button-row">
            {status === "NOT_STARTED" && <button className="btn btn-primary" onClick={start}><Play/> Start Official Work Session</button>}
            {status === "ACTIVE" && <button className="btn btn-secondary" onClick={takeBreak}><Coffee/> Take Break</button>}
            {status === "BREAK" && <button className="btn btn-primary" onClick={resume}><Play/> Resume Work</button>}
            {status === "COMPLETED" && <button className="btn btn-primary" onClick={start}><Play/> Start Official Work Session</button>}
          </div>
        </Card>
        <div className="stack">
          <Card>
            <div className="card-title"><ShieldCheck/> Presence verification</div>
            <p className="muted">Handled globally by the platform: the backend requests a check about every 30 minutes, and the popup appears on its own wherever you are in the app.</p>
          </Card>
        </div>
      </div>
    </>
  );
}
