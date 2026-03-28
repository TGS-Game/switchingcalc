import { useEffect, useMemo, useState } from 'react';
import client from '../api/client';

const cellStyle = {
  padding: '4px 5px',
  borderBottom: '1px solid #d1d5db',
  verticalAlign: 'middle',
  fontSize: 12,
  lineHeight: 1.1
};

const inputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '3px 5px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  background: '#fff'
};

const selectStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '3px 5px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  background: '#fff'
};

const ratioStyle = {
  width: '72px',
  boxSizing: 'border-box',
  padding: '3px 5px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  background: '#fff'
};

const gramsStyle = {
  width: '88px',
  boxSizing: 'border-box',
  padding: '3px 5px',
  fontSize: 12,
  border: '1px solid #cbd5e1',
  borderRadius: 4,
  background: '#fff'
};

function titleType(value) {
  const map = {
    purchase: 'Purchase',
    transfer_in: 'Transfer In',
    transfer_out: 'Transfer Out',
    depot_fee: 'Depot Fee',
    switch: 'Switch',
    unknown: 'Unknown',
    ignored: 'Ignored'
  };
  return map[value] || value;
}

function isHiddenNoise(item) {
  const text = `${item.raw_definition || ''}`.toLowerCase().trim();
  return text.startsWith('za') || text === 'bank transfer';
}

function isAutoSelectable(item) {
  return item.suggestion_type !== 'unknown' && item.suggestion_type !== 'ignored';
}

