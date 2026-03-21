// ╔══════════════════════════════════════════════════════════════════════════════
// ║  MOCK DATA
// ╚══════════════════════════════════════════════════════════════════════════════
export const MOCK_MACHINES = [
  { machine_id: "MD50S-000", machine_name: "MD50S", tonnage: 50,  model: "MD50S", status: "idle" },
  { machine_id: "MD50S-001", machine_name: "MD50S", tonnage: 50,  model: "MD50S", status: "running" },
  { machine_id: "EC50ST-000",machine_name: "EC50ST",tonnage: 50,  model: "EC50ST",status: "idle" },
  { machine_id: "HN-80B-000",machine_name: "HN-80B",tonnage: 80,  model: "HN-80B",status: "maintenance" },
  { machine_id: "HN-120-000",machine_name: "HN-120",tonnage: 120, model: "HN-120",status: "running" },
  { machine_id: "KM-200-000",machine_name: "KM-200",tonnage: 200, model: "KM-200",status: "idle" },
];

export const MOCK_DB_ORDERS = [
  { order_id: "PO-001", item_id: "A12", item_name: "CT-CAX-LOCK-BUTTON", quantity: 500,  received_date: "2026-03-01", etd: "2026-03-20", hours_to_etd: 18 },
  { order_id: "PO-002", item_id: "B05", item_name: "CT-PS-SPACER",        quantity: 200,  received_date: "2026-03-05", etd: "2026-03-22", hours_to_etd: 42 },
  { order_id: "PO-003", item_id: "C08", item_name: "CT-CAX-REEL",         quantity: 800,  received_date: "2026-03-10", etd: "2026-03-25", hours_to_etd: 90 },
];

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  MOCK HELPERS
// ╚══════════════════════════════════════════════════════════════════════════════
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function buildMockResult(machineIds, source) {
  const sel = MOCK_MACHINES.filter(m => machineIds.includes(m.machine_id));
  return {
    machines: sel.map((m, i) => ({
      machine_id:   m.machine_id,
      machine_name: m.machine_name,
      top_pick: {
        item_id:        i === 0 ? "A12" : "B05",
        item_name:      i === 0 ? "CT-CAX-LOCK-BUTTON" : "CT-PS-SPACER",
        order_id:       i === 0 ? "PO-001" : "PO-002",
        reason:         i === 0
          ? "Overdue order with highest capacity match on this machine."
          : "Earliest ETD among remaining orders, capacity sufficient.",
        urgency:        i === 0 ? "high" : "medium",
        urgency_reason: i === 0 ? "ETD has already passed." : "ETD within 7 days.",
      },
      next_picks: i === 0 ? ["B05", "C08"] : ["C08"],
    })),
    warnings: ["Order PO-002 (B05) is paused and approaching ETD."],
    summary:  `Run PO-001 (A12) first — overdue. Distribute across ${sel.length} selected machines.`,
    validation: {
      passed: true,
      checks: [
        { rule: "valid_machine_id",             item: sel[0]?.id, expected: `one of ${JSON.stringify(machineIds)}`, actual: sel[0]?.id, ok: true },
        { rule: "valid_item_id",                item: "A12",      expected: "one of ['A12','B05','C08']",           actual: "A12",      ok: true },
        { rule: "machine_assignment_match",     item: "A12",      expected: sel[0]?.id,                            actual: sel[0]?.id, ok: true },
        { rule: "urgency_high_for_overdue",     item: "A12",      expected: "high (ETD already passed)",           actual: "high",     ok: true },
        { rule: "top_pick_matches_priority_1",  item: "A12",      expected: "A12",                                 actual: "A12",      ok: true },
        { rule: "warnings_required_for_paused", item: "ALL",      expected: "warnings not empty",                  actual: "present",  ok: true },
      ],
    },
    usage: {
      model:         "gpt-4o",
      input_tokens:  823,
      output_tokens: 312,
      input_cost:    0.002058,
      output_cost:   0.003125,
      total_cost:    0.005183,
    },
  };
}

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  MOCK API
// ║  Shape phải giống hệt realApi trong client.js
// ╚══════════════════════════════════════════════════════════════════════════════
export const mockApi = {
  machines: () =>
    delay(400).then(() => MOCK_MACHINES),

  recommend: (machineIds, file, useDb) =>
    delay(2400).then(() =>
      buildMockResult(machineIds, file ? `file:${file.name}` : "db")
    ),
};