// control_panel/src/api/mock.js

// ╔══════════════════════════════════════════════════════════════════════════════
// ║  MOCK DATA
// ╚══════════════════════════════════════════════════════════════════════════════
export const MOCK_MACHINES = [
  { machine_id: "MD50S-000", machine_name: "MD50S", tonnage: 50,  model: "Niigata"},
  { machine_id: "MD50S-001", machine_name: "MD50S", tonnage: 50,  model: "Niigata"},
  { machine_id: "EC50ST-000",machine_name: "EC50ST",tonnage: 50,  model: "Toshiba"},
  { machine_id: "J100ADS-000",machine_name: "J100ADS",tonnage: 100, model: "JSW"},
  { machine_id: "J100ADS-001",machine_name: "J100ADS",tonnage: 100, model: "JSW"},
  { machine_id: "MD100S-000", machine_name: "MD100S",tonnage: 100, model: "Niigata"},
  { machine_id: "MD100S-001", machine_name: "MD100S",tonnage: 100, model: "Niigata"},
  { machine_id: "MD130S-000", machine_name: "MD130S",tonnage: 130, model: "Niigata"},
  { machine_id: "MD130S-001", machine_name: "MD130S",tonnage: 130, model: "Niigata"},
  { machine_id: "CNS50-000",  machine_name: "CNS50", tonnage: 50,  model: "Niigata"},
  { machine_id: "CNS50-001",  machine_name: "CNS50", tonnage: 50,  model: "Niigata"},
];

export const MOCK_DB_ORDERS = [
  {received_date: "2019-01-25", order_id: "IM1902119", etd: "2019-02-20", item_id: "24720326M", item_name: "CT-CAX-CARTRIDGE-BASE", quantity: 340000},
  {received_date: "2019-01-25", order_id: "IM1902120", etd: "2019-02-20", item_id: "24720327M", item_name: "CT-CAX-BASE-COVER", quantity: 175000},
  {received_date: "2019-01-25", order_id: "IM1902121", etd: "2019-02-20", item_id: "24720328M", item_name: "CT-CAX-REEL", quantity: 410000},
  {received_date: "2019-01-25", order_id: "IM1902129", etd: "2019-02-20", item_id: "260501M",   item_name: "CT-PXN-HEAD-COVER-4.2MM", quantity: 55000},
  {received_date: "2019-01-25", order_id: "IM1902134", etd: "2019-02-20", item_id: "281709M",   item_name: "CT-PS-SPACER", quantity: 30000},
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

  pendingOrders: () =>                                        
    delay(300).then(() => MOCK_DB_ORDERS),

  recommend: (machineIds, file, useDb) =>
    delay(2400).then(() =>
      buildMockResult(machineIds, file ? `file:${file.name}` : "db")
    ),
};