function sortCases(rows) {
  const priority = {
    purchase: 1,
    transfer_in: 2,
    transfer_out: 3,
    depot_fee: 4,
    switch: 5,
    unknown: 6,
    ignored: 7
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
  const [infoItem, setInfoItem] = useState(null);

  const orderedCases = useMemo(() => {
    const visible = (cases || []).filter((item) => !isHiddenNoise(item));
    return sortCases(visible);
  }, [cases]);

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
    const next = {
      ...current,
      [key]: value
    };

    if (key === 'suggestion_type') {
      if (value !== 'switch') {
        next.from_metal = '';
        next.to_metal = '';
      }

      if (value !== 'switch' && value !== 'transfer_in' && value !== 'transfer_out') {
        next.to_quantity_grams = '';
      }

      if (value === 'purchase' || value === 'transfer_in' || value === 'transfer_out' || value === 'depot_fee') {
        if (!next.metal && item.metal) {
          next.metal = item.metal;
        }
      }
    }

    setDrafts((prev) => ({
      ...prev,
      [item.id]: next
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
      <div className="card" style={{ padding: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12 }}>
            <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
            <span>Select All Visible</span>
          </label>

          <button onClick={() => bulkAction('confirm')} disabled={savingId === 'bulk'}>
            {savingId === 'bulk' ? 'Working...' : 'Approve Selected'}
          </button>

          <button onClick={() => bulkAction('ignore')} disabled={savingId === 'bulk'}>
            Ignore Selected
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1200 }}>
          <thead>
            <tr style={{ background: '#e2e8f0' }}>
              <th style={cellStyle}>Tick</th>
              <th style={cellStyle}>Info</th>
              <th style={cellStyle}>Date</th>
              <th style={cellStyle}>Row</th>
              <th style={{ ...cellStyle, width: 180 }}>Definition</th>
              <th style={cellStyle}>Suggested</th>
              <th style={cellStyle}>Action</th>
              <th style={cellStyle}>Type</th>
              <th style={cellStyle}>Metal</th>
              <th style={cellStyle}>Grams</th>
              <th style={cellStyle}>From / To</th>
              <th style={cellStyle}>Received / Sent</th>
              <th style={cellStyle}>Ratio</th>
              <th style={{ ...cellStyle, width: 170 }}>Notes</th>
              <th style={cellStyle}>Approve</th>
            </tr>
          </thead>
          <tbody>
            {orderedCases.map((item) => {
              const draft = getDraft(item);
              const isSwitch = draft.suggestion_type === 'switch';
              const isTransfer = draft.suggestion_type === 'transfer_in' || draft.suggestion_type === 'transfer_out';
              const isSelected = !!selectedIds[item.id];

              return (
                <tr key={item.id} style={{ background: isSelected ? '#f8fafc' : '#ffffff' }}>
                  <td style={cellStyle}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelected(item.id)}
                    />
                  </td>

                  <td style={cellStyle}>
                    <button
                      type="button"
                      onClick={() => setInfoItem(item)}
                      title="Show raw CSV details"
                      style={{
                        padding: '2px 7px',
                        fontSize: 12,
                        borderRadius: 999,
                        border: '1px solid #94a3b8',
                        background: '#fff',
                        cursor: 'pointer'
                      }}
                    >
                      i
                    </button>
                  </td>

                  <td style={cellStyle}>{item.raw_date || '-'}</td>
                  <td style={cellStyle}>
                    {item.row_index}
                    {item.paired_row_index ? ` + ${item.paired_row_index}` : ''}
                  </td>

                  <td style={{ ...cellStyle, width: 180, maxWidth: 180 }}>
                    <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.raw_definition || '-'}
                    </div>
                  </td>

                  <td style={cellStyle}>{titleType(item.suggestion_type)}</td>

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
                      <option value="purchase">Purchase</option>
                      <option value="transfer_in">Transfer In</option>
                      <option value="transfer_out">Transfer Out</option>
                      <option value="depot_fee">Depot Fee</option>
                      <option value="switch">Switch</option>
                      <option value="unknown">Unknown</option>
                      <option value="ignored">Ignored</option>
                    </select>
                  </td>

                  <td style={cellStyle}>
                    {!isSwitch ? (
                      <select
                        value={draft.metal}
                        onChange={(e) => updateDraft(item, 'metal', e.target.value)}
                        style={selectStyle}
                      >
                        <option value="">--</option>
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                      </select>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>

                  <td style={cellStyle}>
                    <input
                      type="number"
                      step="0.000001"
                      value={draft.quantity_grams}
                      onChange={(e) => updateDraft(item, 'quantity_grams', e.target.value)}
                      style={gramsStyle}
                    />
                  </td>

                  <td style={cellStyle}>
                    {isSwitch ? (
                      <div style={{ display: 'grid', gap: 4, minWidth: 110 }}>
                        <select
                          value={draft.from_metal}
                          onChange={(e) => updateDraft(item, 'from_metal', e.target.value)}
                          style={selectStyle}
                        >
                          <option value="">From</option>
                          <option value="gold">Gold</option>
                          <option value="silver">Silver</option>
                        </select>
                        <select
                          value={draft.to_metal}
                          onChange={(e) => updateDraft(item, 'to_metal', e.target.value)}
                          style={selectStyle}
                        >
                          <option value="">To</option>
                          <option value="gold">Gold</option>
                          <option value="silver">Silver</option>
                        </select>
                      </div>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>

                  <td style={cellStyle}>
                    {isSwitch || isTransfer ? (
                      <input
                        type="number"
                        step="0.000001"
                        value={draft.to_quantity_grams}
                        onChange={(e) => updateDraft(item, 'to_quantity_grams', e.target.value)}
                        style={gramsStyle}
                        placeholder={isTransfer ? 'Grams' : ''}
                      />
                    ) : (
                      <span style={{ color: '#94a3b8' }}>-</span>
                    )}
                  </td>

                  <td style={cellStyle}>
                    <input
                      type="number"
                      step="0.01"
                      value={draft.ratio}
                      onChange={(e) => updateDraft(item, 'ratio', e.target.value)}
                      style={ratioStyle}
                    />
                  </td>

                  <td style={{ ...cellStyle, width: 170 }}>
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
                      style={{ whiteSpace: 'nowrap', padding: '4px 8px', fontSize: 12 }}
                    >
                      {savingId === item.id ? 'Saving...' : 'Approve'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {infoItem ? (
        <div
          onClick={() => setInfoItem(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            zIndex: 9999
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 720,
              background: '#fff',
              borderRadius: 12,
              padding: 18,
              boxShadow: '0 20px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Raw CSV Details</h3>
              <button onClick={() => setInfoItem(null)}>Close</button>
            </div>

            <div style={{ display: 'grid', gap: 8, fontSize: 14 }}>
              <div><strong>Date:</strong> {infoItem.raw_date || '-'}</div>
              <div><strong>Row:</strong> {infoItem.row_index}{infoItem.paired_row_index ? ` + ${infoItem.paired_row_index}` : ''}</div>
              <div><strong>Definition:</strong> {infoItem.raw_definition || '-'}</div>
              <div><strong>Amount (EUR):</strong> {infoItem.raw_amount_eur || '-'}</div>
              <div><strong>Ratio:</strong> {infoItem.raw_gold_silver_ratio || '-'}</div>
              {infoItem.paired_raw_definition ? <div><strong>Paired Row Definition:</strong> {infoItem.paired_raw_definition}</div> : null}
              <div><strong>Suggested Type:</strong> {titleType(infoItem.suggestion_type)}</div>
              <div><strong>System Notes:</strong> {infoItem.notes || '-'}</div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
