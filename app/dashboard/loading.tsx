export default function DashboardLoading() {
  return (
    <div style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>
      {/* Banner skeleton */}
      <div className="skeleton" style={{ height: 110, borderRadius: 24, marginBottom: 20 }} />
      {/* Stats skeleton */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 20 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            background: "#FFFFFF",
            border: "1px solid #ECE9F1",
            borderRadius: 18, padding: "20px 18px",
            display: "flex", flexDirection: "column", gap: 14,
            position: "relative", overflow: "hidden",
          }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,rgba(124,58,237,0.35),transparent)", borderRadius: "18px 18px 0 0" }} />
            <div className="skeleton" style={{ height: 10, width: "60%", borderRadius: 5 }} />
            <div className="skeleton" style={{ height: 32, width: "45%", borderRadius: 6 }} />
          </div>
        ))}
      </div>
      {/* Quick actions skeleton */}
      <div className="skeleton" style={{ height: 80, borderRadius: 20, marginBottom: 20 }} />
      {/* Table skeleton */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #ECE9F1",
        borderRadius: 20, overflow: "hidden",
      }}>
        <div className="skeleton" style={{ height: 48, borderRadius: 0 }} />
        {[...Array(5)].map((_, i) => (
          <div key={i} style={{ padding: "14px 22px", borderBottom: "1px solid #ECE9F1", display: "flex", gap: 16, alignItems: "center" }}>
            <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 80, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 60, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ flex: 1, height: 12, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
