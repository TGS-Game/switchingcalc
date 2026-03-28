import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

const cellStyle = {
  padding: '6px 8px',
  borderBottom: '1px solid #d1d5db',
  verticalAlign: 'middle',
  fontSize: 13,
  lineHeight: 1.2
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 6px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#fff'
};

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '4px 6px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 6,
  background: '#fff'
};

function isAutoSelectable(item) {
  return item.suggestion_type !== 'unknown' && item.confidence >= 0.75;
}

function sortCases(rows) {
  const priority = {
    purchase: 1,
    transfer_in: 2,
    transfer_out: 3,
    depot_fee: 4,
    switch: 5,
    ignored: 6,
    unknown: 7
  };

  return [...rows].sort((a, b) => {
    const aSelected = isAutoSelectable(a) ? 0 : 1;
    const bSelected = isAutoSelectable(b) ? 0 : 1;
    if (aSelected !== bSelected) return aSelected - bSelected;

    const aPriority = priority[a.suggestion_type] ?? 99;
    const bPriority = priority[b.suggestion_type] ?? 99;
    if (aPriority !== bPriority) return aPriority - bPriority;

    const aDate = a.raw_date || '';
    const bDate = b.raw_date || '';
    if (aDate !== bDate) return aDate.localeCompare(bDate);

    return (a.row_index || 0) - (b.row_index || 0);
  });
}

