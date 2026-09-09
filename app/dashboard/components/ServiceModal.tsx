"use client";
import { useState } from "react";
import { supabase } from "../../lib/supabase";
import Modal, { FormGroup, Input, Select, ModalActions, BtnPrimary, BtnSecondary } from "./Modal";
import type { Service, ServiceCategory, GenderRestriction } from "../../types";

interface ServiceModalProps {
  open: boolean;
  onClose: () => void;
  editingService: Service | null;
  categories: ServiceCategory[];
  onCategoriesChange: (categories: ServiceCategory[]) => void;
  onSaved: () => void;
}

const EMPTY_FORM = {
  name: "", description: "", price: "", duration_minutes: "",
  category_id: "", gender_restriction: "all" as GenderRestriction,
  price_is_from: false,
};

const GENDER_OPTIONS: { value: GenderRestriction; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "female", label: "Female only" },
  { value: "male", label: "Male only" },
];

async function getToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || "";
}

// Outer wrapper: owns nothing but the open/close plumbing. The inner form is
// keyed by the service being edited (or "new"), so it fully remounts — with
// fresh initial state computed directly, no reset-on-open effect needed —
// every time the modal opens for a different service or a blank create.
export default function ServiceModal({
  open, onClose, editingService, categories, onCategoriesChange, onSaved,
}: ServiceModalProps) {
  return (
    <Modal open={open} onClose={onClose} title={editingService ? `Edit ${editingService.name}` : "Add Service"} maxWidth={480}>
      <ServiceModalForm
        key={editingService?.id ?? "new"}
        editingService={editingService}
        categories={categories}
        onCategoriesChange={onCategoriesChange}
        onSaved={onSaved}
        onClose={onClose}
      />
    </Modal>
  );
}

function ServiceModalForm({
  editingService, categories, onCategoriesChange, onSaved, onClose,
}: Omit<ServiceModalProps, "open">) {
  const [form, setForm] = useState(() => editingService ? {
    name: editingService.name || "",
    description: editingService.description || "",
    price: String(editingService.price ?? ""),
    duration_minutes: String(editingService.duration_minutes ?? editingService.duration ?? ""),
    category_id: editingService.category_id || "",
    gender_restriction: (editingService.gender_restriction as GenderRestriction) || "all",
    price_is_from: !!editingService.price_is_from,
  } : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState("");

  const handleCreateCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setCreatingCategory(true);
    setCategoryError("");
    try {
      const token = await getToken();
      const res = await fetch("/api/service-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok) { setCategoryError(json.error || "Failed to create category"); return; }
      onCategoriesChange([...categories, json.category].sort((a, b) => a.sort_order - b.sort_order));
      setForm(f => ({ ...f, category_id: json.category.id }));
      setShowNewCategory(false);
      setNewCategoryName("");
    } catch {
      setCategoryError("Network error — please try again");
    } finally {
      setCreatingCategory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) { setError("Service name is required"); return; }
    const price = parseFloat(form.price);
    if (isNaN(price) || price <= 0) { setError("Price must be greater than 0"); return; }

    setSaving(true);
    try {
      const token = await getToken();
      const payload = {
        name: form.name,
        price: form.price,
        duration_minutes: form.duration_minutes,
        description: form.description,
        category_id: form.category_id || null,
        gender_restriction: form.gender_restriction,
        // price_is_from is a generated column derived from price_type — the
        // checkbox is still the UI for now (Step 2 replaces it with a proper
        // Fixed/From/Free control), so translate it to the wire format here.
        price_type: form.price_is_from ? "from" : "fixed",
      };
      const res = editingService
        ? await fetch("/api/services", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ id: editingService.id, ...payload }),
          })
        : await fetch("/api/services", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Failed to save service"); setSaving(false); return; }
      onSaved();
      onClose();
    } catch {
      setError("Network error — please try again");
    } finally {
      setSaving(false);
    }
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: "#524D60",
    letterSpacing: "0.8px", textTransform: "uppercase", marginBottom: 12, marginTop: 20,
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ ...sectionLabelStyle, marginTop: 0 }}>Basics</div>
      <FormGroup label="Service Name *">
        <Input placeholder="e.g. Womens Haircut" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
      </FormGroup>
      <FormGroup label="Description">
        <Input placeholder="Optional — shown to clients" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
      </FormGroup>

      <div style={sectionLabelStyle}>Pricing</div>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <FormGroup label="Price (£) *">
            <Input type="number" min="0.01" step="0.01" placeholder="25.00" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required />
          </FormGroup>
        </div>
        <div style={{ flex: 1 }}>
          <FormGroup label="Duration (mins)">
            <Input type="number" min="1" placeholder="45" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} />
          </FormGroup>
        </div>
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: form.price_is_from ? 6 : 16 }}>
        <input type="checkbox" checked={form.price_is_from} onChange={e => setForm(f => ({ ...f, price_is_from: e.target.checked }))} />
        <span style={{ fontSize: 13, color: "#12101A" }}>
          Price varies — show as &quot;from £{form.price || "25"}&quot;
        </span>
      </label>
      {form.price_is_from && (
        <p style={{ fontSize: 11.5, color: "#524D60", lineHeight: 1.5, marginBottom: 16, marginLeft: 24 }}>
          Full online payment is unavailable for variable-priced services — clients booking this service can only pay a deposit or pay at the salon.
        </p>
      )}

      <div style={sectionLabelStyle}>Organisation</div>
      <FormGroup label="Category">
        <Select value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
          <option value="">No category</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
      </FormGroup>

      {!showNewCategory ? (
        <button type="button" onClick={() => setShowNewCategory(true)} style={{ background: "none", border: "none", color: "#7C3AED", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0, marginTop: -8, marginBottom: 16 }}>
          + Create new category
        </button>
      ) : (
        <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: -8, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <Input
              placeholder="New category name"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
              autoFocus
            />
            {categoryError && <p style={{ fontSize: 11.5, color: "#DC2626", marginTop: 4 }}>{categoryError}</p>}
          </div>
          <button type="button" onClick={handleCreateCategory} disabled={creatingCategory || !newCategoryName.trim()}
            style={{ padding: "10px 14px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: creatingCategory || !newCategoryName.trim() ? 0.5 : 1, whiteSpace: "nowrap" }}>
            {creatingCategory ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={() => { setShowNewCategory(false); setNewCategoryName(""); setCategoryError(""); }}
            style={{ padding: "10px 12px", background: "#FFFFFF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13, cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}

      <FormGroup label="Who can book this service?">
        <Select value={form.gender_restriction} onChange={e => setForm(f => ({ ...f, gender_restriction: e.target.value as GenderRestriction }))}>
          {GENDER_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </FormGroup>

      {error && (
        <div style={{ marginTop: 4, marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: 12.5, color: "#DC2626" }}>
          ⚠️ {error}
        </div>
      )}

      <ModalActions>
        <BtnSecondary type="button" onClick={onClose}>Cancel</BtnSecondary>
        <BtnPrimary type="submit" disabled={saving}>{saving ? "Saving…" : editingService ? "Save Changes" : "Add Service"}</BtnPrimary>
      </ModalActions>
    </form>
  );
}
