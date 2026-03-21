// control_panel/src/BailoutDemo.jsx

import { useState, useRef, useEffect } from "react";
import { api, USE_MOCK }  from "./api/client.js";

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  HELPERS
// ╚══════════════════════════════════════════════════════════════════════════════

const urgencyColor = u => ({ high: "#1D9E75", medium: "#BA7517", low: "#993C1D" }[u] ?? "#888");
const urgencyBg    = u => ({ high: "#0B3D2A", medium: "#2A1E08", low: "#2A0E08" }[u] ?? "#1A1A18");

const LOADING_STEPS = [
  "Parsing uploaded data...",
  "Matching molds to machines...",
  "Computing capacity matrix...",
  "LLM reasoning...",
  "Validating output...",
];

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  COMPONENT
// ╚══════════════════════════════════════════════════════════════════════════════
export default function BailoutDemo() {
  const [machines, setMachines]                 = useState([]);
  const [machinesLoading, setMachinesLoading]   = useState(true);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [orderFile, setOrderFile]               = useState(null);
  const [useDbOrders, setUseDbOrders]           = useState(false);
  const [dbOrders, setDbOrders]                 = useState([]);
  const [dbOrdersLoading, setDbOrdersLoading]   = useState(false);
  const [activeTab, setActiveTab]               = useState("input");
  const [loading, setLoading]                   = useState(false);
  const [stepIdx, setStepIdx]                   = useState(0);
  const [result, setResult]                     = useState(null);
  const [error, setError]                       = useState(null);
  const fileRef = useRef();

  useEffect(() => {
    api.machines()
      .then(setMachines)
      .catch(err => setError(`Không tải được danh sách máy: ${err.message}`))
      .finally(() => setMachinesLoading(false));
  }, []);

  useEffect(() => {
    if (!loading) { setStepIdx(0); return; }
    const id = setInterval(() => setStepIdx(i => (i + 1) % LOADING_STEPS.length), 440);
    return () => clearInterval(id);
  }, [loading]);

  const toggleMachine = (m) =>
    setSelectedMachines(prev =>
      prev.find(s => s.machine_id === m.machine_id)
        ? prev.filter(s => s.machine_id !== m.machine_id)
        : [...prev, m]
    );

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (f) { setOrderFile(f); setUseDbOrders(false); }
  };

  const handleSelectDb = async () => {
    setUseDbOrders(true);
    setOrderFile(null);
    if (dbOrders.length > 0) return;   // đã fetch rồi thì thôi
    setDbOrdersLoading(true);
    try {
      const data = await api.pendingOrders();
      setDbOrders(data);
    } catch (err) {
      setError(`Không tải được orders: ${err.message}`);
    } finally {
      setDbOrdersLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit || loading) return;
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const data = await api.recommend(
        selectedMachines.map(m => m.machine_id),
        orderFile,
        useDbOrders,
      );
      setResult(data);
      setActiveTab("output");
    } catch (err) {
      setError(err.message ?? "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = selectedMachines.length > 0 && (orderFile || useDbOrders);

  return (
    <div style={{ fontFamily: "'DM Mono','Fira Mono',monospace", background: "#0F0F0E", minHeight: "100vh", color: "#E8E6DF" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=DM+Sans:wght@400;500;600&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        .mach{background:none;border:1px solid #222;color:#555;cursor:pointer;font-family:inherit;
          padding:9px 7px 7px;border-radius:6px;transition:border-color .12s,background .12s,color .12s;
          width:100%;text-align:center;position:relative;}
        .mach:hover{border-color:#444;color:#999;}
        .mach.sel{border-color:#1D9E75;background:#0B3D2A;color:#9FE1CB;}
        .bail-btn{background:none;border:1px solid #333;color:#666;cursor:pointer;
          font-family:inherit;font-size:11px;padding:5px 11px;border-radius:4px;transition:all .12s;}
        .bail-btn:hover{border-color:#555;color:#aaa;}
        .bail-btn.on{background:#1D9E75;border-color:#1D9E75;color:#fff;}
        .tab{background:none;border:none;border-bottom:2px solid transparent;color:#444;
          cursor:pointer;font-family:inherit;font-size:10px;padding:10px 14px;
          letter-spacing:.05em;transition:all .12s;}
        .tab:hover{color:#777;}
        .tab.on{border-bottom-color:#1D9E75;color:#1D9E75;}
        .drop{border:1px dashed #222;border-radius:6px;padding:16px;text-align:center;
          cursor:pointer;transition:border-color .15s,background .15s;}
        .drop:hover{border-color:#1D9E75;background:#0a180f;}
        .chip{display:inline-flex;align-items:center;gap:4px;padding:2px 7px 2px 5px;
          background:#0F2D1F;border:1px solid #1A4A35;border-radius:4px;cursor:pointer;
          font-size:10px;transition:background .1s;}
        .chip:hover{background:#183D2A;}
        .sub{width:100%;border:none;border-radius:6px;font-family:inherit;font-size:11px;
          font-weight:500;padding:10px 14px;cursor:pointer;transition:all .18s;letter-spacing:.03em;}
        .sub:disabled{background:#181816!important;color:#2A2A28!important;cursor:not-allowed;}
        .sub.go{background:#1D9E75;color:#fff;}
        .sub.go:hover{background:#22b587;}
        .sub.hint{background:#181816;color:#3A3A38;}
        .tag{display:inline-block;font-size:9px;padding:2px 6px;border-radius:3px;font-weight:500;}
        .cr{display:flex;align-items:flex-start;gap:10px;padding:7px 0;border-bottom:1px solid #191917;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fu{animation:fadeUp .22s ease forwards}
        .pulse{animation:pulse 1.1s ease-in-out infinite}
        .spin{animation:spin .75s linear infinite;display:inline-block}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:#222;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ background:"#111110", borderBottom:"1px solid #1C1C1A", padding:"13px 26px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#1D9E75" }}/>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, letterSpacing:"-.02em" }}>Bailout</span>
          <span style={{ color:"#2C2C2A", fontSize:10 }}>/ scheduling assistant</span>
        </div>
        <span style={{ fontSize:9, color: USE_MOCK ? "#BA7517" : "#1D9E75", padding:"3px 8px", border:`1px solid ${USE_MOCK ? "#3A2A10" : "#1A3A2A"}`, borderRadius:3 }}>
          {USE_MOCK ? "mock mode" : "live"}
        </span>
      </div>

      {/* Body grid */}
      <div style={{ display:"grid", gridTemplateColumns:"296px 1fr", height:"calc(100vh - 43px)" }}>

        {/* ══ LEFT PANEL ══ */}
        <div style={{ background:"#111110", borderRight:"1px solid #1C1C1A", padding:"18px", overflowY:"auto", display:"flex", flexDirection:"column", gap:18 }}>

          {/* 1 — Machines */}
          <div>
            <div style={{ fontSize:9, color:"#444", letterSpacing:".1em", textTransform:"uppercase", marginBottom:2 }}>1 — Chọn máy</div>
            <div style={{ fontSize:9, color:"#2A2A28", marginBottom:9 }}>Click để chọn / bỏ chọn · không giới hạn status</div>

            {machinesLoading ? (
              <div style={{ color:"#2A2A28", fontSize:10, padding:"10px 0" }}>
                <span className="spin" style={{ marginRight:6, opacity:.5 }}>◌</span>Đang tải danh sách máy...
              </div>
            ) : (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:5 }}>
                {machines.map(m => {
                  const sel = !!selectedMachines.find(s => s.machine_id === m.machine_id);
                  return (
                    <button key={m.machine_id} className={`mach${sel ? " sel" : ""}`} onClick={() => toggleMachine(m)}>
                      <div style={{ position:"absolute", top:6, left:7, width:5, height:5, borderRadius:"50%", background:sel ? "#1D9E75" : "#333", opacity:sel ? 1 : .55 }}/>
                      {sel && <div style={{ position:"absolute", top:4, right:6, fontSize:8, color:"#1D9E75" }}>✓</div>}
                      <div style={{ fontWeight:500, fontSize:12, marginBottom:1, marginTop:1 }}>{m.machine_name}</div>
                      <div style={{ fontSize:8, opacity:.55 }}>{m.tonnage}T</div>
                      <div style={{ fontSize:8, opacity:.35 }}>{m.model}</div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedMachines.length > 0 && (
              <div className="fu" style={{ marginTop:9, padding:"9px 10px", background:"#0A1A10", border:"1px solid #183A24", borderRadius:6 }}>
                <div style={{ fontSize:8, color:"#1D9E75", marginBottom:6, letterSpacing:".08em" }}>
                  {selectedMachines.length} MÁY ĐÃ CHỌN
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {selectedMachines.map(m => (
                    <div key={m.machine_id} className="chip" onClick={() => toggleMachine(m)} title="Bỏ chọn">
                      <span style={{ color:"#9FE1CB" }}>{m.machine_id}</span>
                      <span style={{ color:"#2A4A38", fontSize:8 }}>{m.tonnage}T</span>
                      <span style={{ color:"#2A4A38", fontSize:10, lineHeight:1 }}>×</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2 — PO source */}
          <div>
            <div style={{ fontSize:9, color:"#444", letterSpacing:".1em", textTransform:"uppercase", marginBottom:9 }}>2 — Nguồn PO</div>
            <div style={{ display:"flex", gap:5, marginBottom:9 }}>
              <button className={`bail-btn${!useDbOrders ? " on" : ""}`} onClick={() => { setUseDbOrders(false); }}>Upload file</button>
              <button className={`bail-btn${useDbOrders  ? " on" : ""}`} onClick={handleSelectDb}>Từ DB</button>
            </div>

            {!useDbOrders ? (
              // ── Upload ──
              <div className="drop" onClick={() => fileRef.current.click()}>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:"none" }} onChange={handleFile}/>
                {orderFile ? (
                  <div className="fu">
                    <div style={{ color:"#1D9E75", fontSize:11, marginBottom:3 }}>{orderFile.name}</div>
                    <div style={{ color:"#3A3A38", fontSize:9 }}>{(orderFile.size / 1024).toFixed(1)} KB · click để đổi</div>
                  </div>
                ) : (
                  <>
                    <div style={{ color:"#383836", fontSize:10, marginBottom:3 }}>Kéo thả hoặc click để chọn</div>
                    <div style={{ color:"#222", fontSize:9 }}>.xlsx · .xls · .csv</div>
                    <div style={{ color:"#1C1C1A", fontSize:9, marginTop:2 }}>cột cần có: order_id · item_id · item_name · quantity · etd</div>
                  </>
                )}
              </div>
            ) : (
              // ── DB preview (dynamic, từ api.pendingOrders) ──
              <div className="fu" style={{ padding:"10px", background:"#0D0D0C", border:"1px solid #1C1C1A", borderRadius:6 }}>
                <div style={{ fontSize:9, color:"#444", marginBottom:6 }}>
                  {dbOrdersLoading
                    ? <span className="pulse">Đang tải...</span>
                    : `DB preview — ${dbOrders.length} PO đang chờ${USE_MOCK ? " (mock)" : ""}`
                  }
                </div>
                {!dbOrdersLoading && dbOrders.map(({ order_id, item_id, item_name, quantity, etd }) => (
                  <div key={order_id ?? item_id} style={{ padding:"5px 0", borderBottom:"1px solid #181816" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                      <span style={{ color:"#9FE1CB", fontSize:10 }}>{order_id}</span>
                      <span style={{ fontSize:9, color:"#2C2C2A" }}>ETD {etd}</span>
                    </div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}>
                      <span style={{ color:"#484846", fontSize:9 }}>{item_id}{item_name ? ` · ${item_name}` : ""}</span>
                      <span style={{ color:"#3A3A38", fontSize:9 }}>{quantity} pcs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="fu" style={{ padding:"9px 11px", background:"#1A0808", border:"1px solid #4A1A1A", borderRadius:6, fontSize:10, color:"#E8C4B4" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            className={`sub${canSubmit ? " go" : " hint"}`}
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
          >
            {loading ? (
              <span className="pulse">{LOADING_STEPS[stepIdx]}</span>
            ) : canSubmit ? (
              selectedMachines.length > 1
                ? `Get recommendations — ${selectedMachines.length} machines →`
                : "Get recommendation →"
            ) : (
              "Chọn máy và nguồn PO để tiếp tục"
            )}
          </button>

          {/* Request flow hint */}
          <div style={{ borderTop:"1px solid #191917", paddingTop:12 }}>
            <div style={{ fontSize:8, color:"#222", letterSpacing:".1em", marginBottom:5, textTransform:"uppercase" }}>Request flow</div>
            {[
              "POST /recommend",
              "multipart/form-data",
              "machine_ids[] + file | use_db",
              "→ capacity matrix → recommend → LLM → validate",
            ].map((s, i) => (
              <div key={i} style={{ fontSize:9, color:"#242422", padding:"2px 0" }}>{s}</div>
            ))}
          </div>
        </div>

        {/* ══ RIGHT PANEL ══ */}
        <div style={{ overflowY:"auto", display:"flex", flexDirection:"column" }}>

          {/* Tabs */}
          <div style={{ borderBottom:"1px solid #1C1C1A", padding:"0 20px", display:"flex", background:"#0F0F0E", position:"sticky", top:0, zIndex:10 }}>
            {["input", "output", "validation"].map(t => (
              <button key={t} className={`tab${activeTab === t ? " on" : ""}`} onClick={() => setActiveTab(t)}>
                {t.toUpperCase()}
                {t === "validation" && result && (
                  <span style={{ marginLeft:5, fontSize:8, padding:"1px 5px", borderRadius:2,
                    background: result.validation.passed ? "#0B3D2A" : "#3D0A0A",
                    color:      result.validation.passed ? "#1D9E75" : "#E24B4A" }}>
                    {result.validation.passed ? "PASS" : "FAIL"}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div style={{ padding:"22px", flex:1 }}>

            {/* Empty state */}
            {!result && !loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:8, color:"#1E1E1C" }}>
                <div style={{ fontSize:26 }}>⬡</div>
                <div style={{ fontSize:11 }}>Chọn máy và nguồn PO để bắt đầu</div>
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100%", gap:10 }}>
                {LOADING_STEPS.map((s, i) => (
                  <div key={i} style={{ fontSize:11, color: i === stepIdx ? "#1D9E75" : "#1E1E1C", transition:"color .3s" }}>
                    {i === stepIdx ? "▸ " : "  "}{s}
                  </div>
                ))}
              </div>
            )}

            {/* ── INPUT TAB ── */}
            {result && activeTab === "input" && (
              <div className="fu">
                <div style={{ fontSize:9, color:"#3A3A38", marginBottom:12, letterSpacing:".1em", textTransform:"uppercase" }}>
                  Request params
                </div>
                <pre style={{ background:"#0C0C0B", border:"1px solid #1A1A18", borderRadius:8, padding:16, fontSize:10, color:"#9FE1CB", overflowX:"auto", lineHeight:1.8 }}>
                  {JSON.stringify({
                    machine_ids: selectedMachines.map(m => m.machine_id),
                    source: orderFile ? `file:${orderFile.name}` : "db",
                  }, null, 2)}
                </pre>
              </div>
            )}

            {/* ── OUTPUT TAB ── */}
            {result && activeTab === "output" && (
              <div className="fu" style={{ display:"flex", flexDirection:"column", gap:14 }}>

                <div>
                  <div style={{ fontSize:9, color:"#3A3A38", marginBottom:9, letterSpacing:".1em", textTransform:"uppercase" }}>Recommendations</div>
                  {result.machines.map((m, i) => (
                    <div key={m.machine_id} className="fu" style={{ animationDelay:`${i * .07}s`,
                      border:`1px solid ${i === 0 ? "#1D9E75" : "#1C1C1A"}`, borderRadius:8,
                      padding:"13px 14px", marginBottom:7,
                      background: i === 0 ? "#0A1A11" : "#101010" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
                        <span style={{ fontSize:9, color:"#2C2C2A", width:16 }}>#{i + 1}</span>
                        <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:"#E8E6DF" }}>
                          {m.top_pick.item_id}
                        </span>
                        <span style={{ fontSize:9, color:"#484846" }}>{m.top_pick.item_name}</span>
                        <span style={{ fontSize:9, color:"#2A2A28" }}>{m.top_pick.order_id}</span>
                        <span style={{ fontSize:9, color:"#1D9E75", padding:"1px 5px", border:"1px solid #1A4A35", borderRadius:3 }}>
                          {m.machine_id}
                        </span>
                        <span className="tag" style={{ marginLeft:"auto", background:urgencyBg(m.top_pick.urgency), color:urgencyColor(m.top_pick.urgency) }}>
                          {m.top_pick.urgency}
                        </span>
                      </div>
                      <div style={{ fontSize:11, color:"#666", lineHeight:1.65, fontFamily:"'DM Sans',sans-serif" }}>
                        {m.top_pick.reason}
                      </div>
                      <div style={{ fontSize:9, color:"#2C2C2A", lineHeight:1.65, marginTop:4 }}>
                        {m.top_pick.urgency_reason}
                      </div>
                      {m.next_picks?.length > 0 && (
                        <div style={{ marginTop:8, display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
                          <span style={{ fontSize:8, color:"#2A2A28" }}>next:</span>
                          {m.next_picks.map(id => (
                            <span key={id} style={{ fontSize:9, color:"#484846", padding:"1px 5px", border:"1px solid #1C1C1A", borderRadius:3 }}>{id}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Summary */}
                <div style={{ background:"#0A1A11", border:"1px solid #183A24", borderRadius:8, padding:"11px 13px" }}>
                  <div style={{ fontSize:9, color:"#1D9E75", marginBottom:4, letterSpacing:".08em", textTransform:"uppercase" }}>Summary</div>
                  <div style={{ fontSize:11, color:"#9FE1CB", lineHeight:1.65, fontFamily:"'DM Sans',sans-serif" }}>{result.summary}</div>
                </div>

                {/* Warnings */}
                {result.warnings?.length > 0 && (
                  <div style={{ background:"#160C08", border:"1px solid #3A1A10", borderRadius:8, padding:"11px 13px" }}>
                    <div style={{ fontSize:9, color:"#993C1D", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>Warnings</div>
                    {result.warnings.map((w, i) => (
                      <div key={i} style={{ fontSize:11, color:"#E8C4B4", lineHeight:1.65, fontFamily:"'DM Sans',sans-serif", marginBottom: i < result.warnings.length - 1 ? 4 : 0 }}>
                        ⚠ {w}
                      </div>
                    ))}
                  </div>
                )}

                {/* Usage */}
                {result.usage && (
                  <div style={{ background:"#0D0D0C", border:"1px solid #1A1A18", borderRadius:8, padding:"11px 13px" }}>
                    <div style={{ fontSize:9, color:"#2C2C2A", marginBottom:6, letterSpacing:".08em", textTransform:"uppercase" }}>Token usage</div>
                    <div style={{ display:"flex", gap:16, fontSize:9, color:"#484846" }}>
                      <span>{result.usage.model}</span>
                      <span>{result.usage.input_tokens} in / {result.usage.output_tokens} out</span>
                      <span style={{ color:"#1D9E75" }}>${result.usage.total_cost.toFixed(6)}</span>
                    </div>
                  </div>
                )}

                {/* Raw */}
                <div>
                  <div style={{ fontSize:9, color:"#2C2C2A", marginBottom:5, letterSpacing:".1em", textTransform:"uppercase" }}>Raw output</div>
                  <pre style={{ background:"#0C0C0B", border:"1px solid #1A1A18", borderRadius:8, padding:13, fontSize:9, color:"#444", overflowX:"auto", lineHeight:1.8 }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* ── VALIDATION TAB ── */}
            {result && activeTab === "validation" && (
              <div className="fu">
                <div style={{ display:"flex", alignItems:"center", gap:9, marginBottom:16 }}>
                  <div style={{ fontSize:9, color:"#3A3A38", letterSpacing:".1em", textTransform:"uppercase" }}>Validation layer</div>
                  <span style={{ fontSize:9, padding:"2px 7px", borderRadius:3, fontWeight:500,
                    background: result.validation.passed ? "#0B3D2A" : "#3D0A0A",
                    color:      result.validation.passed ? "#1D9E75" : "#E24B4A" }}>
                    {result.validation.passed ? "ALL CHECKS PASSED" : "CHECKS FAILED"}
                  </span>
                </div>
                {result.validation.checks.map((c, i) => (
                  <div key={i} className="cr">
                    <span style={{ fontSize:11, color:c.ok ? "#1D9E75" : "#E24B4A", marginTop:1, width:14, flexShrink:0 }}>{c.ok ? "✓" : "✗"}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:3 }}>
                        <span style={{ color:"#9FE1CB", fontSize:10 }}>{c.rule}</span>
                        <span style={{ color:"#2A2A28", fontSize:9 }}>item: {c.item}</span>
                      </div>
                      <div style={{ fontSize:9, color:"#2E2E2C", marginBottom:2 }}>expected: <span style={{ color:"#484846" }}>{c.expected}</span></div>
                      <div style={{ fontSize:9, color:"#2E2E2C" }}>actual: <span style={{ color:c.ok ? "#1D9E75" : "#E24B4A" }}>{c.actual}</span></div>
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