import { useState } from 'react';
import client from '../api/client';

export default function ReconciliationTable({ cases, refresh }) {
  const [drafts, setDrafts] = useState({});

  const updateDraft = (caseId, index, key, value) => {
    const next = structuredClone(drafts[caseId] || {});
    next.allocations = next.allocations || [];
    next.allocations[index] = next.allocations[index] || {};
    next.allocations[index][key] = value;
    setDrafts((prev) => ({ ...prev, [caseId]: next }));
  };

  const resolve = async (item) => {
    const payload = drafts[item.id] || { allocations: item.suggested_allocations };
    await client.post(`/reconciliation/${item.id}/resolve`, payload);
    refresh();
  };

  return (
    <div className="stack">
      {cases.map((item) => (
        <div className="card" key={item.id}>
          <h3>Case {item.id.slice(0, 8)}</h3>
          <p>Status: {item.status}</p>
          <table>
            <thead>
              <tr>
                <th>Source lot</th>
                <th>Allocated grams</th>
              </tr>
            </thead>
            <tbody>
              {(drafts[item.id]?.allocations || item.suggested_allocations || []).map((alloc, index) => (
                <tr key={index}>
                  <td>
                    <input
                      value={alloc.source_lot_id}
                      onChange={(e) => updateDraft(item.id, index, 'source_lot_id', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      step="0.000001"
                      value={alloc.allocated_quantity_grams}
                      onChange={(e) => updateDraft(item.id, index, 'allocated_quantity_grams', e.target.value)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={() => resolve(item)}>Confirm allocation</button>
        </div>
      ))}
    </div>
  );
}
