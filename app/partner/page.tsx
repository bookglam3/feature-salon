"use client";
import { useState, useRef, useCallback } from "react";
import { supabase as sb } from "../lib/supabase";
const IND = "#C9A24B";

const CFG = {
  GB: {
    flag:"🇬🇧", name:"United Kingdom",
    phone:"+44 7700 000000", phoneCode:"+44",
    postal:"Postcode", postalPh:"SW1A 1AA", postalFormat:/^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    idType:"Passport / National ID / Driving Licence",
    idLabel:"Passport or National ID Number",
    idPh:"AB1234567", idFormat:"e.g. AB1234567",
    currency:"British Pound (£)",
    expRequired: true,
    noPostal: false,
  },
  PK: {
    flag:"🇵🇰", name:"Pakistan",
    phone:"+92 300 0000000", phoneCode:"+92",
    postal:"Postal Code", postalPh:"54000", postalFormat:/.+/,
    idType:"CNIC (Computerized National Identity Card)",
    idLabel:"CNIC Number",
    idPh:"42101-1234567-1", idFormat:"Format: XXXXX-XXXXXXX-X",
    currency:"Pakistani Rupee (₨)",
    expRequired: true,
    noPostal: false,
  },
  AE: {
    flag:"🇦🇪", name:"United Arab Emirates",
    phone:"+971 50 000 0000", phoneCode:"+971",
    postal:"Emirate", postalPh:"e.g. Dubai", postalFormat:/.+/,
    idType:"Emirates ID",
    idLabel:"Emirates ID Number",
    idPh:"784-XXXX-XXXXXXX-X", idFormat:"Format: 784-XXXX-XXXXXXX-X",
    currency:"UAE Dirham (AED)",
    expRequired: true,
    noPostal: false,
  },
  SA: {
    flag:"🇸🇦", name:"Saudi Arabia",
    phone:"+966 5 0000 0000", phoneCode:"+966",
    postal:"Postal Code", postalPh:"12271", postalFormat:/.+/,
    idType:"National ID / Iqama",
    idLabel:"National ID / Iqama Number",
    idPh:"1234567890", idFormat:"10 digit number",
    currency:"Saudi Riyal (SAR)",
    expRequired: true,
    noPostal: false,
  },
} as const;

type CountryCode = keyof typeof CFG;

interface FS {
  full_name:string; phone:string; whatsapp:string; email:string; country:CountryCode;
  street_address:string; city:string; postcode:string;
  experience:string; own_vehicle:boolean; daily_availability:string; why_hire:string;
  id_card_number:string; id_issue_date:string; id_expiry_date:string;
  id_card_photo_url:string; selfie_photo_url:string;
}

const EMPTY:FS = { full_name:"",phone:"",whatsapp:"",email:"",country:"GB", street_address:"",city:"",postcode:"", experience:"",own_vehicle:false,daily_availability:"",why_hire:"", id_card_number:"",id_issue_date:"",id_expiry_date:"",id_card_photo_url:"",selfie_photo_url:"" };

const si = (extra?:React.CSSProperties):React.CSSProperties => ({ width:"100%",padding:"11px 14px",border:"1.5px solid #E5E7EB",borderRadius:10,fontSize:14,color:"#111827",outline:"none",boxSizing:"border-box",fontFamily:"inherit",background:"#fff",...extra });
const bf = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => { e.currentTarget.style.borderColor=IND; e.currentTarget.style.boxShadow="0 0 0 3px rgba(79,110,247,0.12)"; };
const bb = (e:React.FocusEvent<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>) => { e.currentTarget.style.borderColor="#E5E7EB"; e.currentTarget.style.boxShadow="none"; };

