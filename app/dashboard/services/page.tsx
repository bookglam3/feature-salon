"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "../../lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import ServiceModal from "../components/ServiceModal";
import EmptyState from "../components/EmptyState";
import { SkeletonDashboard } from "../components/SkeletonLoader";
import type { Service, ServiceCategory } from "../../types";

// ─── Service row (used in the grouped services list) ───────────
function ServiceRow({ service, onEdit, onDelete }: { service: Service; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "0.5px solid #ECE9F1" }}>
      <div>
        <div style={{ fontSize: "13px", color: "#12101A", fontWeight: 600 }}>{service.name}</div>
        <div style={{ fontSize: "12px", color: "#524D60" }}>
          {((service.duration_minutes ?? 0) > 0 || (service.duration ?? 0) > 0) ? `${service.duration_minutes ?? service.duration} min · ` : ""}{service.price_is_from ? "from " : ""}£{service.price}
        </div>
        {service.description && (
          <div style={{ fontSize: "11.5px", color: "#524D60", marginTop: 2, fontStyle: "italic" }}>{service.description}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onEdit} style={{ color: "#7C3AED", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600 }}>✏️ Edit</button>
        <button onClick={onDelete} style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 500 }}>Delete</button>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: "#ffffff", borderRadius: "16px",
  border: "0.5px solid #ECE9F1", padding: "24px", marginBottom: "20px",
};

