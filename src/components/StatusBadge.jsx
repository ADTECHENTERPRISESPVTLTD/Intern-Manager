export default function StatusBadge({ children, tone = "default" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}