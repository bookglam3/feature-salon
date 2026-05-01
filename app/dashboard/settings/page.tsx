import DashboardSidebar from "../Sidebar";

export default function SettingsPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#F2F4F7", display: "flex" }}>
      <DashboardSidebar />
      <main style={{ flex: 1, backgroundColor: "#F2F4F7", padding: "28px 32px" }}>
        <div style={{ backgroundColor: "#ffffff", borderRadius: "20px", border: "0.5px solid #E8EAF0", padding: "28px" }}>
          <h1 style={{ margin: 0, fontSize: "28px", color: "#0F172A" }}>Settings</h1>
          <p style={{ marginTop: "12px", color: "#64748B", fontSize: "14px" }}>Manage your salon settings and preferences.</p>
        </div>
      </main>
    </div>
  );
}