export default function ReconciliationTable({ cases, refresh }) {
  const [savingId, setSavingId] = useState('');
  const [drafts, setDrafts] = useState({});
  const [selectedIds, setSelectedIds] = useState({});

  const orderedCases = useMemo(() => sortCases(cases || []), [cases]);

  useEffect(() => {
    const nextSelected = {};
    orderedCases.forEach((item) => {
      if (isAutoSelectable(item)) {
        nextSelected[item.id] = true;
      }
    });
    setSelectedIds(nextSelected);
  }, [cases]);

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
    if (!orderedCases.length) return false;
    return orderedCases.every((item) => !!selectedIds[item.id]);
  }, [orderedCases, selectedIds]);

  const toggleSelectAll = () => {
    const next = {};
    if (!allVisibleSelected) {
      orderedCases.forEach((item) => {
        next[item.id] = true;
      });
    }
    setSelectedIds(next);
  };

  const bulkAction = async (action) => {
    const selectedItems = orderedCases.filter((item) => selectedIds[item.id]);
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

  if (!orderedCases.length) {
    return <div className="card"><p>No items currently need review.</p></div>;
  }

  return (
    <div className="stack">
      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
            <span>Select all visible</span>
          </label>

          <button onClick={() => bulkAction('confirm')} disabled={savingId === 'bulk'}>
            {savingId === 'bulk' ? 'Working...' : 'Approve selected'}
          </button>

          <button onClick={() => bulkAction('ignore')} disabled={savingId === 'bulk'}>
            Ignore selected
          </button>

          <div style={{ fontSize: 12, color: '#475569' }}>
            Auto-ticked rows are the ones the system is most confident about.
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1500 }}>
          <thead>
            <tr style={{ background: '#e2e8f0', position: 'sticky', top: 0 }}>
              <th style={cellStyle}>Tick</th>
              <th style={cellStyle}>Date</th>
              <th style={cellStyle}>Row</th>
              <th style={cellStyle}>Definition</th>
              <th style={cellStyle}>Suggested</th>
              <th style={cellStyle}>Confidence</th>
              <th style={cellStyle}>Action</th>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Metal</th>
              <th style={cellStyle}>From</th>
              <th style={cellStyle}>To</th>
              <th style={cellStyle}>Grams</th>
              <th style={cellStyle}>Recv g</th>
              <th style={cellStyle}>Ratio</th>
              <th style={cellStyle}>Notes</th>
              <th style={cellStyle}>Save</th>
            </tr>
          </thead>
          <tbody>
            {orderedCases.map((item) => {
              const draft = getDraft(item);
              const isSwitch = draft.suggestion_type === 'switch';
              const isSelected = !!selectedIds[item.id];

              return (
                <tr
                  key={item.id}
                  style={{
                    background: isSelected ? '#f8fafc' : '#ffffff'
                  }}
                >
                  <td style={cellStyle}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </td>

                  <td style={cellStyle}>{item.raw_date || '-'}</td>
                  <td style={cellStyle}>
                    {item.row_index}
                    {item.paired_row_index ? ` + ${item.paired_row_index}` : ''}
                  </td>
                  <td style={{ ...cellStyle, minWidth: 260 }}>
                    <div>{item.raw_definition || '-'}</div>
                    {item.paired_raw_definition ? (
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        Pair: {item.paired_raw_definition}
                      </div>
                    ) : null}
                  </td>
                  <td style={cellStyle}>{item.suggestion_type}</td>
                  <td style={cellStyle}>{item.confidence}</td>

                  <td style={cellStyle}>
                    <select
                      value={draft.action}
                      onChange={(e) => updateDraft(item, 'action', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="confirm">Confirm</option>
                      <option value="amend">Amend</option>
                      <option value="ignore">Ignore</option>
                      <option value="reject">Reject</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    <select
                      value={draft.suggestion_type}
                      onChange={(e) => updateDraft(item, 'suggestion_type', e.target.value)}
                      style={selectStyle}
                    >
                      <option value="purchase">purchase</option>
                      <option value="transfer_in">transfer_in</option>
                      <option value="transfer_out">transfer_out</option>
                      <option value="depot_fee">depot_fee</option>
                      <option value="switch">switch</option>
                      <option value="unknown">unknown</option>
                      <option value="ignored">ignored</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    <select
                      value={draft.metal}
                      onChange={(e) => updateDraft(item, 'metal', e.target.value)}
                      style={selectStyle}
                      disabled={isSwitch}
                    >
                      <option value="">--</option>
                      <option value="gold">gold</option>
                      <option value="silver">silver</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    <select
                      value={draft.from_metal}
                      onChange={(e) => updateDraft(item, 'from_metal', e.target.value)}
                      style={selectStyle}
                      disabled={!isSwitch}
                    >
                      <option value="">--</option>
                      <option value="gold">gold</option>
                      <option value="silver">silver</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    <select
                      value={draft.to_metal}
                      onChange={(e) => updateDraft(item, 'to_metal', e.target.value)}
                      style={selectStyle}
                      disabled={!isSwitch}
                    >
                      <option value="">--</option>
                      <option value="gold">gold</option>
                      <option value="silver">silver</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    <input
                      type="number"
                      step="0.000001"
                      value={draft.quantity_grams}
                      onChange={(e) => updateDraft(item, 'quantity_grams', e.target.value)}
                      style={inputStyle}
                    />
                  </td>

                  <td style={cellStyle}>
                    <input
                      type="number"
                      step="0.000001"
                      value={draft.to_quantity_grams}
                      onChange={(e) => updateDraft(item, 'to_quantity_grams', e.target.value)}
                      style={inputStyle}
                      disabled={!isSwitch}
                    />
                  </td>

                  <td style={cellStyle}>
                    <input
                      type="number"
                      step="0.000001"
                      value={draft.ratio}
                      onChange={(e) => updateDraft(item, 'ratio', e.target.value)}
                      style={inputStyle}
                    />
                  </td>

                  <td style={{ ...cellStyle, minWidth: 260 }}>
                    <input
                      value={draft.notes}
                      onChange={(e) => updateDraft(item, 'notes', e.target.value)}
                      style={inputStyle}
                    />
                  </td>

                  <td style={cellStyle}>
                    <button
                      onClick={() => resolve(item)}
                      disabled={savingId === item.id}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {savingId === item.id ? 'Saving...' : 'Save'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
