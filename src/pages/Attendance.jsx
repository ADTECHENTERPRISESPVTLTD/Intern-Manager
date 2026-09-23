import { CalendarDays, Coffee, Clock3, ShieldAlert } from "lucide-react";
import Card from "../components/Card";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";

const days=[["1","completed"],["2","completed"],["3","completed"],["4","partial"],["5","completed"],["8","completed"],["9","completed"],["10","absent"],["11","completed"],["12","completed"],["15","completed"],["16","completed"],["17","unverified"],["18","completed"],["19","completed"],["22","completed"],["23","completed"],["24","partial"]];

export default function Attendance(){
  return <>
    <PageHeader eyebrow="Attendance" title="Attendance" description="Official attendance history supplied by the attendance service."/>
    <div className="stats-grid">
      <StatCard icon={CalendarDays} label="Working days" value="22" detail="Current month"/>
      <StatCard icon={Clock3} label="Present days" value="18" detail="Official records"/>
      <StatCard icon={ShieldAlert} label="Partial sessions" value="2" detail="Requires review"/>
      <StatCard icon={Coffee} label="Break entries" value="7" detail="Current month"/>
    </div>
    <div className="two-col">
      <Card><div className="card-header"><h2>September 2026</h2><span className="muted">Current month</span></div><div className="calendar">{days.map(([d,c])=><div className={`calendar-day ${c}`} key={d}><span>{d}</span><i/></div>)}</div><div className="legend"><span><i className="dot completed"/>Completed</span><span><i className="dot partial"/>Partial</span><span><i className="dot absent"/>Absent</span><span><i className="dot unverified"/>Unverified</span></div></Card>
      <Card><div className="card-title">Break history</div><div className="history"><div><strong>23 Sep</strong><span>12:10 PM — 12:35 PM</span><b>25 min</b></div><div><strong>22 Sep</strong><span>01:05 PM — 01:35 PM</span><b>30 min</b></div><div><strong>21 Sep</strong><span>12:55 PM — 01:20 PM</span><b>25 min</b></div></div></Card>
    </div>
  </>;
}