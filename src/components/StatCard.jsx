import Card from "./Card";
export default function StatCard({ icon: Icon, label, value, detail, tone = "" }) {
  return (
    <Card className="stat-card">
      <div className={`stat-icon ${tone}`}>{Icon && <Icon size={19} />}</div>
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {detail && <div className="stat-detail">{detail}</div>}
      </div>
    </Card>
  );
}