"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { getCurrentUserProfile } from "../../../lib/auth";
import DashboardShell, { HamburgerBtn } from "../../components/DashboardShell";
import { useSalon } from "../../context/SalonContext";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

type Step = "upload" | "mapping" | "submitting" | "result";

interface MappingState {
  name: string;
  useSplitName: boolean;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  notes: string;
  dateOfBirth: string;
  lastVisit: string;
}

interface MappedRow {
  name: string; email: string; phone: string;
  notes: string; dateOfBirth: string; lastVisit: string;
}

interface SkippedRow { name: string; email: string; phone: string; reason: string }
interface ImportResult {
  imported: number; duplicates: number; skippedInvalid: number;
  totalRows: number; skippedRows: SkippedRow[];
}

const EMPTY_MAPPING: MappingState = {
  name: "", useSplitName: false, firstName: "", lastName: "",
  email: "", phone: "", notes: "", dateOfBirth: "", lastVisit: "",
};

// ─── CSV parsing (hand-rolled — handles quoted fields, escaped quotes, CRLF/LF) ───
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;
  while (i < len) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += char; i++; continue;
    }
    if (char === '"') { inQuotes = true; i++; continue; }
    if (char === ',') { row.push(field); field = ""; i++; continue; }
    if (char === '\r') { i++; continue; }
    if (char === '\n') { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
    field += char; i++;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(r => !(r.length === 1 && r[0].trim() === ""));
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const FIELD_VARIANTS: Record<string, string[]> = {
  name: ["name", "fullname", "clientname", "customername"],
  firstName: ["firstname", "fname", "first"],
  lastName: ["lastname", "lname", "surname", "last"],
  email: ["email", "emailaddress"],
  phone: ["phone", "mobile", "phonenumber", "telephone", "mobilenumber", "tel", "cell"],
  notes: ["notes", "note", "comments", "comment"],
  dateOfBirth: ["dateofbirth", "dob", "birthday", "birthdate"],
  lastVisit: ["lastvisit", "lastvisitdate", "lastappointment", "lastbooking"],
};

function autoDetectMapping(headers: string[]): MappingState {
  const normalized = headers.map(normalizeHeader);
  const find = (variants: string[]) => {
    for (const v of variants) {
      const idx = normalized.indexOf(v);
      if (idx !== -1) return headers[idx];
    }
    return "";
  };
  const name = find(FIELD_VARIANTS.name);
  const firstName = find(FIELD_VARIANTS.firstName);
  const lastName = find(FIELD_VARIANTS.lastName);
  return {
    name, useSplitName: !name && !!(firstName || lastName),
    firstName, lastName,
    email: find(FIELD_VARIANTS.email),
    phone: find(FIELD_VARIANTS.phone),
    notes: find(FIELD_VARIANTS.notes),
    dateOfBirth: find(FIELD_VARIANTS.dateOfBirth),
    lastVisit: find(FIELD_VARIANTS.lastVisit),
  };
}

function buildMappedRows(headers: string[], dataRows: string[][], mapping: MappingState): MappedRow[] {
  const idx = (h: string) => headers.indexOf(h);
  const nameIdx = idx(mapping.name), firstIdx = idx(mapping.firstName), lastIdx = idx(mapping.lastName);
  const emailIdx = idx(mapping.email), phoneIdx = idx(mapping.phone), notesIdx = idx(mapping.notes);
  const dobIdx = idx(mapping.dateOfBirth), lastVisitIdx = idx(mapping.lastVisit);
  const cell = (cells: string[], i: number) => (i >= 0 ? (cells[i] || "").trim() : "");

  return dataRows.map(cells => ({
    name: mapping.useSplitName
      ? [cell(cells, firstIdx), cell(cells, lastIdx)].filter(Boolean).join(" ")
      : cell(cells, nameIdx),
    email: cell(cells, emailIdx),
    phone: cell(cells, phoneIdx),
    notes: cell(cells, notesIdx),
    dateOfBirth: cell(cells, dobIdx),
    lastVisit: cell(cells, lastVisitIdx),
  }));
}

function downloadSkippedCSV(rows: SkippedRow[]) {
  const escape = (v: string) => `"${(v || "").replace(/"/g, '""')}"`;
  const body = [["Name", "Email", "Phone", "Reason"], ...rows.map(r => [r.name, r.email, r.phone, r.reason])]
    .map(cols => cols.map(escape).join(","))
    .join("\r\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "skipped-clients.csv"; a.click();
  URL.revokeObjectURL(url);
}

const cardStyle: React.CSSProperties = {
  background: "#FFFFFF", border: "1.5px solid #ECE9F1", borderRadius: 20, padding: 24,
};
const selectStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", background: "#F5F3FF", border: "1.5px solid #ECE9F1",
  borderRadius: 10, fontSize: 13, color: "#12101A", outline: "none", fontFamily: "var(--font)",
};

export default function ImportClientsPage() {
  const router = useRouter();
  const { vc } = useSalon();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<MappingState>(EMPTY_MAPPING);
  const [uploadError, setUploadError] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    (async () => {
      const profile = await getCurrentUserProfile();
      if (!profile) { router.push("/login"); return; }
      setLoadingProfile(false);
    })();
  }, [router]);

  const resetAll = () => {
    setStep("upload"); setFileName(""); setHeaders([]); setDataRows([]);
    setMapping(EMPTY_MAPPING); setUploadError(""); setConfirmChecked(false);
    setSubmitError(""); setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFile = useCallback(async (file: File) => {
    setUploadError("");
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setUploadError("Please upload a .csv file."); return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("File is too large. Maximum size is 5MB."); return;
    }
    const text = await file.text();
    const parsed = parseCSV(text);
    if (parsed.length === 0) { setUploadError("The file appears to be empty."); return; }

    const [headerRow, ...rows] = parsed;
    if (rows.length === 0) { setUploadError("No client rows found below the header."); return; }
    if (rows.length > MAX_ROWS) {
      setUploadError(`This file has ${rows.length} rows — maximum ${MAX_ROWS} per import. Please split it into smaller files.`);
      return;
    }

    setFileName(file.name);
    setHeaders(headerRow);
    setDataRows(rows);
    setMapping(autoDetectMapping(headerRow));
    setStep("mapping");
  }, []);

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  };

  const mappedRows = useMemo(() => buildMappedRows(headers, dataRows, mapping), [headers, dataRows, mapping]);
  const previewRows = mappedRows.slice(0, 5);
  const hasNameMapping = mapping.useSplitName ? !!(mapping.firstName || mapping.lastName) : !!mapping.name;

  const handleSubmit = async () => {
    setSubmitError("");
    setStep("submitting");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || "";
      const res = await fetch("/api/clients/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ filename: fileName, rows: mappedRows, confirmLawfulBasis: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(json.error || "Import failed. Please try again.");
        setStep("mapping");
        return;
      }
      setResult(json as ImportResult);
      setStep("result");
    } catch {
      setSubmitError("Network error — please check your connection and try again.");
      setStep("mapping");
    }
  };

  if (loadingProfile) return <DashboardShell salonName=""><div style={{ padding: 40, color: "#524D60" }}>Loading…</div></DashboardShell>;

  const Topbar = (
    <header style={{ background: "#FFFFFF", borderBottom: "1px solid #ECE9F1", padding: "0 20px", height: 58, display: "flex", alignItems: "center", gap: 14, position: "sticky", top: 0, zIndex: 30 }}>
      <HamburgerBtn />
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", letterSpacing: "-0.3px" }}>Import {vc.clientPlural}</div>
        <div style={{ fontSize: 11.5, color: "#6B6577" }}>Bring in your client list from Fresha, Phorest, Booksy or any CSV export</div>
      </div>
    </header>
  );

  return (
    <DashboardShell salonName={undefined} topbar={Topbar}>
      <div style={{ padding: "24px 20px", maxWidth: 760 }}>

        {/* ── Step: Upload ── */}
        {step === "upload" && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", marginBottom: 6 }}>Upload your client CSV</div>
            <p style={{ fontSize: 13, color: "#6B6577", marginBottom: 20, lineHeight: 1.6 }}>
              Export your client list as a CSV from Fresha, Phorest or Booksy, then upload it here. Max 5MB / {MAX_ROWS.toLocaleString()} rows.
            </p>

            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={onDrop}
              style={{
                border: "2px dashed #ECE9F1", borderRadius: 14, padding: "40px 20px",
                textAlign: "center", cursor: "pointer", background: "#F5F3FF", transition: "border-color 0.15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#7C3AED"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#ECE9F1"; }}
            >
              <div style={{ fontSize: 32, marginBottom: 10 }}>📄</div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#12101A", marginBottom: 4 }}>Click to browse or drag a .csv file here</div>
              <div style={{ fontSize: 12, color: "#6B6577" }}>Only .csv files are supported</div>
              <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onFileInputChange} />
            </div>

            {uploadError && (
              <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: 12.5, color: "#B91C1C" }}>
                ⚠️ {uploadError}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Mapping + GDPR + Submit ── */}
        {(step === "mapping" || step === "submitting") && (
          <>
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A" }}>Map your columns</div>
                <button onClick={resetAll} style={{ background: "none", border: "none", color: "#6B6577", fontSize: 12.5, cursor: "pointer" }}>← Choose a different file</button>
              </div>
              <p style={{ fontSize: 12.5, color: "#6B6577", marginBottom: 18 }}>
                <strong style={{ color: "#524D60" }}>{fileName}</strong> — {dataRows.length.toLocaleString()} rows detected
              </p>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 6 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, fontWeight: 600, color: "#524D60", marginBottom: 6 }}>
                    <input type="checkbox" checked={mapping.useSplitName} onChange={e => setMapping(m => ({ ...m, useSplitName: e.target.checked }))} />
                    My file has separate First name / Last name columns
                  </label>
                </div>

                {!mapping.useSplitName ? (
                  <div>
                    <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Name *</label>
                    <select style={selectStyle} value={mapping.name} onChange={e => setMapping(m => ({ ...m, name: e.target.value }))}>
                      <option value="">— Not mapped —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>First name *</label>
                      <select style={selectStyle} value={mapping.firstName} onChange={e => setMapping(m => ({ ...m, firstName: e.target.value }))}>
                        <option value="">— Not mapped —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Last name</label>
                      <select style={selectStyle} value={mapping.lastName} onChange={e => setMapping(m => ({ ...m, lastName: e.target.value }))}>
                        <option value="">— Not mapped —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  </>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Email</label>
                  <select style={selectStyle} value={mapping.email} onChange={e => setMapping(m => ({ ...m, email: e.target.value }))}>
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Phone</label>
                  <select style={selectStyle} value={mapping.phone} onChange={e => setMapping(m => ({ ...m, phone: e.target.value }))}>
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Notes <span style={{ color: "#6B6577" }}>(optional)</span></label>
                  <select style={selectStyle} value={mapping.notes} onChange={e => setMapping(m => ({ ...m, notes: e.target.value }))}>
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Date of birth <span style={{ color: "#6B6577" }}>(optional)</span></label>
                  <select style={selectStyle} value={mapping.dateOfBirth} onChange={e => setMapping(m => ({ ...m, dateOfBirth: e.target.value }))}>
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#6B6577", marginBottom: 5 }}>Last visit <span style={{ color: "#6B6577" }}>(optional)</span></label>
                  <select style={selectStyle} value={mapping.lastVisit} onChange={e => setMapping(m => ({ ...m, lastVisit: e.target.value }))}>
                    <option value="">— Not mapped —</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              </div>

              {!hasNameMapping && (
                <div style={{ marginTop: 12, fontSize: 12, color: "#F59E0B" }}>⚠️ Map a Name column (or First/Last name) to continue — every row needs a name.</div>
              )}
            </div>

            {/* Preview */}
            <div style={{ ...cardStyle, marginBottom: 16, overflowX: "auto" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: "#524D60", marginBottom: 12, textTransform: "uppercase", letterSpacing: "0.5px" }}>Preview — first {previewRows.length} rows</div>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr>
                    {["Name", "Email", "Phone", "Notes", "DOB", "Last Visit"].map(h => (
                      <th key={h} style={{ textAlign: "left", fontSize: 10.5, fontWeight: 800, color: "#6B6577", padding: "8px 10px", borderBottom: "1px solid #ECE9F1", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#12101A", borderBottom: "1px solid #ECE9F1" }}>{r.name || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{r.email || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{r.phone || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{r.notes || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{r.dateOfBirth || "—"}</td>
                      <td style={{ padding: "8px 10px", fontSize: 12.5, color: "#524D60", borderBottom: "1px solid #ECE9F1" }}>{r.lastVisit || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* GDPR + Submit */}
            <div style={cardStyle}>
              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 18 }}>
                <input type="checkbox" checked={confirmChecked} onChange={e => setConfirmChecked(e.target.checked)} style={{ marginTop: 2 }} />
                <span style={{ fontSize: 13, color: "#12101A", lineHeight: 1.6 }}>
                  I confirm I have a lawful basis to upload these client records and to contact them.
                </span>
              </label>

              {submitError && (
                <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 10, fontSize: 12.5, color: "#B91C1C" }}>
                  ⚠️ {submitError}
                </div>
              )}

              <button
                onClick={handleSubmit}
                disabled={!confirmChecked || !hasNameMapping || step === "submitting"}
                style={{
                  padding: "12px 24px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff",
                  border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: (!confirmChecked || !hasNameMapping || step === "submitting") ? "default" : "pointer",
                  opacity: (!confirmChecked || !hasNameMapping) ? 0.4 : step === "submitting" ? 0.7 : 1,
                }}
              >
                {step === "submitting" ? "Importing…" : `Import ${dataRows.length.toLocaleString()} ${vc.clientPlural}`}
              </button>
            </div>
          </>
        )}

        {/* ── Step: Result ── */}
        {step === "result" && result && (
          <div style={cardStyle}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#12101A", marginBottom: 18 }}>Import complete</div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
              <div style={{ background: "rgba(16,185,129,0.10)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#047857" }}>{result.imported}</div>
                <div style={{ fontSize: 11, color: "#6B6577", marginTop: 4, fontWeight: 600 }}>Imported</div>
              </div>
              <div style={{ background: "rgba(245,158,11,0.10)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#F59E0B" }}>{result.duplicates}</div>
                <div style={{ fontSize: 11, color: "#6B6577", marginTop: 4, fontWeight: 600 }}>Already Existed</div>
              </div>
              <div style={{ background: "rgba(239,68,68,0.10)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 12, padding: "16px 14px", textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#EF4444" }}>{result.skippedInvalid}</div>
                <div style={{ fontSize: 11, color: "#6B6577", marginTop: 4, fontWeight: 600 }}>Skipped (Invalid)</div>
              </div>
            </div>

            <p style={{ fontSize: 12.5, color: "#6B6577", marginBottom: 20 }}>
              {result.totalRows.toLocaleString()} rows processed from {fileName}.
            </p>

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => router.push("/dashboard/clients")} style={{ padding: "11px 20px", background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                View {vc.clientPlural} →
              </button>
              {result.skippedRows.length > 0 && (
                <button onClick={() => downloadSkippedCSV(result.skippedRows)} style={{ padding: "11px 20px", background: "#F5F3FF", color: "#524D60", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}>
                  ⬇ Download Skipped Rows CSV
                </button>
              )}
              <button onClick={resetAll} style={{ padding: "11px 20px", background: "none", color: "#6B6577", border: "1px solid #ECE9F1", borderRadius: 10, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
                Import Another File
              </button>
            </div>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
