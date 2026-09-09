export default function StaffLoading() {
  return (
    <div style={{ padding: "28px 24px" }}>
      <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 8, marginBottom: 20 }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div className="skeleton" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div className="skeleton" style={{ width: 120, height: 14, borderRadius: 6, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: 80, height: 11, borderRadius: 6 }} />
              </div>
            </div>
            <div className="skeleton" style={{ height: 36, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
