import { useMemo, useState } from 'react';
import client from '../api/client';

export default function ReconciliationTable({ cases, refresh }) {
  const [savingId, setSavingId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState({});

  const getDraft = (item) => {
    return drafts[item.id] || {
      action: 'confirm',
      suggestion_type: item.amended_type || item.suggestion_type || '',
      metal: item.amended_metal || item.metal || '',
      from_metal: item.amended_from_metal || item.from_metal || '',
      to_metal: item.amended_to_metal || item.to_metal || '',
      quantity_grams: item.amended_quantity_grams ?? item.quantity_grams ?? '',
      to_quantity_grams: item.amended_to_quantity_grams ?? item.to_quantity_grams ?? '',
      ratio: item.amended_ratio ?? item.ratio ?? '',
      notes: item.amended_notes || item.notes || ''
    };
  };

  const updateDraft = (item, key, value) => {
    const current = getDraft(item);
    setDrafts((prev) => ({
      ...prev,
      [item.id]: {
        ...current,
        [key]: value
      }
    }));
  };

  const resolve = async (item) => {
    setSavingId(item.id);
    try {
      await client.post(`/reconciliation/${item.id}/resolve`, getDraft(item));
      await refresh();
    } finally {
      setSavingId('');
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const allVisibleSelected = useMemo(() => {
    if (!cases.length) return false;
    return cases.every((item) => !!selectedIds[item.id]);
  }, [cases, selectedIds]);

  const toggleSelectAll = () => {
    const next = {};
    if (!allVisibleSelected) {
      cases.forEach((item) => {
        next[item.id] = true;
      });
    }
    setSelectedIds(next);
  };

  const bulkAction = async (action) => {
    const selectedItems = cases.filter((item) => selectedIds[item.id]);
    if (!selectedItems.length) return;

    const payload = {
      items: selectedItems.map((item) => {
        const draft = getDraft(item);
        return {
          suggestion_id: item.id,
          action,
          suggestion_type: draft.suggestion_type,
          metal: draft.metal,
          from_metal: draft.from_metal,
          to_metal: draft.to_metal,
          quantity_grams: draft.quantity_grams,
          to_quantity_grams: draft.to_quantity_grams,
          ratio: draft.ratio,
          notes: draft.notes,
        };
      })
    };

    setSavingId('bulk');
    try {
      await client.post('/reconciliation/bulk-resolve', payload);
      setSelectedIds({});
      await refresh();
    } finally {
      setSavingId('');
    }
  };

  if (!cases.length) {
    return <div className="card"><p>No items currently need review.</p></div>;
  }

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
            <span>Select all visible</span>
          </label>

          <button onClick={() => bulkAction('confirm')} disabled={savingId === 'bulk'}>
            {savingId === 'bulk' ? 'Working...' : 'Approve selected'}
          </button>

          <button onClick={() => bulkAction('ignore')} disabled={savingId === 'bulk'}>
            Ignore selected
          </button>
        </div>
      </div>

      {cases.map((item) => {
        const draft = getDraft(item);
        const isSwitch = draft.suggestion_type === 'switch';

        return (
          <div className="card" key={item.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                checked={!!selectedIds[item.id]}
                onChange={() => toggleSelected(item.id)}
              />
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>
                Row {item.row_index}
                {item.paired_row_index ? ` + ${item.paired_row_index}` : ''}
              </h3>
            </div>

            <p><strong>Date:</strong> {item.raw_date || '-'}</p>
            <p><strong>Definition:</strong> {item.raw_definition || '-'}</p>
            {item.paired_raw_definition ? <p><strong>Paired row:</strong> {item.paired_raw_definition}</p> : null}
            <p><strong>Suggested type:</strong> {item.suggestion_type}</p>
            <p><strong>Confidence:</strong> {item.confidence}</p>

            <div className="grid-3">
              <label>
                <div>Action</div>
                <select value={draft.action} onChange={(e) => updateDraft(item, 'action', e.target.value)}>
                  <option value="confirm">Confirm</option>
                  <option value="amend">Amend</option>
                  <option value="ignore">Ignore</option>
                  <option value="reject">Reject</option>
                </select>
              </label>

              <label>
                <div>Type</div>
                <select value={draft.suggestion_type} onChange={(e) => updateDraft(item, 'suggestion_type', e.target.value)}>
                  <option value="purchase">purchase</option>
                  <option value="transfer_in">transfer_in</option>
                  <option value="transfer_out">transfer_out</option>
                  <option value="depot_fee">depot_fee</option>
                  <option value="switch">switch</option>
                  <option value="unknown">unknown</option>
                  <option value="ignored">ignored</option>
                </select>
              </label>

              {!isSwitch ? (
                <label>
                  <div>Metal</div>
                  <select value={draft.metal} onChange={(e) => updateDraft(item, 'metal', e.target.value)}>
                    <option value="">--</option>
                    <option value="gold">gold</option>
                    <option value="silver">silver</option>
                  </select>
                </label>
              ) : (
                <>
                  <label>
                    <div>From metal</div>
                    <select value={draft.from_metal} onChange={(e) => updateDraft(item, 'from_metal', e.target.value)}>
                      <option value="">--</option>
                      <option value="gold">gold</option>
                      <option value="silver">silver</option>
                    </select>
                  </label>
                  <label>
                    <div>To metal</div>
                    <select value={draft.to_metal} onChange={(e) => updateDraft(item, 'to_metal', e.target.value)}>
                      <option value="">--</option>
                      <option value="gold">gold</option>
                      <option value="silver">silver</option>
                    </select>
                  </label>
                </>
              )}

              <label>
                <div>Grams</div>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.quantity_grams}
                  onChange={(e) => updateDraft(item, 'quantity_grams', e.target.value)}
                />
              </label>

              {isSwitch ? (
                <label>
                  <div>Received grams</div>
                  <input
                    type="number"
                    step="0.000001"
                    value={draft.to_quantity_grams}
                    onChange={(e) => updateDraft(item, 'to_quantity_grams', e.target.value)}
                  />
                </label>
              ) : null}

              <label>
                <div>Ratio</div>
                <input
                  type="number"
                  step="0.000001"
                  value={draft.ratio}
                  onChange={(e) => updateDraft(item, 'ratio', e.target.value)}
                />
              </label>

              <label style={{ gridColumn: '1 / -1' }}>
                <div>Notes</div>
                <input
                  value={draft.notes}
                  onChange={(e) => updateDraft(item, 'notes', e.target.value)}
                />
              </label>
            </div>

            <button onClick={() => resolve(item)} disabled={savingId === item.id}>
              {savingId === item.id ? 'Saving...' : 'Save this row'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
