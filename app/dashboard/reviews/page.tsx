"use client";
import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getCurrentUserProfile } from "@/app/lib/auth";
import DashboardShell, { HamburgerBtn } from "../components/DashboardShell";
import { useToast } from "../components/Toast";
import FeatureGate from "../components/FeatureGate";

interface Review {
  id: string;
  salon_id: string;
  client_name: string;
  client_email?: string;
  rating: number;
  comment: string;
  reply?: string | null;
  is_published: boolean;
  created_at: string;
  appointment_id?: string | null;
}

function StarRating({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map(s => (
        <span key={s} style={{ fontSize: size, color: s <= rating ? "#F59E0B" : "#ECE9F1", lineHeight: 1 }}>★</span>
      ))}
    </div>
  );
}

function ReviewsContent() {
  const router = useRouter();
  const toast = useToast();
  const [salonName, setSalonName] = useState("");
  const [salonSlug, setSalonSlug] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [origin] = useState(() =>
    typeof window !== "undefined" ? window.location.origin : ""
  );

  useEffect(() => {
    const load = async () => {
      const profile = await getCurrentUserProfile();
      if (!profile?.salon) { router.push("/login"); return; }
      setSalonName(profile.salon.name);
      setSalonSlug(profile.salon.slug);
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("salon_id", profile.salon.id)
        .order("created_at", { ascending: false });
      if (!error) setReviews(data || []);
      setLoading(false);
    };
    load();
  }, [router]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  }, [reviews]);

  const ratingDist = useMemo(() => {
    const dist = [0, 0, 0, 0, 0];
    reviews.forEach(r => { if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++; });
    return dist.reverse(); // 5→1
  }, [reviews]);

  const handleReply = async (id: string) => {
    if (!replyText.trim()) return;
    const { error } = await supabase.from("reviews").update({ reply: replyText }).eq("id", id);
    if (error) { toast.error("Failed to save reply"); return; }
    setReviews(p => p.map(r => r.id === id ? { ...r, reply: replyText } : r));
    toast.success("Reply saved!");
    setReplyingTo(null);
    setReplyText("");
  };

  const handleToggle = async (id: string, current: boolean) => {
    const { error } = await supabase.from("reviews").update({ is_published: !current }).eq("id", id);
    if (error) return;
    setReviews(p => p.map(r => r.id === id ? { ...r, is_published: !current } : r));
    toast.success(current ? "Review hidden" : "Review published");
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this review?")) return;
    await supabase.from("reviews").delete().eq("id", id);
    setReviews(p => p.filter(r => r.id !== id));
    toast.success("Review deleted");
  };

  const copyReviewLink = () => {
    navigator.clipboard.writeText(`${origin}/book/${salonSlug}#reviews`);
    toast.success("Review link copied!");
  };

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 24px", height: 66, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 30, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <HamburgerBtn />
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#12101A", letterSpacing: "-0.4px" }}>Reviews</div>
          <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>Client feedback & reputation</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={copyReviewLink} style={{ padding: "9px 16px", background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 12, fontSize: 13, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Share Link</button>
      </div>
    </header>
  );

  if (loading) return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: 40, textAlign: "center", color: "#524D60" }}>Loading reviews…</div>
    </DashboardShell>
  );

  const published = reviews.filter(r => r.is_published);

  return (
    <DashboardShell salonName={salonName} topbar={Topbar}>
      <div style={{ padding: "28px 24px", maxWidth: 1200, margin: "0 auto" }}>

        {/* Summary */}
        <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 20, marginBottom: 28 }}>
          {/* Avg rating */}
          <div style={{ background: "linear-gradient(135deg,#FFF7ED,#FEF3C7)", border: "1.5px solid #FDE68A", borderRadius: 20, padding: "28px 24px", textAlign: "center" }}>
            <div style={{ fontSize: 56, fontWeight: 900, color: "#12101A", lineHeight: 1, letterSpacing: "-2px" }}>{avgRating.toFixed(1)}</div>
            <div style={{ marginTop: 10, marginBottom: 8 }}><StarRating rating={Math.round(avgRating)} size={22} /></div>
            <div style={{ fontSize: 13, color: "#F59E0B", fontWeight: 600 }}>{reviews.length} total · {published.length} published</div>
          </div>
          {/* Distribution */}
          <div style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, padding: "22px 24px" }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#12101A", marginBottom: 16 }}>Rating Breakdown</div>
            {ratingDist.map((count, i) => {
              const star = 5 - i;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 1, width: 80, flexShrink: 0 }}>
                    {[1,2,3,4,5].map(s => <span key={s} style={{ fontSize: 12, color: s <= star ? "#F59E0B" : "#ECE9F1" }}>★</span>)}
                  </div>
                  <div style={{ flex: 1, height: 8, background: "#ECE9F1", borderRadius: 99 }}>
                    <div style={{ height: "100%", borderRadius: 99, background: "#F59E0B", width: `${pct}%`, transition: "width 0.6s ease" }} />
                  </div>
                  <div style={{ width: 28, fontSize: 12.5, fontWeight: 700, color: "#524D60", textAlign: "right" }}>{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Reviews list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {reviews.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#524D60" }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>No reviews yet</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>Share your booking link to collect reviews</div>
            </div>
          )}
          {reviews.map(review => (
            <div key={review.id} style={{ background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)", opacity: review.is_published ? 1 : 0.6, transition: "all 0.18s" }}>
              <div style={{ padding: "18px 22px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ width: 42, height: 42, borderRadius: 13, background: `hsl(${review.client_name.charCodeAt(0) * 37 % 360},60%,55%)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0 }}>
                      {review.client_name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#12101A" }}>{review.client_name}</div>
                      <div style={{ fontSize: 11.5, color: "#524D60", marginTop: 1 }}>{new Date(review.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <StarRating rating={review.rating} size={15} />
                    {/* Published toggle */}
                    <label style={{ position: "relative", width: 32, height: 18, cursor: "pointer" }}>
                      <input type="checkbox" checked={review.is_published} onChange={() => handleToggle(review.id, review.is_published)} style={{ opacity: 0, width: 0, height: 0 }} />
                      <span style={{ position: "absolute", inset: 0, background: review.is_published ? "#10B981" : "#524D60", borderRadius: 99, transition: "background 0.18s" }}>
                        <span style={{ position: "absolute", width: 12, height: 12, left: review.is_published ? 17 : 3, top: 3, background: "#FFFFFF", borderRadius: "50%", transition: "left 0.18s" }} />
                      </span>
                    </label>
                    <button onClick={() => handleDelete(review.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 15, color: "#524D60", padding: 0, transition: "color 0.12s" }}
                      onMouseEnter={e => { e.currentTarget.style.color = "#EF4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.color = "#524D60"; }}>🗑</button>
                  </div>
                </div>
                <p style={{ fontSize: 14, color: "#524D60", lineHeight: 1.7, margin: 0 }}>{review.comment}</p>

                {/* Reply section */}
                {review.reply ? (
                  <div style={{ marginTop: 14, padding: "12px 16px", background: "#F5F3FF", borderRadius: 12, borderLeft: "3px solid #7C3AED" }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.5px" }}>Your reply</div>
                    <p style={{ fontSize: 13.5, color: "#524D60", margin: 0, lineHeight: 1.6 }}>{review.reply}</p>
                    <button onClick={() => { setReplyingTo(review.id); setReplyText(review.reply || ""); }} style={{ marginTop: 6, background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#7C3AED", fontWeight: 700, padding: 0 }}>Edit reply</button>
                  </div>
                ) : (
                  <button onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                    style={{ marginTop: 12, padding: "6px 14px", background: "rgba(124,58,237,0.10)", color: "#7C3AED", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", transition: "all 0.12s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(124,58,237,0.25)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(124,58,237,0.10)"; }}>
                    💬 Reply
                  </button>
                )}

                {/* Reply input */}
                {replyingTo === review.id && (
                  <div style={{ marginTop: 14 }}>
                    <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Write your reply..." rows={3}
                      style={{ width: "100%", padding: "10px 14px", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button onClick={() => handleReply(review.id)} style={{ padding: "8px 18px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Save Reply</button>
                      <button onClick={() => setReplyingTo(null)} style={{ padding: "8px 14px", background: "#F5F3FF", border: "1.5px solid #ECE9F1", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#524D60", cursor: "pointer" }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </DashboardShell>
  );
}
export default function ReviewsPage() {
  return (
    <FeatureGate feature="reviews">
      <ReviewsContent />
    </FeatureGate>
  );
}
