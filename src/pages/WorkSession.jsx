import { Play, ShieldCheck, Coffee } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatusBadge from "../components/StatusBadge";
import { formatDuration } from "../hooks/useSession";
import { useWorkSession } from "../sessionContext";
import { useVerificationStatus } from "../verificationContext";

const BADGE_TONE = { ACTIVE: "success", BREAK: "warning", COMPLETED: "success", LOCKED: "warning", INCOMPLETE: "danger" };
const STATUS_LABEL = { LOCKED: "Verification required", INCOMPLETE: "Incomplete" };

export default function WorkSession() {
  const { session, error, start, takeBreak, resume } = useWorkSession();
  const { registered } = useVerificationStatus();
  const navigate = useNavigate();
  const status = session?.status ?? "NOT_STARTED";

  // Same rule as the Dashboard: don't start a session that will immediately fail its first
  // presence check for having no registered face.
  function handleStart() {
    if (registered === false) navigate("/dev-register-face");
    else start();
  }
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
        action={<StatusBadge tone={BADGE_TONE[status] ?? "default"}>{status === "NOT_STARTED" ? "Not started" : (STATUS_LABEL[status] ?? status)}</StatusBadge>}
      />
      <div className="session-page-grid">
        <Card className="session-big">
          <div className="eyebrow">Official work session</div>
          <div className="big-timer">{status === "BREAK" ? "On Break" : status === "LOCKED" ? "Paused" : formatDuration(seconds)}</div>
          <p>Target: {formatDuration(target)} · 30-second sessions: {completed} / {total}</p>
          <div className="progress"><span style={{ width: `${percent}%` }}/></div>
          {error && <p className="login-error" role="alert" style={{ marginTop: 14 }}>{error}</p>}
          {status === "LOCKED" && (
            <p className="login-error" role="alert" style={{ marginTop: 14 }}>
              A presence check failed or timed out. The session is paused and stops counting toward your official hours
              until you pass the verification check that just opened.
            </p>
          )}
          {status === "INCOMPLETE" && (
            <p className="login-error" role="alert" style={{ marginTop: 14 }}>
              This session ended after too many failed presence checks and will not count toward official attendance.
              Start a new session to keep working.
            </p>
          )}
          <div className="button-row">
            {status === "NOT_STARTED" && (
              <button className="btn btn-primary" onClick={handleStart}>
                <Play/> {registered === false ? "Register Your Face to Start" : "Start Official Work Session"}
              </button>
            )}
            {status === "ACTIVE" && <button className="btn btn-secondary" onClick={takeBreak}><Coffee/> Take Break</button>}
            {status === "BREAK" && <button className="btn btn-primary" onClick={resume}><Play/> Resume Work</button>}
            {status === "COMPLETED" && <button className="btn btn-primary" onClick={handleStart}><Play/> Start Official Work Session</button>}
            {status === "INCOMPLETE" && <button className="btn btn-primary" onClick={handleStart}><Play/> Start Official Work Session</button>}
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
