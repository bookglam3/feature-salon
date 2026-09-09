export default function SettingsLoading() {
  return (
    <div style={{ padding: "28px 24px", maxWidth: 720 }}>
      <div className="skeleton" style={{ width: 120, height: 28, borderRadius: 8, marginBottom: 24 }} />
      {[...Array(4)].map((_, i) => (
        <div key={i} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: 20, marginBottom: 16 }}>
          <div className="skeleton" style={{ width: 140, height: 14, borderRadius: 6, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 44, borderRadius: 8, marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 44, borderRadius: 8 }} />
        </div>
      ))}
    </div>
  );
}