export default function ServicesPage() {
  const router = useRouter();
  const [salon, setSalon] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [serviceModalOpen, setServiceModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [serviceError, setServiceError] = useState("");

  // Category management (rename / reorder / delete / quick-add)
  const [categoryActionError, setCategoryActionError] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [renamingCategoryId, setRenamingCategoryId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deletingCategory, setDeletingCategory] = useState<ServiceCategory | null>(null);

  const groupedServices = useMemo(() => {
    const byCategory = new Map<string, Service[]>();
    const uncategorised: Service[] = [];
    services.forEach(s => {
      if (s.category_id) {
        if (!byCategory.has(s.category_id)) byCategory.set(s.category_id, []);
        byCategory.get(s.category_id)!.push(s);
      } else {
        uncategorised.push(s);
      }
    });
    // Tiebreak on price, not name: /api/services has always returned services
    // price-ascending, and every existing row has sort_order = 0 (no backfill).
    // Tying to price makes this sort a no-op for untouched businesses — their
    // order is visually identical to before. sort_order only starts overriding
    // it once a business actually reorders their categories/services.
    const sortSvc = (a: Service, b: Service) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.price - b.price;
    const groups = [...categories]
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(cat => ({ category: cat, services: (byCategory.get(cat.id) || []).sort(sortSvc) }));
    return { groups, uncategorised: uncategorised.sort(sortSvc) };
  }, [services, categories]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const reloadServices = async () => {
    const token = await getToken();
    const res = await fetch("/api/services", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const json = await res.json(); setServices(json.services || []); }
  };

  const reloadCategories = async () => {
    const token = await getToken();
    const res = await fetch("/api/service-categories", { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) { const json = await res.json(); setCategories(json.categories || []); }
  };

  useEffect(() => {
    (async () => {
      const profile = await getCurrentUserProfile();
      if (!profile) { router.push("/login"); return; }
      setSalon(profile.salon);

      const token = await getToken();
      const [svcRes, catRes] = await Promise.all([
        fetch("/api/services", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/service-categories", { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (svcRes.ok) { const json = await svcRes.json(); setServices(json.services || []); }
      if (catRes.ok) { const json = await catRes.json(); setCategories(json.categories || []); }

      setLoading(false);
    })();
  }, [router]);

  const handleAddCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCategoryActionError("");
    const token = await getToken();
    const res = await fetch("/api/service-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    const json = await res.json();
    if (!res.ok) { setCategoryActionError(json.error || "Failed to add category"); return; }
    setNewCategoryName("");
    setAddingCategory(false);
    await reloadCategories();
  };

  const submitRenameCategory = async (cat: ServiceCategory) => {
    const name = renameValue.trim();
    if (!name) return;
    setCategoryActionError("");
    const token = await getToken();
    const res = await fetch("/api/service-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: cat.id, name }),
    });
    const json = await res.json();
    if (!res.ok) { setCategoryActionError(json.error || "Failed to rename category"); return; }
    setRenamingCategoryId(null);
    await reloadCategories();
  };

  const handleMoveCategory = async (cat: ServiceCategory, direction: "up" | "down") => {
    setCategoryActionError("");
    const token = await getToken();
    const res = await fetch("/api/service-categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: cat.id, move: direction }),
    });
    if (!res.ok) { const json = await res.json().catch(() => ({})); setCategoryActionError(json.error || "Failed to reorder"); return; }
    await reloadCategories();
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory) return;
    setCategoryActionError("");
    const token = await getToken();
    const res = await fetch("/api/service-categories", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id: deletingCategory.id }),
    });
    const json = await res.json();
    if (!res.ok) { setCategoryActionError(json.error || "Failed to delete category"); return; }
    setDeletingCategory(null);
    await Promise.all([reloadCategories(), reloadServices()]);
  };

  const handleDeleteService = async (id: string) => {
    const { data: linked } = await supabase.from("appointments").select("id").eq("service_id", id).limit(1);
    const hasBookings = linked && linked.length > 0;
    const msg = hasBookings
      ? "This service has existing bookings. Deleting it will not remove those bookings, but they will show no service. Continue?"
      : "Delete this service? This cannot be undone.";
    if (!window.confirm(msg)) return;
    const token = await getToken();
    const res = await fetch("/api/services", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id }),
    });
    const json = await res.json();
    if (!res.ok) { setServiceError("Delete failed: " + (json.error || res.statusText)); return; }
    setServices(prev => prev.filter(s => s.id !== id));
  };

  if (loading) return <DashboardShell salonName=""><SkeletonDashboard /></DashboardShell>;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn onClick={() => {}} />
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px" }}>Services</div>
          <div style={{ fontSize: 11.5, color: "#6B6577" }}>{services.length} service{services.length !== 1 ? "s" : ""}</div>
        </div>
      </div>
      <button onClick={() => { setEditingService(null); setServiceModalOpen(true); }} style={{ background: "#7C3AED", color: "#fff", fontSize: 13, fontWeight: 600, padding: "8px 16px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer", boxShadow: "0 4px 14px rgba(124,58,237,0.25)", whiteSpace: "nowrap", transition: "all 0.14s" }}
        onMouseEnter={e => { e.currentTarget.style.background = "#6D28D9"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#7C3AED"; }}
      >+ Add Service</button>
    </header>
  );

  return (
    <DashboardShell salonName={salon?.name} topbar={Topbar}>
      <div style={{ padding: "24px 20px" }}>

        <div style={cardStyle}>
          {serviceError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#DC2626", fontWeight: 500 }}>
              ⚠️ {serviceError}
            </div>
          )}
          {categoryActionError && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#DC2626", fontWeight: 500 }}>
              ⚠️ {categoryActionError}
            </div>
          )}

          {/* Category management */}
          <div style={{ marginBottom: 22, padding: "14px 16px", background: "#F5F3FF", border: "1px solid #ECE9F1", borderRadius: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#524D60", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 10 }}>Categories</div>

            {categories.length === 0 && !addingCategory && (
              <p style={{ fontSize: 12.5, color: "#524D60", marginBottom: 10, lineHeight: 1.6 }}>
                Group your services into categories (e.g. &quot;Womens Cuts&quot;, &quot;Colour Treatments&quot;) so clients can filter them on your booking page.
              </p>
            )}

            {categories.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                {[...categories].sort((a, b) => a.sort_order - b.sort_order).map((cat, i, arr) => {
                  const countInCat = services.filter(s => s.category_id === cat.id).length;
                  return (
                    <div key={cat.id}>
                      {deletingCategory?.id === cat.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12.5, color: "#991B1B", flex: 1, minWidth: 180 }}>
                            Delete &quot;{cat.name}&quot;? {countInCat} service{countInCat !== 1 ? "s" : ""} will become uncategorised.
                          </span>
                          <button onClick={confirmDeleteCategory} style={{ padding: "5px 12px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Delete</button>
                          <button onClick={() => setDeletingCategory(null)} style={{ padding: "5px 12px", background: "none", border: "1px solid #D6D1DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#524D60" }}>Cancel</button>
                        </div>
                      ) : renamingCategoryId === cat.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <input
                            value={renameValue}
                            onChange={e => setRenameValue(e.target.value)}
                            autoFocus
                            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submitRenameCategory(cat); } if (e.key === "Escape") setRenamingCategoryId(null); }}
                            style={{ flex: 1, padding: "6px 10px", fontSize: 12.5, border: "1.5px solid #7C3AED", borderRadius: 6, color: "#12101A" }}
                          />
                          <button onClick={() => submitRenameCategory(cat)} style={{ padding: "5px 10px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Save</button>
                          <button onClick={() => setRenamingCategoryId(null)} style={{ padding: "5px 10px", background: "none", border: "1px solid #D6D1DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#524D60" }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                            <button onClick={() => handleMoveCategory(cat, "up")} disabled={i === 0} aria-label={`Move ${cat.name} up`} style={{ background: "none", border: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#D6D1DE" : "#524D60", fontSize: 10, padding: 0, lineHeight: 1 }}>▲</button>
                            <button onClick={() => handleMoveCategory(cat, "down")} disabled={i === arr.length - 1} aria-label={`Move ${cat.name} down`} style={{ background: "none", border: "none", cursor: i === arr.length - 1 ? "default" : "pointer", color: i === arr.length - 1 ? "#D6D1DE" : "#524D60", fontSize: 10, padding: 0, lineHeight: 1 }}>▼</button>
                          </div>
                          <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "#12101A" }}>{cat.name}</span>
                          <span style={{ fontSize: 11, color: "#6B6577" }}>{countInCat}</span>
                          <button onClick={() => { setRenamingCategoryId(cat.id); setRenameValue(cat.name); }} aria-label={`Rename ${cat.name}`} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "#524D60", padding: "2px 4px" }}>✏️</button>
                          <button onClick={() => setDeletingCategory(cat)} aria-label={`Delete ${cat.name}`} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: "#EF4444", padding: "2px 4px" }}>🗑️</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!addingCategory ? (
              <button onClick={() => setAddingCategory(true)} style={{ background: "none", border: "none", color: "#7C3AED", fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>+ Add Category</button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  autoFocus
                  placeholder="Category name"
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddCategory(); } }}
                  style={{ flex: 1, padding: "7px 10px", fontSize: 12.5, border: "1.5px solid #7C3AED", borderRadius: 6, color: "#12101A" }}
                />
                <button onClick={handleAddCategory} disabled={!newCategoryName.trim()} style={{ padding: "6px 12px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: newCategoryName.trim() ? 1 : 0.5 }}>Add</button>
                <button onClick={() => { setAddingCategory(false); setNewCategoryName(""); }} style={{ padding: "6px 10px", background: "none", border: "1px solid #D6D1DE", borderRadius: 6, fontSize: 12, cursor: "pointer", color: "#524D60" }}>✕</button>
              </div>
            )}
          </div>

          {/* Grouped services list */}
          {services.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No services yet"
              description="Add your first service to get started"
              action={{ label: "+ Add Service", onClick: () => { setEditingService(null); setServiceModalOpen(true); } }}
            />
          ) : (
            <>
              {groupedServices.groups.filter(g => g.services.length > 0).map(g => (
                <div key={g.category.id} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 6 }}>{g.category.name}</div>
                  {g.services.map(s => (
                    <ServiceRow key={s.id} service={s}
                      onEdit={() => { setEditingService(s); setServiceModalOpen(true); }}
                      onDelete={() => handleDeleteService(s.id)}
                    />
                  ))}
                </div>
              ))}
              {groupedServices.uncategorised.length > 0 && (
                <div>
                  {categories.length > 0 && (
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6B6577", letterSpacing: "0.6px", textTransform: "uppercase", marginBottom: 6 }}>Uncategorised</div>
                  )}
                  {groupedServices.uncategorised.map(s => (
                    <ServiceRow key={s.id} service={s}
                      onEdit={() => { setEditingService(s); setServiceModalOpen(true); }}
                      onDelete={() => handleDeleteService(s.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </div>

      <ServiceModal
        open={serviceModalOpen}
        onClose={() => { setServiceModalOpen(false); setEditingService(null); }}
        editingService={editingService}
        categories={categories}
        onCategoriesChange={setCategories}
        onSaved={reloadServices}
      />
    </DashboardShell>
  );
}
