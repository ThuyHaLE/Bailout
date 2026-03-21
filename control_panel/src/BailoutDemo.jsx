// control_panel/src/BailoutDemo.jsx

import { useState, useRef, useEffect } from "react";
import { api, USE_MOCK }  from "./api/client.js";

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  PALETTE  (warm white + earthy tones, with green highlights for urgency)
// ║  --tx-primary   #F2EDD8   titles, item IDs
// ║  --tx-body      #C8C0A8   body text, reasons
// ║  --tx-secondary #9A9284   labels, urgency_reason
// ║  --tx-muted     #6A6458   sub-labels, next picks
// ║  --tx-ghost     #3E3A34   decorative, request flow
// ╚══════════════════════════════════════════════════════════════════════════════

const urgencyColor = u => ({ high: "#22C98A", medium: "#E09A2A", low: "#E05A3A" }[u] ?? "#9A9284");
const urgencyBg    = u => ({ high: "#0D4A32", medium: "#3A2608", low: "#3A1208" }[u] ?? "#1A1A18");

const LOADING_STEPS = [
  "Parsing uploaded data...",
  "Matching molds to machines...",
  "Computing capacity matrix...",
  "LLM reasoning...",
  "Validating output...",
];

export default function BailoutDemo() {
  const [machines, setMachines]               = useState([]);
  const [machinesLoading, setMachinesLoading] = useState(true);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [orderFile, setOrderFile]             = useState(null);
  const [useDbOrders, setUseDbOrders]         = useState(false);
  const [dbOrders, setDbOrders]               = useState([]);
  const [dbOrdersLoading, setDbOrdersLoading] = useState(false);
  const [activeTab, setActiveTab]             = useState("input");
  const [loading, setLoading]                 = useState(false);
  const [stepIdx, setStepIdx]                 = useState(0);
  const [result, setResult]                   = useState(null);
  const [error, setError]                     = useState(null);
  const [resultReady, setResultReady]         = useState(false);
  const fileRef = useRef();

  useEffect(() => {
    api.machines()
      .then(setMachines)
      .catch(err => setError(`Failed to load machines: ${err.message}`))
      .finally(() => setMachinesLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) { setStepIdx(0); return; }
    const id = setInterval(() => setStepIdx(i => (i + 1) % LOADING_STEPS.length), 440);
    return () => clearInterval(id);
  }, [loading]);

  const toggleMachine = m =>
    setSelectedMachines(prev =>
      prev.find(s => s.machine_id === m.machine_id)
        ? prev.filter(s => s.machine_id !== m.machine_id)
        : [...prev, m]
    );

  const handleFile = e => {
    const f = e.target.files[0];
    if (f) { setOrderFile(f); setUseDbOrders(false); }
  };

  const handleSelectDb = async () => {
    setUseDbOrders(true);
    setOrderFile(null);
    if (dbOrders.length > 0) return;
    setDbOrdersLoading(true);
    try {
      const data = await api.pendingOrders();
      setDbOrders(data);
    } catch (err) {
      setError(`Failed to load orders: ${err.message}`);
    } finally {
      setDbOrdersLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true); setResult(null); setError(null);
    setResultReady(false); 
    try {
      const data = await api.recommend(selectedMachines.map(m => m.machine_id), orderFile, useDbOrders);
      setResult(data);
      setResultReady(true);  
      setActiveTab("output");
    } catch (err) {
      setError(err.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = selectedMachines.length > 0 && (orderFile || useDbOrders);

  return (
    <div style={{ fontFamily:"'DM Mono','Fira Mono',monospace", background:"#0F0F0E", minHeight:"100vh", color:"#C8C0A8" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

        .mach{background:none;border:1px solid #2A2820;color:#6A6458;cursor:pointer;font-family:inherit;
          padding:9px 7px 7px;border-radius:6px;transition:border-color .12s,background .12s,color .12s;
          width:100%;text-align:center;position:relative;}
        .mach:hover{border-color:#4A4640;color:#9A9284;}
        .mach.sel{border-color:#22C98A;background:#0D4A32;color:#D8F8EE;}

        .bail-btn{background:none;border:1px solid #2E2A24;color:#9A9284;cursor:pointer;
          font-family:inherit;font-size:11px;padding:5px 11px;border-radius:4px;transition:all .12s;}
        .bail-btn:hover{border-color:#5A5448;color:#C8C0A8;}
        .bail-btn.on{background:#22C98A;border-color:#22C98A;color:#0A1A10;}

        .tab{background:none;border:none;border-bottom:2px solid transparent;color:#6A6458;
          cursor:pointer;font-family:inherit;font-size:10px;padding:10px 14px;
          letter-spacing:.05em;transition:all .12s;}
        .tab:hover{color:#9A9284;}
        .tab.on{border-bottom-color:#22C98A;color:#22C98A;}

        .drop{border:1px dashed #2A2820;border-radius:6px;padding:16px;text-align:center;
          cursor:pointer;transition:border-color .15s,background .15s;}
        .drop:hover{border-color:#22C98A;background:#0a180f;}

        .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 7px 2px 5px;
          background:#0F2D1F;border:1px solid #1A4A35;border-radius:4px;cursor:pointer;
          font-size:10px;transition:background .1s;}
        .chip:hover{background:#183D2A;}

        .sub{width:100%;border:none;border-radius:6px;font-family:inherit;font-size:11px;
          font-weight:500;padding:10px 14px;cursor:pointer;transition:all .18s;letter-spacing:.03em;}
        .sub:disabled{background:#181614!important;color:#3E3A34!important;cursor:not-allowed;}
        .sub.go{background:#22C98A;color:#0A1A10;}
        .sub.go:hover{background:#28e09a;}
        .sub.hint{background:#181614;color:#4A4640;}

        .tag{display:inline-block;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;}
        .cr{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid #1C1A16;}

        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fu{animation:fadeUp .22s ease forwards}
        .pulse{animation:pulse 1.1s ease-in-out infinite}
        .spin{animation:spin .75s linear infinite;display:inline-block}

        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#2A2820;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ background:"#111008", borderBottom:"1px solid #1E1C16", padding:"13px 26px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#22C98A" }}/>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, letterSpacing:"-.02em", color:"#F2EDD8" }}>Bailout</span>
          <span style={{ color:"#4A4640", fontSize:10 }}>/ scheduling assistant</span>
        </div>
        <span style={{ fontSize:9, color:USE_MOCK ? "#E09A2A" : "#22C98A", padding:"3px 8px", border:`1px solid ${USE_MOCK ? "#3A2A10" : "#1A4A35"}`, borderRadius:3 }}>
          {USE_MOCK ? "mock mode" : "live"}
        </span>
      </div>

      {/* Body grid */}
      <div style={{ display:"grid", gridTemplateColumns:"296px 1fr", height:"calc(100vh - 43px)" }}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{ background:"#111008", borderRight:"1px solid #1E1C16", padding:"18px", overflowY:"auto", display:"flex", flexDirection:"column", gap:18 }}>

          {/* 1 — Machines */}
          <div>
            <div style={{ fontSize:9, color:"#9A9284", letterSpacing:".1em", textTransform:"uppercase", marginBottom:2 }}>1 — Select machines</div>
            <div style={{ fontSize:9, color:"#4A4640", marginBottom:9 }}>Click to select / deselect · no status restriction</div>

            {machinesLoading ? (
              <div style={{ color:"#6A6458", fontSize:10, padding:"10px 0" }}>
                <span className="spin" style={{ marginRight:6, opacity:.5 }}>◌</span>Loading machines...
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                {machines.map(m => {
                  const sel = !!selectedMachines.find(s => s.machine_id === m.machine_id);
                  return (
                    <button key={m.machine_id} className={`mach${sel ? " sel" : ""}`} onClick={() => toggleMachine(m)}>
                      <div style={{ position:"absolute", top:6, left:7, width:5, height:5, borderRadius:"50%", background:sel ? "#22C98A" : "#4A4640", opacity:sel ? 1 : .8 }}/>
                      {sel && <div style={{ position:"absolute", top:4, right:6, fontSize:8, color:"#22C98A" }}>✓</div>}
                      <div style={{ fontWeight:500, fontSize:12, marginBottom:1, marginTop:1, color: sel ? "#D8F8EE" : "#C8C0A8" }}>{m.machine_name}</div>
                      <div style={{ fontSize:8, color:"#6A6458" }}>{m.tonnage}T</div>
                      <div style={{ fontSize:8, color:"#4A4640" }}>{m.model}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMachines.length > 0 && (
              <div className="fu" style={{ marginTop:9, padding:"9px 10px", background:"#0A1A10", border:"1px solid #183A24", borderRadius:6 }}>
                <div style={{ fontSize:8, color:"#22C98A", marginBottom:6, letterSpacing:".08em" }}>
                  {selectedMachines.length} MACHINE{selectedMachines.length > 1 ? "S" : ""} SELECTED
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {selectedMachines.map(m => (
                    <div key={m.machine_id} className="chip" onClick={() => toggleMachine(m)} title="Remove">
                      <span style={{ color:"#D8F8EE" }}>{m.machine_id}</span>
                      <span style={{ color:"#3A6A58", fontSize:8 }}>{m.tonnage}T</span>
                      <span style={{ color:"#3A6A58", fontSize:10, lineHeight:1 }}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2 — Order source */}
          <div>
            <div style={{ fontSize:9, color:"#9A9284", letterSpacing:".1em", textTransform:"uppercase", marginBottom:9 }}>2 — Order source</div>
            <div style={{ display:"flex", gap:5, marginBottom:9 }}>
              <button className={`bail-btn${!useDbOrders ? " on" : ""}`} onClick={() => setUseDbOrders(false)}>Upload file</button>
              <button className={`bail-btn${useDbOrders  ? " on" : ""}`} onClick={handleSelectDb}>From DB</button>
            </div>

            {!useDbOrders ? (
              <div className="drop" onClick={() => fileRef.current.click()}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleFile}/>
                {orderFile ? (
                  <div className="fu">
                    <div style={{ color:"#22C98A", fontSize:11, marginBottom:3 }}>{orderFile.name}</div>
                    <div style={{ color:"#6A6458", fontSize:9 }}>{(orderFile.size/1024).toFixed(1)} KB · click to change</div>
                  </div>
                ) : (
                  <>
                    <div style={{ color:"#6A6458", fontSize:10, marginBottom:3 }}>Drag & drop or click to browse</div>
                    <div style={{ color:"#4A4640", fontSize:9 }}>.xlsx · .xls · .csv</div>
                    <div style={{ color:"#3E3A34", fontSize:9, marginTop:2 }}>required columns: order_id · item_id · item_name · quantity · etd</div>
                  </>
                )}
              </div>
            ) : (
              <div className="fu" style={{ padding:"10px", background:"#0E0C08", border:"1px solid #222018", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"#9A9284", marginBottom:6 }}>
                  {dbOrdersLoading
                    ? <span className="pulse">Loading...</span>
                    : `DB preview — ${dbOrders.length} pending orders${USE_MOCK ? " (mock)" : ""}`
                  }
                </div>
                {!dbOrdersLoading && dbOrders.map(({ order_id, item_id, item_name, quantity, etd }) => (
                  <div key={order_id ?? item_id} style={{ padding:"5px 0", borderBottom:"1px solid #1A1814" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ color:"#D8F8EE", fontSize:10 }}>{order_id}</span>
                      <span style={{ fontSize:9, color:"#6A6458" }}>ETD {etd}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"#9A9284", fontSize:9 }}>{item_id}{item_name ? ` · ${item_name}` : ""}</span>
                      <span style={{ color:"#6A6458", fontSize:9 }}>{quantity?.toLocaleString()} pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="fu" style={{ padding:"9px 11px", background:"#1A0808", border:"1px solid #4A1A1A", borderRadius:6, fontSize:10, color:"#F0C8B4" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button className={`sub${canSubmit ? " go" : " hint"}`} onClick={handleSubmit} disabled={!canSubmit || loading}>
            {loading ? (
              <span className="pulse">{LOADING_STEPS[stepIdx]}</span>
            ) : canSubmit ? (
              selectedMachines.length > 1
                ? `Get recommendations — ${selectedMachines.length} machines →`
                : "Get recommendation →"
            ) : (
              "Select machines and order source to continue"
            )}
          </button>

          {/* Request flow */}
          <div style={{ borderTop:"1px solid #1E1C16", paddingTop:12 }}>
            <div style={{ fontSize:8, color:"#3E3A34", letterSpacing:".1em", marginBottom:5, textTransform:"uppercase" }}>Request flow</div>
            {["POST /recommend","multipart/form-data","machine_ids[] + file | use_db","→ capacity matrix → recommend → LLM → validate"].map((s,i) => (
              <div key={i} style={{ fontSize:9, color:"#4A4640", padding:"2px 0" }}>{s}</div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{ overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* Tabs */}
          <div style={{ borderBottom:"1px solid #1E1C16", padding:"0 20px", display:"flex", background:"#0F0E0A", position:"sticky", top:0, zIndex:10 }}>
            {["input","output","validation"].map(t => (
              <button key={t} className={`tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>
                {t.toUpperCase()}
                {t === "validation" && result && resultReady && (
                  <span style={{ marginLeft:5, fontSize:8, padding:"1px 5px", borderRadius:2,
                    background: result.validation?.passed ? "#0D4A32" : "#3D0A0A",
                    color:      result.validation?.passed ? "#22C98A" : "#E24B4A" }}>
                    {result.validation?.passed ? "PASS" : "FAIL"}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding:"22px", flex:1 }}>

            {/* Empty state */}
            {!result && !loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8, color:"#2A2820" }}>
                <div style={{ fontSize:26 }}>⬡</div>
                <div style={{ fontSize:11 }}>Select machines and order source to begin</div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10 }}>
                {LOADING_STEPS.map((s,i) => (
                  <div key={i} style={{ fontSize:11, color: i === stepIdx ? "#22C98A" : "#2A2820", transition:"color .3s" }}>
                    {i === stepIdx ? "▸ " : "  "}{s}
                  </div>
                ))}
              </div>
            )}

            {/* ── INPUT TAB ── */}
            {result && activeTab === "input" && (
              <div className="fu">
                <div style={{ fontSize:9, color:"#9A9284", marginBottom:12, letterSpacing:".1em", textTransform:"uppercase" }}>Request params</div>
                <pre style={{ background:"#0C0B08", border:"1px solid #1A1814", borderRadius:8, padding:16, fontSize:10, color:"#D8F8EE", overflowX:"auto", lineHeight:1.8 }}>
                  {JSON.stringify({ machine_ids: selectedMachines.map(m => m.machine_id), source: orderFile ? `file:${orderFile.name}` : "db" }, null, 2)}
                </pre>
              </div>
            )}

            {/* ── OUTPUT TAB ── */}
            {result && resultReady && activeTab === "output" && (
              <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

                <div>
                  <div style={{ fontSize:9, color:"#9A9284", marginBottom:9, letterSpacing:".1em", textTransform:"uppercase" }}>Recommendations</div>
                  {result.machines?.length > 0 ? result.machines.map((m, i) => (
                    <div key={m.machine_id} className="fu" style={{ animationDelay:`${i * .07}s`,
                      border:`1px solid ${i === 0 ? "#22C98A" : "#222018"}`, borderRadius:8,
                      padding:"13px 14px", marginBottom:7,
                      background: i === 0 ? "#0A1A11" : "#111008" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:8, flexWrap:"wrap" }}>
                        <span style={{ fontSize:9, color:"#4A4640", width:16 }}>#{i+1}</span>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:"#F2EDD8" }}>
                          {m.top_pick?.item_id}
                        </span>
                        <span style={{ fontSize:9, color:"#9A9284" }}>{m.top_pick?.item_name}</span>
                        <span style={{ fontSize:9, color:"#6A6458" }}>{m.top_pick?.order_id}</span>
                        <span style={{ fontSize:9, color:"#22C98A", padding:"1px 5px", border:"1px solid #1A4A35", borderRadius:3 }}>
                          {m.machine_id}
                        </span>
                        <span className="tag" style={{ marginLeft:"auto", background:urgencyBg(m.top_pick?.urgency), color:urgencyColor(m.top_pick?.urgency) }}>
                          {m.top_pick?.urgency}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:"#C8C0A8", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif" }}>
                        {m.top_pick?.reason}
                      </div>
                      <div style={{ fontSize:9, color:"#9A9284", lineHeight:1.65, marginTop:5, fontFamily:"'DM Sans',sans-serif" }}>
                        {m.top_pick?.urgency_reason}
                      </div>
                      {m.next_picks?.length > 0 && (
                        <div style={{ marginTop:10, display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={{ fontSize:8, color:"#6A6458" }}>next:</span>
                          {m.next_picks.map(id => (
                            <span key={id} style={{ fontSize:9, color:"#9A9284", padding:"1px 5px", border:"1px solid #222018", borderRadius:3 }}>{id}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )) : (
                    <div style={{ padding:"20px 0", color:"#6A6458", fontSize:11, textAlign:"center" }}>
                      No recommendations available for the selected machines.
                    </div>
                  )}
                </div>

                {/* Summary */}
                <div style={{ background:"#0A1A11", border:"1px solid #1A4A35", borderRadius:8, padding:"11px 13px" }}>
                  <div style={{ fontSize:9, color:"#22C98A", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>Summary</div>
                  <div style={{ fontSize:11, color:"#D8F8EE", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif" }}>{result.summary}</div>
                </div>
                
                {/* System notices */}
                {result.system_notices?.length > 0 && (
                  <div style={{ background:"#0E1A14", border:"1px solid #1A3A28", borderRadius:8, padding:"11px 13px" }}>
                    <div style={{ fontSize:9, color:"#22C98A", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>System notices</div>
                    {result.system_notices.map((n, i) => (
                      <div key={i} style={{ fontSize:11, color:"#9A9284", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif", marginBottom: i < result.system_notices.length - 1 ? 5 : 0 }}>
                        ℹ {n}
                      </div>
                    ))}
                  </div>
                )}

                {/* Warnings */}
                {result.warnings?.length > 0 && (
                  <div style={{ background:"#160C08", border:"1px solid #3A1A10", borderRadius:8, padding:"11px 13px" }}>
                    <div style={{ fontSize:9, color:"#E05A3A", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>Warnings</div>
                    {result.warnings.map((w,i) => (
                      <div key={i} style={{ fontSize:11, color:"#F0C8B4", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif", marginBottom: i < result.warnings.length-1 ? 5 : 0 }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Usage */}
                {result.usage && (
                  <div style={{ background:"#0E0C08", border:"1px solid #222018", borderRadius:8, padding:"11px 13px" }}>
                    <div style={{ fontSize:9, color:"#6A6458", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>Token usage</div>
                    <div style={{ display:"flex", gap:16, fontSize:9, color:"#9A9284" }}>
                      <span>{result.usage.model}</span>
                      <span>{result.usage.input_tokens} in / {result.usage.output_tokens} out</span>
                      <span style={{ color:"#22C98A" }}>${result.usage.total_cost?.toFixed(6)}</span>
                    </div>
                  </div>
                )}

                {/* Raw */}
                <div>
                  <div style={{ fontSize:9, color:"#4A4640", marginBottom:5, letterSpacing:".1em", textTransform:"uppercase" }}>Raw output</div>
                  <pre style={{ background:"#0C0B08", border:"1px solid #1A1814", borderRadius:8, padding:13, fontSize:9, color:"#6A6458", overflowX:"auto", lineHeight:1.8 }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* ── VALIDATION TAB ── */}
            {result && resultReady && activeTab === "validation" && (
              <div className="fu">
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
                  <div style={{ fontSize:9, color:"#9A9284", letterSpacing:".1em", textTransform:"uppercase" }}>Validation layer</div>
                  <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, fontWeight:500,
                    background: result.validation?.passed ? "#0D4A32" : "#3D0A0A",
                    color:      result.validation?.passed ? "#22C98A" : "#E24B4A" }}>
                    {result.validation?.passed ? "ALL CHECKS PASSED" : "CHECKS FAILED"}
                  </span>
                </div>
                {result.validation?.checks?.map((c,i) => (
                  <div key={i} className="cr">
                    <span style={{ fontSize:11, color:c.ok ? "#22C98A" : "#E24B4A", marginTop:1, width:14, flexShrink:0 }}>{c.ok ? "✓" : "✗"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:3 }}>
                        <span style={{ color:"#D8F8EE", fontSize:10 }}>{c.rule}</span>
                        <span style={{ color:"#6A6458", fontSize:9 }}>item: {c.item}</span>
                      </div>
                      <div style={{ fontSize:9, color:"#6A6458", marginBottom:2 }}>expected: <span style={{ color:"#9A9284" }}>{c.expected}</span></div>
                      <div style={{ fontSize:9, color:"#6A6458" }}>actual: <span style={{ color:c.ok ? "#22C98A" : "#E24B4A" }}>{c.actual}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}