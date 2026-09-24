import { Plus, Pencil, Archive, Info } from "lucide-react";
import { useState } from "react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";

// SAMPLE DATA — not connected to a real backend. Adarsh's task API (server/src/routes/task.routes.ts)
// exists and works, but nobody has seeded any real tasks for these test accounts yet. Shown as sample
// so this page is never mistaken for real data (the task doc explicitly warns against that).
const seed = [
  ["TASK-01", "Sample task — DevOps, Deployment & Release Management", "Sample Intern", "High", "In Progress"],
  ["TASK-02", "Sample task — Vercel & Render Setup", "Sample Intern", "Medium", "Submitted"],
];

export default function AdminTasks() {
  const [tasks, setTasks] = useState(seed);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const add = () => {
    if (!title.trim()) return;
    setTasks([...tasks, [`TASK-${String(tasks.length + 1).padStart(2, "0")}`, title, "Unassigned", "Medium", "Not Started"]]);
    setTitle("");
    setOpen(false);
  };
  return (
    <>
      <PageHeader eyebrow="Administration" title="Task Management" description="Create, edit, assign and archive intern tasks."
        action={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus size={16}/> Create Task</button>}/>
      <div className="alert" style={{ background: "#322817", color: "#ffd58b", borderColor: "#664d20" }}>
        <Info size={16}/> Sample data for now — not saved anywhere. Real tasks need Adarsh's task API connected to this page.
      </div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Title</th><th>Assigned intern</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t[0]}>
                  <td>{t[0]}</td><td><strong>{t[1]}</strong></td><td>{t[2]}</td><td>{t[3]}</td><td>{t[4]}</td>
                  <td><div className="button-row"><button className="icon-btn"><Pencil size={15}/></button><button className="icon-btn danger"><Archive size={15}/></button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {open && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="eyebrow">Task management</div>
            <h2>Create Task</h2>
            <p className="muted" style={{ marginTop: -8 }}>This only adds a row to this page — it is not saved to any backend yet.</p>
            <label>Task title<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title"/></label>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={add}>Create Task</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
