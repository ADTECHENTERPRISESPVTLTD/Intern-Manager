import { BarChart3, CheckCircle2, Clock3, MessageSquare } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
export default function Performance(){
  return <>
    <PageHeader eyebrow="Performance" title="Performance" description="Backend/admin-provided performance information. No frontend score is calculated."/>
    <div className="stats-grid"><Card><div className="metric"><CheckCircle2/><strong>2 / 3</strong><span>Tasks completed/submitted</span></div></Card><Card><div className="metric"><Clock3/><strong>18 days</strong><span>Official present days</span></div></Card><Card><div className="metric"><BarChart3/><strong>History</strong><span>Performance records available</span></div></Card><Card><div className="metric"><MessageSquare/><strong>1</strong><span>Mentor feedback item</span></div></Card></div>
    <Card><div className="card-title">Performance history</div><div className="history"><div><strong>Sep 2026</strong><span>Attendance, task completion and mentor review</span><b>Backend data</b></div><div><strong>Aug 2026</strong><span>Previous internship evaluation</span><b>Backend data</b></div></div></Card>
  </>;
}