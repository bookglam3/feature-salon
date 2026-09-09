export default function BookingsLoading() {
  return (
    <div style={{ padding: "24px 20px" }}>
      {/* Filter bar skeleton */}
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div className="skeleton" style={{ flex: 1, height: 40, borderRadius: 11 }} />
        <div className="skeleton" style={{ width: 280, height: 40, borderRadius: 10 }} />
      </div>
      {/* Table skeleton */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #ECE9F1",
        borderRadius: 20, overflow: "hidden",
        boxShadow: "0 1px 3px rgba(18,16,26,0.06)",
      }}>
        {/* thead */}
        <div style={{ background: "#F5F3FF", borderBottom: "1px solid #ECE9F1", padding: "11px 18px", display: "flex", gap: 20 }}>
          {[60, 120, 100, 80, 130, 60, 80].map((w, i) => (
            <div key={i} className="skeleton" style={{ width: w, height: 10, borderRadius: 5 }} />
          ))}
        </div>
        {/* rows */}
        {[...Array(7)].map((_, i) => (
          <div key={i} style={{ padding: "14px 18px", borderBottom: "1px solid #ECE9F1", display: "flex", gap: 20, alignItems: "center" }}>
            <div className="skeleton" style={{ width: 68, height: 22, borderRadius: 99 }} />
            <div className="skeleton" style={{ width: 110, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 90, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 70, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 120, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ width: 50, height: 12, borderRadius: 6 }} />
            <div className="skeleton" style={{ flex: 1, height: 12, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