function F({label,children,hint}:{label:string;children:React.ReactNode;hint?:string}) {
  return <div style={{marginBottom:16}}><label style={{display:"block",fontSize:12.5,fontWeight:600,color:"#374151",marginBottom:5}}>{label}</label>{children}{hint&&<p style={{fontSize:11.5,color:"#6B7280",marginTop:4}}>{hint}</p>}</div>;
}
function I(p:React.InputHTMLAttributes<HTMLInputElement>) { return <input {...p} style={si(p.style as React.CSSProperties)} onFocus={bf} onBlur={bb} />; }
function S(p:React.SelectHTMLAttributes<HTMLSelectElement>) { return <select {...p} style={{...si(),appearance:"none",backgroundImage:`url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239CA3AF' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,backgroundRepeat:"no-repeat",backgroundPosition:"right 14px center",paddingRight:38,...(p.style as React.CSSProperties)}} onFocus={bf} onBlur={bb}/>; }
function T(p:React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...p} style={{...si(),resize:"vertical",minHeight:100,lineHeight:1.6,...(p.style as React.CSSProperties)}} onFocus={bf} onBlur={bb}/>; }

function PhotoUpload({label,hint,icon,value,onChange}:{label:string;hint:string;icon:string;value:string;onChange:(u:string)=>void}) {
  const ref = useRef<HTMLInputElement>(null);
  const [up, setUp] = useState(false);
  const [err, setErr] = useState("");
  const upload = async (file:File) => {
    if(file.size>5*1024*1024){setErr("Max 5MB");return;}
    setUp(true);setErr("");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${file.name.split(".").pop()}`;
    const {error} = await sb.storage.from("partner-documents").upload(path,file,{upsert:true});
    if(error){setErr("Upload failed: "+error.message);setUp(false);return;}
    const {data} = sb.storage.from("partner-documents").getPublicUrl(path);
    onChange(data.publicUrl);setUp(false);
  };
  return (
    <div style={{marginBottom:18}}>
      <F label={label} hint={hint}>
        <div onClick={()=>ref.current?.click()} style={{border:`2px dashed ${value?"#6EE7B7":"#C7D2FE"}`,borderRadius:12,padding:"20px 16px",textAlign:"center",cursor:"pointer",background:value?"#ECFDF5":"#F8FAFF"}}>
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <div><img src={value} alt="doc" style={{maxHeight:110,maxWidth:"100%",borderRadius:8,marginBottom:6}}/><div style={{fontSize:12.5,color:"#065F46",fontWeight:600}}>✓ Uploaded</div></div>
          ) : <div><div style={{fontSize:32,marginBottom:6}}>{icon}</div><div style={{fontSize:13.5,fontWeight:600,color:"#374151"}}>{up?"Uploading…":"Click to upload"}</div></div>}
          <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f)upload(f);}}/>
        </div>
      </F>
      {err&&<p style={{fontSize:12,color:"#DC2626",marginTop:-10,marginBottom:8}}>{err}</p>}
    </div>
  );
}

const STEPS = ["Personal Info","Address","Work Details","ID Verification"];

