"use client";
import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

export default function BookPage() {
  const [salons, setSalons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const loadSalons = async () => {
      const { data, error } = await supabase
        .from("salons")
        .select("id, name, slug")
        .order("name");

      if (!error && data) {
        setSalons(data);
      }
      setLoading(false);
    };

    loadSalons();
  }, []);

  const filteredSalons = salons.filter(salon =>
    salon.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F2F4F7", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "24px", color: "#4F6EF7" }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F2F4F7" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "0.5px solid #E8EAF0", padding: "32px 20px", textAlign: "center" }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: "32px", color: "#0F172A", marginBottom: "8px" }}>Book a Salon</div>
        <div style={{ fontSize: "16px", color: "#64748B", maxWidth: "600px", margin: "0 auto" }}>
          Find and book appointments at your favorite salons
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: "32px 20px", maxWidth: "600px", margin: "0 auto" }}>
        <div style={{ background: "#fff", border: "0.5px solid #E8EAF0", borderRadius: "12px", padding: "20px" }}>
          <label style={{ fontSize: "14px", fontWeight: 500, color: "#0F172A", display: "block", marginBottom: "12px" }}>
            Search salons
          </label>
          <input
            type="text"
            placeholder="Enter salon name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              border: "0.5px solid #E8EAF0",
              borderRadius: "8px",
              fontSize: "16px",
              color: "#0F172A",
              outline: "none",
              boxSizing: "border-box"
            }}
          />
        </div>
      </div>

      {/* Salon List */}
      <div style={{ padding: "0 20px 32px", maxWidth: "600px", margin: "0 auto" }}>
        {filteredSalons.length === 0 ? (
          <div style={{ background: "#fff", borderRadius: "12px", padding: "48px", textAlign: "center", color: "#94A3B8" }}>
            {searchTerm ? "No salons found matching your search." : "No salons available yet."}
          </div>
        ) : (
          filteredSalons.map((salon) => (
            <a
              key={salon.id}
              href={`/book/${salon.slug}`}
              style={{
                display: "block",
                background: "#fff",
                border: "0.5px solid #E8EAF0",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "16px",
                textDecoration: "none",
                color: "#0F172A",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#4F6EF7";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(79, 112, 247, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#E8EAF0";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              <div style={{ fontSize: "18px", fontWeight: 600, color: "#0F172A", marginBottom: "4px" }}>
                {salon.name}
              </div>
              <div style={{ fontSize: "14px", color: "#64748B" }}>
                Click to view services and book →
              </div>
            </a>
          ))
        )}
      </div>

      <div style={{ textAlign: "center", padding: "32px", fontSize: "12px", color: "#CBD5E1" }}>
        Powered by <span style={{ fontFamily: "Georgia, serif", color: "#4F6EF7" }}>feature</span>
      </div>
    </div>
  );
}