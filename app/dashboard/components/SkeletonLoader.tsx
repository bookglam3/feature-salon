/* ── Skeleton shimmer blocks — DARK PREMIUM ── */
export function SkeletonBox({ w = "100%", h = 16, r = 8 }: { w?: string | number; h?: number; r?: number }) {
  return (
    <div
      className="skeleton"
      style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #ECE9F1",
      borderRadius: 18,
      padding: "20px 18px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* top accent */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,rgba(124,58,237,0.4),transparent)", borderRadius: "18px 18px 0 0" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <SkeletonBox w={80} h={10} />
        <SkeletonBox w={36} h={36} r={10} />
      </div>
      <SkeletonBox w={60} h={32} r={6} />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div style={{
      display: "flex",
      gap: 16,
      alignItems: "center",
      padding: "14px 20px",
      borderBottom: "1px solid #ECE9F1",
    }}>
      <SkeletonBox w={60} h={22} r={99} />
      <SkeletonBox w={100} h={10} />
      <SkeletonBox w={80} h={10} />
      <SkeletonBox w={60} h={10} />
      <SkeletonBox w={80} h={10} />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "#FFFFFF",
      border: "1px solid #ECE9F1",
      borderRadius: 14,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <SkeletonBox w={120} h={14} />
        <SkeletonBox w={60} h={20} r={99} />
      </div>
      <SkeletonBox w="70%" h={10} />
      <SkeletonBox w="50%" h={10} />
    </div>
  );
}

export function SkeletonDashboard() {
  return (
    <div style={{ padding: "28px 24px" }}>
      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
        {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
      </div>
      {/* Section card */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #ECE9F1",
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 20,
      }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #ECE9F1" }}>
          <SkeletonBox w={140} h={14} />
        </div>
        {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
      </div>
    </div>
  );
}