export default function PartnerPage() {
  const [step,setStep] = useState(0);
  const [form,setForm] = useState<FS>(EMPTY);
  const [saving,setSaving] = useState(false);
  const [done,setDone] = useState(false);
  const [err,setErr] = useState("");
  const set = useCallback((k:keyof FS,v:string|boolean)=>setForm(p=>({...p,[k]:v})),[]);
  const c = CFG[form.country];

  const validate = () => {
    if(step===0){if(!form.full_name.trim())return"Full name required";if(!form.phone.trim())return"Phone required";if(!form.email.trim()||!form.email.includes("@"))return"Valid email required";}
    if(step===1){if(!form.street_address.trim())return"Street address required";if(!form.city.trim())return"City required";if(!form.postcode.trim())return`${c.postal} required`;}
    if(step===2){if(!form.experience)return"Experience required";if(!form.daily_availability)return"Availability required";if(form.why_hire.trim().length<20)return"Please write at least 20 characters";}
    if(step===3){if(!form.id_card_number.trim())return"ID number required";if(!form.id_issue_date)return"Issue date required";if(!form.id_expiry_date)return"Expiry date required";if(!form.id_card_photo_url)return"ID photo required";if(!form.selfie_photo_url)return"Your photo required";}
    return "";
  };

  const next = () => { const e=validate(); if(e){setErr(e);return;} setErr(""); setStep(s=>s+1); };

  const submit = async () => {
    const e=validate(); if(e){setErr(e);return;} setErr(""); setSaving(true);
    try {
      const res = await fetch("/api/partners",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      const json = await res.json();
      if(!res.ok){setErr(json.error||"Submission failed");return;}
      setDone(true);
    } catch{setErr("Network error. Please retry.");}
    finally{setSaving(false);}
  };

  if(done) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#F0F4FF,#F8FAFF)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <div style={{background:"#fff",borderRadius:20,padding:"48px 32px",textAlign:"center",maxWidth:440,width:"100%",boxShadow:"0 20px 60px rgba(79,110,247,0.12)"}}>
        <div style={{fontSize:56,marginBottom:16}}>✅</div>
        <h2 style={{fontSize:24,fontWeight:800,color:"#111827",letterSpacing:"-0.6px",marginBottom:10}}>Application Submitted!</h2>
        <p style={{fontSize:14,color:"#6B7280",lineHeight:1.7,marginBottom:24}}>Your identity has been verified and application is under review. We&apos;ll contact you within <strong>2–3 business days</strong> via {form.whatsapp||form.phone}.</p>
        <div style={{background:"#F0F4FF",borderRadius:12,padding:"14px 16px",textAlign:"left",marginBottom:24}}>
          {["📱 Our team will call/WhatsApp you","🔒 Documents stored securely","🎉 Get your referral link on approval"].map(s=><div key={s} style={{fontSize:13,color:"#374151",marginBottom:4}}>{s}</div>)}
        </div>
        <a href="/" style={{display:"inline-block",padding:"12px 28px",background:IND,color:"#fff",borderRadius:10,fontWeight:700,textDecoration:"none",fontSize:14}}>Back to Home</a>
      </div>
    </div>
  );

  return (
    <>
      <style>{`*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif}select option{font-size:14px}`}</style>

      {/* Hero */}
      <div style={{background:"linear-gradient(135deg,#1E3A8A,#C9A24B)",padding:"36px 24px 52px",textAlign:"center"}}>
        <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.15)",borderRadius:99,padding:"5px 16px",marginBottom:16}}>
          <span style={{fontSize:14}}>🤝</span><span style={{fontSize:11.5,fontWeight:700,color:"#fff",letterSpacing:"0.5px",textTransform:"uppercase"}}>Partner Application</span>
        </div>
        <h1 style={{fontSize:"clamp(22px,4vw,34px)",fontWeight:900,color:"#fff",letterSpacing:"-1px",marginBottom:8,lineHeight:1.2}}>Become a Feature Partner</h1>
        <p style={{fontSize:14,color:"rgba(255,255,255,0.75)",maxWidth:400,margin:"0 auto 28px"}}>Complete all 4 steps including identity verification to apply.</p>

        {/* Stepper */}
        <div style={{display:"flex",justifyContent:"center",maxWidth:480,margin:"0 auto",position:"relative"}}>
          <div style={{position:"absolute",top:14,left:"12%",right:"12%",height:2,background:"rgba(255,255,255,0.2)",zIndex:0}}/>
          {STEPS.map((s,i)=>(
            <div key={s} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:6,zIndex:1}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:i<step?"#6EE7B7":i===step?"#fff":"rgba(255,255,255,0.2)",border:i===step?`3px solid ${IND}`:"none",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i===step?IND:i<step?"#065F46":"rgba(255,255,255,0.6)",transition:"all 0.2s"}}>
                {i<step?"✓":i+1}
              </div>
              <div style={{fontSize:10,fontWeight:600,color:i===step?"#fff":"rgba(255,255,255,0.5)",textAlign:"center"}}>{s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Card */}
      <div style={{background:"linear-gradient(180deg,#F0F4FF,#F8FAFF)",padding:"0 16px 60px",marginTop:-28}}>
        <div style={{maxWidth:560,margin:"0 auto",background:"#fff",borderRadius:20,boxShadow:"0 20px 60px rgba(79,110,247,0.1)",padding:"32px 28px",border:"1px solid #E8EDFF"}}>

          {/* ── Step 1: Personal Info */}
          {step===0&&<>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:11,fontWeight:700,color:IND,textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>Step 1 of 4</div>
              <h2 style={{fontSize:19,fontWeight:800,color:"#111827",marginBottom:4}}>Personal Information</h2>
              <p style={{fontSize:13,color:"#6B7280"}}>Enter your details exactly as they appear on your ID document.</p>
            </div>

            <F label="Country *">
              <S value={form.country} onChange={e=>set("country",e.target.value as CountryCode)}>
                {(Object.keys(CFG) as CountryCode[]).map(k=><option key={k} value={k}>{CFG[k].flag} {CFG[k].name}</option>)}
              </S>
            </F>

            {/* Country info bar */}
            <div style={{padding:"10px 14px",background:"#F0F4FF",borderRadius:10,marginBottom:16,display:"flex",gap:12,flexWrap:"wrap",fontSize:12.5}}>
              <span style={{color:"#3730A3"}}>💰 {c.currency}</span>
              <span style={{color:"#3730A3"}}>🪪 {c.idType}</span>
            </div>

            <F label="Full Legal Name *"><I placeholder="Exactly as on your ID" value={form.full_name} onChange={e=>set("full_name",e.target.value)}/></F>

            <F label="Email Address *" hint="You will receive approval/rejection notification here">
              <I type="email" placeholder="your@email.com" value={form.email} onChange={e=>set("email",e.target.value)}/>
            </F>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <F label="Phone Number *">
                <I placeholder={c.phone} value={form.phone} onChange={e=>set("phone",e.target.value)}/>
                <p style={{fontSize:11,color:"#6B7280",marginTop:3}}>Country code: {c.phoneCode}</p>
              </F>
              <F label="WhatsApp (optional)"><I placeholder={c.phone} value={form.whatsapp} onChange={e=>set("whatsapp",e.target.value)}/></F>
            </div>
          </>}

          {/* ── Step 2: Address */}
          {step===1&&<>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:11,fontWeight:700,color:IND,textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>Step 2 of 4</div>
              <h2 style={{fontSize:19,fontWeight:800,color:"#111827",marginBottom:4}}>Home Address</h2>
              <p style={{fontSize:13,color:"#6B7280"}}>Your current residential address in {c.name}.</p>
            </div>
            <F label="Street Address / House No. *"><I placeholder={form.country==="PK"?"House #, Street #, Area":"House number and street name"} value={form.street_address} onChange={e=>set("street_address",e.target.value)}/></F>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <F label={form.country==="AE"?"Emirate / City *":form.country==="SA"?"City / Province *":"City / Town *"}><I placeholder={form.country==="PK"?"e.g. Lahore":form.country==="AE"?"e.g. Dubai":form.country==="SA"?"e.g. Riyadh":"e.g. London"} value={form.city} onChange={e=>set("city",e.target.value)}/></F>
              <F label={`${c.postal} *`}><I placeholder={c.postalPh} value={form.postcode} onChange={e=>set("postcode",e.target.value.toUpperCase())}/></F>
            </div>
            <div style={{padding:"11px 14px",background:"#F0F4FF",borderRadius:10,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:18}}>🔒</span>
              <p style={{fontSize:12.5,color:"#3730A3",margin:0,lineHeight:1.5}}>Your address is encrypted and used only for identity verification — never shared publicly.</p>
            </div>
          </>}

          {/* ── Step 3: Work Details */}
          {step===2&&<>
            <div style={{marginBottom:22}}>
              <div style={{fontSize:11,fontWeight:700,color:IND,textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>Step 3 of 4</div>
              <h2 style={{fontSize:19,fontWeight:800,color:"#111827",marginBottom:4}}>Work Details</h2>
              <p style={{fontSize:13,color:"#6B7280"}}>Tell us about your experience and working availability.</p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              <F label="Sales Experience *">
                <S value={form.experience} onChange={e=>set("experience",e.target.value)}>
                  <option value="">Select…</option>
                  <option value="fresher">Fresher (no experience)</option>
                  <option value="less-than-1">Less than 1 year</option>
                  <option value="1-2">1–2 years</option>
                  <option value="2-5">2–5 years</option>
                  <option value="5+">5+ years</option>
                </S>
              </F>
              <F label="Daily Availability *">
                <S value={form.daily_availability} onChange={e=>set("daily_availability",e.target.value)}>
                  <option value="">Select…</option>
                  <option value="full-time">Full-time (8h+)</option>
                  <option value="part-time">Part-time (4h)</option>
                  <option value="mornings">Mornings only</option>
                  <option value="evenings">Evenings only</option>
                  <option value="weekends">Weekends only</option>
                </S>
              </F>
            </div>
            <div style={{padding:"13px 16px",background:"#F9FAFB",borderRadius:12,border:"1.5px solid #E5E7EB",display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
              <label style={{position:"relative",width:36,height:20,cursor:"pointer",flexShrink:0}}>
                <input type="checkbox" checked={form.own_vehicle} onChange={e=>set("own_vehicle",e.target.checked)} style={{opacity:0,width:0,height:0}}/>
                <span style={{position:"absolute",inset:0,background:form.own_vehicle?IND:"#D1D5DB",borderRadius:99,transition:"background 0.18s"}}>
                  <span style={{position:"absolute",width:14,height:14,left:form.own_vehicle?19:3,top:3,background:"#fff",borderRadius:"50%",transition:"left 0.18s"}}/>
                </span>
              </label>
              <div><div style={{fontSize:13.5,fontWeight:600,color:"#111827"}}>I have my own vehicle</div><div style={{fontSize:12,color:"#6B7280"}}>Motorbike or car for field visits</div></div>
            </div>
            <F label="Why should we hire you? *" hint="Minimum 20 characters — share your skills and motivation">
              <T placeholder="Describe your motivation, relevant skills, and why you'd make a great Feature partner…" value={form.why_hire} onChange={e=>set("why_hire",e.target.value)} rows={5}/>
            </F>
          </>}

          {/* ── Step 4: ID Verification */}
          {step===3&&<>
            <div style={{marginBottom:18}}>
              <div style={{fontSize:11,fontWeight:700,color:IND,textTransform:"uppercase",letterSpacing:"1px",marginBottom:3}}>Step 4 of 4</div>
              <h2 style={{fontSize:19,fontWeight:800,color:"#111827",marginBottom:4}}>Identity Verification</h2>
              <p style={{fontSize:13,color:"#6B7280"}}>Required for {c.name} partner onboarding. All documents are encrypted.</p>
            </div>

            {/* ID type info for this country */}
            <div style={{padding:"11px 14px",background:"#EEF2FF",borderRadius:10,border:"1px solid #C7D2FE",marginBottom:18,display:"flex",gap:10,alignItems:"center"}}>
              <span style={{fontSize:22}}>🪪</span>
              <div><div style={{fontSize:12.5,fontWeight:700,color:"#3730A3"}}>Required ID for {c.name}</div><div style={{fontSize:12.5,color:"#374151"}}>{c.idType}</div></div>
            </div>

            <div style={{display:"flex",gap:8,marginBottom:18,flexWrap:"wrap"}}>
              {["🔒 256-bit Encrypted","🛡️ GDPR Compliant","🔏 Never Shared"].map(b=><span key={b} style={{fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:99,background:"#ECFDF5",color:"#065F46",border:"1px solid #6EE7B7"}}>{b}</span>)}
            </div>

            <F label={`${c.idLabel} *`} hint={c.idFormat}><I placeholder={c.idPh} value={form.id_card_number} onChange={e=>set("id_card_number",e.target.value.toUpperCase())} style={{letterSpacing:"1px",fontWeight:600}}/></F>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:4}}>
              <F label="ID Issue Date *"><I type="date" value={form.id_issue_date} onChange={e=>set("id_issue_date",e.target.value)} max={new Date().toISOString().split("T")[0]}/></F>
              <F label="ID Expiry Date *"><I type="date" value={form.id_expiry_date} onChange={e=>set("id_expiry_date",e.target.value)} min={new Date().toISOString().split("T")[0]}/></F>
            </div>

            <PhotoUpload label={`${c.idType} Photo *`} hint="JPG or PNG · Max 5MB · Clearly visible, all 4 corners" icon="🪪" value={form.id_card_photo_url} onChange={v=>set("id_card_photo_url",v)}/>
            <PhotoUpload label="Your Photo (Selfie) *" hint="Clear face · No sunglasses · Good lighting" icon="🤳" value={form.selfie_photo_url} onChange={v=>set("selfie_photo_url",v)}/>

            <div style={{padding:"11px 14px",background:"#FFFBEB",borderRadius:10,border:"1px solid #FDE68A",fontSize:12.5,color:"#92400E",lineHeight:1.6}}>
              ⚠️ By submitting, you confirm all information and documents are genuine. False applications will be reported to authorities in {c.name}.
            </div>
          </>}

          {/* Error */}
          {err&&<div style={{marginTop:14,padding:"11px 14px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:10,fontSize:13.5,color:"#991B1B"}}>❌ {err}</div>}

          {/* Buttons */}
          <div style={{display:"flex",gap:10,marginTop:22}}>
            {step>0&&<button onClick={()=>{setErr("");setStep(s=>s-1);}} style={{flex:1,padding:"13px",background:"#fff",border:"1.5px solid #E5E7EB",borderRadius:12,fontSize:14,fontWeight:600,cursor:"pointer",color:"#374151"}}>← Back</button>}
            {step<3
              ?<button onClick={next} style={{flex:2,padding:"13px",background:`linear-gradient(135deg,${IND},#3B55E0)`,color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:"pointer",boxShadow:"0 8px 24px rgba(79,110,247,0.28)"}}>Continue →</button>
              :<button onClick={submit} disabled={saving} style={{flex:2,padding:"13px",background:saving?"#aab1c4":`linear-gradient(135deg,${IND},#3B55E0)`,color:"#fff",border:"none",borderRadius:12,fontSize:14,fontWeight:700,cursor:saving?"not-allowed":"pointer",boxShadow:saving?"none":"0 8px 24px rgba(79,110,247,0.28)"}}>{saving?"Submitting…":"Submit Application ✓"}</button>
            }
          </div>
          <p style={{textAlign:"center",fontSize:11.5,color:"#6B7280",marginTop:12}}>🔒 Your data is encrypted and protected under {form.country==="GB"?"UK GDPR":form.country==="AE"?"UAE Data Protection Law":form.country==="SA"?"Saudi PDPL":"Pakistan Data Protection"} regulations.</p>
        </div>
      </div>
    </>
  );
}
