"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";

interface Photo { id: string; url: string; caption: string; category: string; is_featured: boolean; created_at: string; }

function getGalleryCategories(bt?: string): string[] {
  switch (bt) {
    case "gym":
    case "pt":     return ["general", "training", "results", "equipment", "before-after"];
    case "yoga":   return ["general", "classes", "studio", "instructors", "before-after"];
    case "physio":
    case "dental": return ["general", "clinic", "team", "equipment", "before-after"];
    case "spa":
    case "massage":return ["general", "treatments", "facilities", "products", "before-after"];
    case "nail":   return ["general", "nails", "nail-art", "gel", "before-after"];
    case "beauty": return ["general", "lashes", "brows", "facial", "before-after"];
    case "barber": return ["general", "haircut", "beard", "styling", "before-after"];
    default:       return ["general", "haircut", "color", "styling", "before-after"];
  }
}

export default function GalleryPage() {
  const router = useRouter();
  const toast = useToast();
  const [salonId, setSalonId] = useState<string | null>(null);
  const [salonName, setSalonName] = useState("");
  const [businessType, setBusinessType] = useState<string | undefined>();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [lightbox, setLightbox] = useState<Photo | null>(null);
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [form, setForm] = useState({ caption: "", category: "general", is_featured: false });
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonId(profile.salon.id);
      setSalonName(profile.salon.name);
      setBusinessType(profile.salon.business_type);
      const { data } = await supabase.from("gallery_photos").select("*").eq("salon_id", profile.salon.id).order("created_at", { ascending: false });
      setPhotos(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith("image/") || f.name.match(/\.(heic|heif)$/i));
    if (!arr.length) { toast.error("Only image files allowed"); return; }
    setSelectedFiles(prev => [...prev, ...arr]);
    arr.forEach(f => {
      const reader = new FileReader();
      reader.onload = e => setPreviews(prev => [...prev, e.target?.result as string]);
      reader.readAsDataURL(f);
    });
  };

  const removeFile = (idx: number) => {
    setSelectedFiles(p => p.filter((_, i) => i !== idx));
    setPreviews(p => p.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!salonId || selectedFiles.length === 0) { toast.error("Select at least one photo"); return; }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";

      const fd = new FormData();
      selectedFiles.forEach(f => fd.append("files", f));

      const res = await fetch("/api/upload-gallery", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");

      // Save each uploaded photo to gallery_photos table
      const inserts = (json.uploaded as { url: string }[]).map(u =>
        supabase.from("gallery_photos").insert({
          salon_id: salonId,
          url: u.url,
          caption: form.caption,
          category: form.category,
          is_featured: form.is_featured,
        }).select().single()
      );
      const results = await Promise.all(inserts);
      const newPhotos = results.map(r => r.data).filter(Boolean) as Photo[];
      setPhotos(p => [...newPhotos, ...p]);

      toast.success(`✅ ${newPhotos.length} photo${newPhotos.length > 1 ? "s" : ""} uploaded!`);
      if (json.errors?.length) toast.error(`Some failed: ${json.errors.join(", ")}`);

      setShowModal(false);
      setSelectedFiles([]);
      setPreviews([]);
      setForm({ caption: "", category: "general", is_featured: false });
    } catch (e) {
      toast.error(`Upload failed: ${e}`);
    }
    setUploading(false);
  };

  const handleAdd = handleUpload; // alias kept for compatibility

  const toggleFeatured = async (id: string, current: boolean) => {
    await supabase.from("gallery_photos").update({ is_featured: !current }).eq("id", id);
    setPhotos(p => p.map(ph => ph.id === id ? { ...ph, is_featured: !current } : ph));
    toast.success(current ? "Unfeatured" : "Featured!");
  };

  const deletePhoto = async (id: string) => {
    const photo = photos.find(p => p.id === id);
    if (!photo) return;
    if (!confirm(`Delete "${photo.caption || "this photo"}"?`)) return;

    // Extract storage path from public URL and delete from bucket
    try {
      const url = new URL(photo.url);
      // URL format: .../storage/v1/object/public/salon-assets/salon-gallery/...
      const match = url.pathname.match(/\/salon-assets\/(.+)$/);
      if (match?.[1]) {
        await supabase.storage.from("salon-assets").remove([match[1]]);
      }
    } catch {
      // If storage delete fails, still remove from DB
    }

    await supabase.from("gallery_photos").delete().eq("id", id);
    setPhotos(p => p.filter(ph => ph.id !== id));
    toast.success("🗑️ Photo deleted!");
  };

  const filtered = filter === "all" ? photos : filter === "featured" ? photos.filter(p => p.is_featured) : photos.filter(p => p.category === filter);

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A" }}>Gallery</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Showcase your salon work</div>
        </div>
      </div>
      <button onClick={() => setShowModal(true)} style={{ padding: "9px 18px", background: "linear-gradient(135deg,#EC4899,#DB2777)", color: "#fff", border: "none", borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 14px rgba(236,72,153,0.3)" }}>+ Add Photo</button>
    </header>
  );

  if (loading) return <DashboardShell salonName={salonName} topbar={Topbar}><div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading…</div></DashboardShell>;

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1360, margin: "0 auto" }}>

        {/* Stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
          {[
            { label: "Total Photos", value: photos.length, color: "#EC4899" },
            { label: "Featured", value: photos.filter(p => p.is_featured).length, color: "#F59E0B" },
            { label: "Categories", value: new Set(photos.map(p => p.category)).size, color: "#7C3AED" },
            { label: "This Month", value: photos.filter(p => new Date(p.created_at).getMonth() === new Date().getMonth()).length, color: "#047857" },
          ].map(s => (
            <div key={s.label} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 16, padding: "18px 16px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: s.color }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: "#524D60", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: "#12101A" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
          {["all", "featured", ...getGalleryCategories(businessType)].map(cat => (
            <button key={cat} onClick={() => setFilter(cat)}
              style={{ padding: "6px 14px", borderRadius: 20, border: `1.5px solid ${filter === cat ? "#EC4899" : "#ECE9F1"}`, background: filter === cat ? "rgba(236,72,153,0.12)" : "#FFFFFF", color: filter === cat ? "#EC4899" : "#524D60", fontSize: 12.5, fontWeight: filter === cat ? 800 : 500, cursor: "pointer", transition: "all 0.12s", textTransform: "capitalize" }}>
              {cat} {cat === "all" ? `(${photos.length})` : cat === "featured" ? `(${photos.filter(p => p.is_featured).length})` : `(${photos.filter(p => p.category === cat).length})`}
            </button>
          ))}
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📸</div>
            <div style={{ fontWeight: 700 }}>No photos yet</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Add your salon portfolio photos</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {filtered.map(photo => (
              <div key={photo.id} style={{ position: "relative", borderRadius: 16, overflow: "hidden", boxShadow: "0 4px 16px rgba(0,0,0,0.08)", cursor: "pointer", transition: "transform 0.18s", height: 220 }}
                onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.02)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={photo.caption} onClick={() => setLightbox(photo)}
                  style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" }}
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                {photo.is_featured && (
                  <div style={{ position: "absolute", top: 10, left: 10, background: "#F59E0B", color: "#fff", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 99 }}>⭐ Featured</div>
                )}
                <div style={{ position: "absolute", top: 10, right: 10, display: "flex", gap: 6 }}>
                  <button onClick={e => { e.stopPropagation(); toggleFeatured(photo.id, photo.is_featured); }}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>⭐</button>
                  <button onClick={e => { e.stopPropagation(); deletePhoto(photo.id); }}
                    style={{ width: 28, height: 28, borderRadius: "50%", background: "rgba(255,255,255,0.9)", border: "none", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>🗑</button>
                </div>
                {photo.caption && (
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(0,0,0,0.7))", padding: "20px 12px 10px", color: "#fff", fontSize: 12, fontWeight: 600 }}>{photo.caption}</div>
                )}
              </div>
            ))}
          </div>

        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <Image src={lightbox.url} alt={lightbox.caption} width={900} height={700}
            style={{ maxWidth: "90vw", maxHeight: "85vh", borderRadius: 16, objectFit: "contain", width: "auto", height: "auto" }} />
          {lightbox.caption && <div style={{ position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)", color: "#fff", fontSize: 14, fontWeight: 600, textAlign: "center" }}>{lightbox.caption}</div>}
          <button onClick={() => setLightbox(null)} style={{ position: "absolute", top: 20, right: 20, background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "50%", width: 40, height: 40, color: "#fff", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
      )}

      {/* Add Photo Modal */}
      {showModal && (
        <div onClick={() => { setShowModal(false); setSelectedFiles([]); setPreviews([]); }} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, backdropFilter: "blur(6px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#FFFFFF", borderRadius: 20, padding: 28, width: "100%", maxWidth: 520, boxShadow: "0 32px 80px rgba(0,0,0,0.25)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#12101A", marginBottom: 20 }}>Upload Photos</div>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
              style={{ border: `2px dashed ${dragOver ? "#EC4899" : "#ECE9F1"}`, borderRadius: 14, padding: "28px 20px", textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(236,72,153,0.12)" : "#F5F3FF", transition: "all 0.18s", marginBottom: 16 }}
            >
              <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#12101A", marginBottom: 4 }}>Drag & drop photos here</div>
              <div style={{ fontSize: 12.5, color: "#524D60" }}>or click to browse • JPG, PNG, WebP, HEIC • max 10MB each</div>
              <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {/* Previews */}
            {previews.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
                {previews.map((src, i) => (
                  <div key={i} style={{ position: "relative", borderRadius: 10, overflow: "hidden", aspectRatio: "1" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button onClick={() => removeFile(i)}
                      style={{ position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%", background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                  </div>
                ))}
                <div onClick={() => fileInputRef.current?.click()}
                  style={{ borderRadius: 10, border: "2px dashed #ECE9F1", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", aspectRatio: "1", color: "#524D60", fontSize: 22 }}>+</div>
              </div>
            )}

            {/* Caption + Category */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Caption (optional)</label>
                <input value={form.caption} onChange={e => setForm(p => ({ ...p, caption: e.target.value }))} placeholder="e.g. Balayage transformation"
                  style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#524D60", display: "block", marginBottom: 6 }}>Category</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  style={{ width: "100%", padding: "10px 13px", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 14, outline: "none", fontFamily: "inherit" }}>
                  {getGalleryCategories(businessType).map((c: string) => <option key={c} value={c} style={{ textTransform: "capitalize" }}>{c}</option>)}
                </select>
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <input type="checkbox" checked={form.is_featured} onChange={e => setForm(p => ({ ...p, is_featured: e.target.checked }))} />
                <span style={{ fontSize: 13.5, fontWeight: 600, color: "#524D60" }}>⭐ Mark as featured</span>
              </label>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={() => { setShowModal(false); setSelectedFiles([]); setPreviews([]); }}
                style={{ flex: 1, padding: 12, background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleUpload} disabled={uploading || selectedFiles.length === 0}
                style={{ flex: 2, padding: 12, background: uploading ? "#ECE9F1" : "linear-gradient(135deg,#EC4899,#DB2777)", border: "none", borderRadius: 12, fontSize: 13.5, fontWeight: 700, color: uploading ? "#6B6577" : "#FFFFFF", cursor: uploading || selectedFiles.length === 0 ? "not-allowed" : "pointer", opacity: selectedFiles.length === 0 ? 0.5 : 1 }}>
                {uploading ? "⏳ Uploading…" : `Upload ${selectedFiles.length > 0 ? `${selectedFiles.length} Photo${selectedFiles.length > 1 ? "s" : ""}` : "Photos"}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardShell>
  );
}
