import { MessageSquare, Search, Info } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";

// No performance data exists yet — Adarsh's performance API (server/src/routes/performance.routes.ts)
// works, but nobody has evaluated any of these test accounts. Shows an honest "not yet available"
// state rather than a fake score, per the task doc's explicit rule against inventing one.
const interns = ["Demo Intern", "Second Intern"];

export default function AdminPerformance() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="Performance Review" description="Review backend-provided attendance, work sessions, task completion, deadline adherence, reports and feedback."/>
      <div className="alert" style={{ background: "#322817", color: "#ffd58b", borderColor: "#664d20" }}>
        <Info size={16}/> No performance data has been recorded yet. Nothing here is invented — it stays blank until Adarsh's backend has real evaluations.
      </div>
      <Card>
        <div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Search intern..."/></div></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Intern</th><th>Attendance</th><th>Work sessions</th><th>Task completion</th><th>Reports</th><th>Feedback</th></tr></thead>
            <tbody>
              {interns.map((n) => (
                <tr key={n}>
                  <td><strong>{n}</strong></td>
                  <td className="muted">Not yet available</td>
                  <td className="muted">Not yet available</td>
                  <td className="muted">Not yet available</td>
                  <td className="muted">Not yet available</td>
                  <td><button className="btn btn-ghost"><MessageSquare size={15}/> Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
