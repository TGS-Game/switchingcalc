import { useEffect, useMemo, useState } from 'react';
import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import client from '../api/client';

function titleCaseMetal(value) {
  if (!value) return '-';
  return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();
}

function titleCaseType(value) {
  if (!value) return '-';
  const normalized = String(value).toLowerCase();

  if (normalized === 'switch' || normalized === 'switch_out') return 'Switch';
  if (normalized === 'switch_pilot') return 'Switch Pilot';
  if (normalized === 'manual_switch') return 'Manual Switch';
  if (normalized === 'depot_fee' || normalized === 'storage_fee') return 'Depot Fee';
  if (normalized === 'transfer_out') return 'Transfer Out';
  if (normalized === 'transfer_in') return 'Transfer In';
  if (normalized === 'sale') return 'Sale';
  if (normalized === 'purchase') return 'Purchase';

  return String(value)
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function roundNumber(value, digits = 2) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return num.toFixed(digits);
}

function formatDisplayDate(value) {
  if (!value) return '-';

  const text = String(value).trim();
  const dateOnly = text.includes('T') ? text.split('T')[0] : text;
  const parts = dateOnly.split('-');

  if (parts.length === 3 && parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;

  const dd = String(parsed.getDate()).padStart(2, '0');
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const yyyy = String(parsed.getFullYear());

  return `${dd}-${mm}-${yyyy}`;
}

function calculateProjectedGain(currentMetal, qty, basisRatio, forecastRatio, feePercent = 3) {
  const quantity = Number(qty);
  const purchaseRatio = Number(basisRatio);
  const futureRatio = Number(forecastRatio);
  const fee = Number(feePercent);

  if (!Number.isFinite(quantity) || !Number.isFinite(purchaseRatio) || !Number.isFinite(futureRatio)) {
    return null;
  }

  if (quantity <= 0 || purchaseRatio <= 0 || futureRatio <= 0) {
    return null;
  }

  const feeMultiplier = (100 - fee) / 100;
  if (feeMultiplier <= 0) {
    return null;
  }

  let baseline;
  let projected;

  if (String(currentMetal).toLowerCase() === 'silver') {
    baseline = quantity / feeMultiplier / purchaseRatio;
    projected = quantity / futureRatio * feeMultiplier;
  } else if (String(currentMetal).toLowerCase() === 'gold') {
    baseline = quantity / feeMultiplier * purchaseRatio;
    projected = quantity * futureRatio * feeMultiplier;
  } else {
    return null;
  }

  if (!Number.isFinite(baseline) || baseline <= 0 || !Number.isFinite(projected)) {
    return null;
  }

  return ((projected - baseline) / baseline) * 100;
}

function displayHistoryMetal(step, fallbackMetal) {
  const type = String(step?.type || '').toLowerCase();
  const fromMetal = step?.from_metal ? titleCaseMetal(step.from_metal) : '';
  const toMetal = step?.to_metal ? titleCaseMetal(step.to_metal) : '';

  if (type === 'switch' && fromMetal && toMetal) {
    return `${fromMetal} -> ${toMetal}`;
  }

  return titleCaseMetal(step?.metal || fallbackMetal);
}

function formatHistoryGrams(step) {
  const type = String(step?.type || '').toLowerCase();
  const inputQty = Number(step?.allocated_source_quantity_grams);
  const outputQty = Number(step?.quantity_grams);

  if (type === 'switch' && Number.isFinite(inputQty) && Number.isFinite(outputQty)) {
    return `${roundNumber(inputQty, 5)} -> ${roundNumber(outputQty, 5)}`;
  }

  if (Number.isFinite(outputQty)) {
    return roundNumber(outputQty, 5);
  }

  return '-';
}

const historyActionButtonStyle = {
  display: 'inline-block',
  width: 'auto',
  minWidth: 0,
  padding: '5px 9px',
  fontSize: 11,
  lineHeight: 1.2,
  borderRadius: 6,
  border: '1px solid #0f172a',
  background: '#ffffff',
  color: '#0f172a',
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap'
};

const performanceActionButtonStyle = {
  ...historyActionButtonStyle,
  border: '1px solid #1d4ed8',
  background: '#1d4ed8',
  color: '#ffffff'
};

function buildPerformanceModel(row) {
  const history = [...(row.filteredHistory || [])];
  const purchasedByMetal = { gold: 0, silver: 0 };
  const latestByMetal = { gold: 0, silver: 0 };
  const runningByMetal = { gold: 0, silver: 0 };
  const contributorCodesByMetal = { gold: [], silver: [] };
  const points = [];
  const labels = history.map((step, index) => ({
    index,
    date: step?.date || '-'
  }));

  const pushUnique = (list, value) => {
    if (!value || value === '-') return;
    if (!list.includes(value)) list.push(value);
  };

  history.forEach((step, index) => {
    const type = String(step?.type || '').toLowerCase();
    const stepMetal = String(step?.metal || '').toLowerCase();
    const fromMetal = String(step?.from_metal || '').toLowerCase();
    const toMetal = String(step?.to_metal || '').toLowerCase();
    const outputQty = Number(step?.quantity_grams);
    const inputQty = Number(step?.allocated_source_quantity_grams);
    const ratioValue = Number(step?.ratio);
    const transactionCode = step?.transaction_code || step?.transaction_id || '-';

    if ((type === 'purchase' || type === 'transfer_in') && (stepMetal === 'gold' || stepMetal === 'silver') && Number.isFinite(outputQty)) {
      runningByMetal[stepMetal] += outputQty;
      latestByMetal[stepMetal] = runningByMetal[stepMetal];

      if (type === 'purchase') {
        purchasedByMetal[stepMetal] += outputQty;
      }

      pushUnique(contributorCodesByMetal[stepMetal], transactionCode);

      points.push({
        key: `${index}-${stepMetal}-${type}`,
        timeIndex: index,
        metal: stepMetal,
        value: runningByMetal[stepMetal],
        date: step?.date || '-',
        type,
        title: `${titleCaseType(type)} ${titleCaseMetal(stepMetal)}`,
        amountLabel: `${roundNumber(outputQty, 5)} g`,
        totalAmount: runningByMetal[stepMetal],
        transactionCode,
        contributorCodes: [...contributorCodesByMetal[stepMetal]].filter((code) => code && code !== transactionCode),
        ratio: Number.isFinite(ratioValue) ? ratioValue : null,
        showContributorCodes: true
      });
    }

    if ((type === 'sale' || type === 'transfer_out') && (stepMetal === 'gold' || stepMetal === 'silver') && Number.isFinite(outputQty)) {
      runningByMetal[stepMetal] = Math.max(0, runningByMetal[stepMetal] - outputQty);
      latestByMetal[stepMetal] = runningByMetal[stepMetal];

      points.push({
        key: `${index}-${stepMetal}-${type}`,
        timeIndex: index,
        metal: stepMetal,
        value: runningByMetal[stepMetal],
        date: step?.date || '-',
        type,
        title: `${titleCaseType(type)} ${titleCaseMetal(stepMetal)}`,
        amountLabel: `${roundNumber(outputQty, 5)} g`,
        totalAmount: runningByMetal[stepMetal],
        transactionCode,
        contributorCodes: [...contributorCodesByMetal[stepMetal]].filter((code) => code && code !== transactionCode),
        ratio: Number.isFinite(ratioValue) ? ratioValue : null,
        showContributorCodes: false
      });
    }

    if (
      type === 'switch' &&
      (fromMetal === 'gold' || fromMetal === 'silver') &&
      (toMetal === 'gold' || toMetal === 'silver') &&
      Number.isFinite(inputQty) &&
      Number.isFinite(outputQty)
    ) {
      const sourceBefore = runningByMetal[fromMetal];
      const sourceContributorCodes = [...contributorCodesByMetal[fromMetal]].filter((code) => code && code !== transactionCode);

      points.push({
        key: `${index}-${fromMetal}-switch-out`,
        timeIndex: index,
        metal: fromMetal,
        value: sourceBefore,
        date: step?.date || '-',
        type,
        title: `Switch ${titleCaseMetal(fromMetal)} -> ${titleCaseMetal(toMetal)}`,
        amountLabel: `${roundNumber(inputQty, 5)} g -> ${roundNumber(outputQty, 5)} g`,
        totalAmount: sourceBefore,
        transactionCode,
        contributorCodes: sourceContributorCodes,
        ratio: Number.isFinite(ratioValue) ? ratioValue : null,
        showContributorCodes: true
      });

      runningByMetal[fromMetal] = Math.max(0, runningByMetal[fromMetal] - inputQty);
      latestByMetal[fromMetal] = runningByMetal[fromMetal];

      const incomingCodes = [...contributorCodesByMetal[fromMetal]];
      pushUnique(incomingCodes, transactionCode);

      runningByMetal[toMetal] += outputQty;
      latestByMetal[toMetal] = runningByMetal[toMetal];

      contributorCodesByMetal[toMetal] = [...new Set([...(contributorCodesByMetal[toMetal] || []), ...incomingCodes])];

      points.push({
        key: `${index}-${toMetal}-switch-in`,
        timeIndex: index,
        metal: toMetal,
        value: runningByMetal[toMetal],
        date: step?.date || '-',
        type,
        title: `Switch ${titleCaseMetal(fromMetal)} -> ${titleCaseMetal(toMetal)}`,
        amountLabel: `${roundNumber(inputQty, 5)} g -> ${roundNumber(outputQty, 5)} g`,
        totalAmount: runningByMetal[toMetal],
        transactionCode,
        contributorCodes: [...contributorCodesByMetal[toMetal]].filter((code) => code && code !== transactionCode),
        ratio: Number.isFinite(ratioValue) ? ratioValue : null,
        showContributorCodes: false
      });
    }
  });

  const currentMetal = String(row?.metal || '').toLowerCase();
  const currentQty = Number(row?.quantity_grams);

  if ((currentMetal === 'gold' || currentMetal === 'silver') && Number.isFinite(currentQty)) {
    latestByMetal[currentMetal] = currentQty;
  }

  const currentPurchased = (currentMetal === 'gold' || currentMetal === 'silver')
    ? purchasedByMetal[currentMetal]
    : 0;

  const currentDelta = Number.isFinite(currentQty)
    ? currentQty - currentPurchased
    : null;

  return {
    purchasedByMetal,
    latestByMetal,
    currentMetal,
    currentQty,
    currentPurchased,
    currentDelta,
    labels,
    points
  };
}

function getNiceAxisMax(value) {
  const maxValue = Math.max(1, Number(value) || 0);
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;
  const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return Math.max(1, niceNormalized * magnitude);
}

function getRowSortValue(row, key) {
  switch (key) {
    case 'opened_on':
      return row.opened_on || '';
    case 'metal':
      return String(row.metal || '').toLowerCase();
    case 'quantity_grams':
      return Number(row.quantity_grams);
    case 'display_transaction_code':
      return String(row.display_transaction_code || '');
    case 'basis_ratio':
      return row.basis_ratio == null ? Number.NEGATIVE_INFINITY : Number(row.basis_ratio);
    case 'forecastRatio': {
      const n = Number(row.forecastRatio);
      return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
    }
    case 'projectedGain':
      return row.projectedGain == null ? Number.NEGATIVE_INFINITY : Number(row.projectedGain);
    default:
      return '';
  }
}

function compareSortValues(left, right, direction) {
  const dir = direction === 'desc' ? -1 : 1;

  const leftNumber = Number(left);
  const rightNumber = Number(right);
  const leftIsNumber = Number.isFinite(leftNumber);
  const rightIsNumber = Number.isFinite(rightNumber);

  if (leftIsNumber && rightIsNumber) {
    if (leftNumber < rightNumber) return -1 * dir;
    if (leftNumber > rightNumber) return 1 * dir;
    return 0;
  }

  const leftText = String(left || '').toLowerCase();
  const rightText = String(right || '').toLowerCase();

  if (leftText < rightText) return -1 * dir;
  if (leftText > rightText) return 1 * dir;
  return 0;
}

function getSortIndicator(sortConfig, key) {
  if (sortConfig.key !== key) return '↕';
  return sortConfig.direction === 'asc' ? '↑' : '↓';
}

const sortableHeaderButtonStyle = {
  background: 'transparent',
  border: 'none',
  padding: 0,
  margin: 0,
  font: 'inherit',
  fontWeight: 700,
  color: '#0f172a',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6
};

function PerformancePanel({ row }) {
  const [hoveredKey, setHoveredKey] = useState('');
  const model = buildPerformanceModel(row);
  const points = model.points || [];
  const labels = model.labels || [];
  const exampleJourney = 'Example journey: AG-1 -> AG-2 -> SW-4 -> AU-1 -> SW-7 -> AG-3';

  const width = 1280;
  const height = 340;
  const padLeft = 78;
  const padRight = 78;
  const padTop = 34;
  const padBottom = 70;
  const innerWidth = width - padLeft - padRight;
  const innerHeight = height - padTop - padBottom;
  const tickCount = 4;

  const goldPoints = points.filter((p) => p.metal === 'gold');
  const silverPoints = points.filter((p) => p.metal === 'silver');

  const goldMax = getNiceAxisMax(Math.max(1, ...goldPoints.map((p) => Number(p.value) || 0)));
  const silverMax = getNiceAxisMax(Math.max(1, ...silverPoints.map((p) => Number(p.value) || 0)));

  const getX = (timeIndex) => {
    if (labels.length <= 1) return padLeft + innerWidth / 2;
    return padLeft + (timeIndex * innerWidth) / (labels.length - 1);
  };

  const getYForMetal = (metal, value) => {
    const axisMax = metal === 'gold' ? goldMax : silverMax;
    const ratio = axisMax > 0 ? (Number(value) || 0) / axisMax : 0;
    return padTop + (innerHeight - (ratio * innerHeight));
  };

  const buildPolyline = (seriesPoints, metal) => {
    if (!seriesPoints.length) return '';
    return seriesPoints
      .map((p) => `${getX(p.timeIndex)},${getYForMetal(metal, p.value)}`)
      .join(' ');
  };

  const goldPolyline = buildPolyline(goldPoints, 'gold');
  const silverPolyline = buildPolyline(silverPoints, 'silver');

  const hoveredPoint = points.find((p) => p.key === hoveredKey) || null;
  const hoveredX = hoveredPoint ? getX(hoveredPoint.timeIndex) : 0;
  const hoveredY = hoveredPoint ? getYForMetal(hoveredPoint.metal, hoveredPoint.value) : 0;

  let tooltipLeft = hoveredX + 16;
  let tooltipTop = hoveredY - 12;

  if (tooltipLeft > width - 320) {
    tooltipLeft = hoveredX - 300;
  }

  if (tooltipLeft < 12) {
    tooltipLeft = 12;
  }

  if (tooltipTop < 72) {
    tooltipTop = hoveredY + 18;
  }

  const tickIndexes = Array.from({ length: tickCount + 1 }, (_, i) => i);
  const axisCaptionStyle = { fontSize: 12, fontWeight: 700, fill: '#334155' };

  return (
    <div>
      <div style={{ fontWeight: 700, marginBottom: 12 }}>Ancestry performance</div>

      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 12, color: '#1e3a8a' }}>
        <strong>Illustrative example:</strong> {exampleJourney}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginBottom: 14 }}>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Gold purchased:</strong> {roundNumber(model.purchasedByMetal.gold || 0, 5)}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Silver purchased:</strong> {roundNumber(model.purchasedByMetal.silver || 0, 5)}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Gold latest:</strong> {roundNumber(model.latestByMetal.gold || 0, 5)}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Silver latest:</strong> {roundNumber(model.latestByMetal.silver || 0, 5)}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Current lot now:</strong> {Number.isFinite(model.currentQty) ? roundNumber(model.currentQty, 5) : '-'}
        </div>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 10 }}>
          <strong>Now vs purchased ({titleCaseMetal(model.currentMetal)}):</strong> {Number.isFinite(model.currentDelta) ? roundNumber(model.currentDelta, 5) : '-'}
        </div>
      </div>

      {points.length ? (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12, width: '100%' }}>
          <div style={{ marginBottom: 8, display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 3, display: 'inline-block', background: '#475569', borderRadius: 999 }}></span>
              <span>Silver grams</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 14, height: 3, display: 'inline-block', background: '#b45309', borderRadius: 999 }}></span>
              <span>Gold grams</span>
            </div>
          </div>

          <div style={{ position: 'relative', width: '100%' }}>
            <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
              <text x={12} y={18} style={axisCaptionStyle}>Silver grams</text>
              <text x={width - 12} y={18} textAnchor="end" style={axisCaptionStyle}>Gold grams</text>

              {tickIndexes.map((tickIndex) => {
                const fraction = tickIndex / tickCount;
                const y = padTop + innerHeight - (fraction * innerHeight);
                const silverTickValue = (silverMax * tickIndex) / tickCount;
                const goldTickValue = (goldMax * tickIndex) / tickCount;

                return (
                  <g key={`grid-${tickIndex}`}>
                    <line x1={padLeft} y1={y} x2={width - padRight} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                    <text x={padLeft - 10} y={y + 4} textAnchor="end" fontSize="11" fill="#475569">
                      {roundNumber(silverTickValue, 0)}
                    </text>
                    <text x={width - padRight + 10} y={y + 4} textAnchor="start" fontSize="11" fill="#b45309">
                      {roundNumber(goldTickValue, 0)}
                    </text>
                  </g>
                );
              })}

              <line x1={padLeft} y1={padTop} x2={padLeft} y2={padTop + innerHeight} stroke="#475569" strokeWidth="1.5" />
              <line x1={width - padRight} y1={padTop} x2={width - padRight} y2={padTop + innerHeight} stroke="#b45309" strokeWidth="1.5" />
              <line x1={padLeft} y1={padTop + innerHeight} x2={width - padRight} y2={padTop + innerHeight} stroke="#000000" strokeWidth="1.5" />

              {silverPoints.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#475569"
                  strokeWidth="3"
                  points={silverPolyline}
                />
              ) : null}

              {goldPoints.length > 1 ? (
                <polyline
                  fill="none"
                  stroke="#b45309"
                  strokeWidth="3"
                  points={goldPolyline}
                />
              ) : null}

              {points.map((p) => {
                const x = getX(p.timeIndex);
                const y = getYForMetal(p.metal, p.value);
                const pointColor = p.metal === 'gold' ? '#b45309' : '#475569';

                return (
                  <g
                    key={p.key}
                    onMouseEnter={() => setHoveredKey(p.key)}
                    onMouseLeave={() => setHoveredKey('')}
                    style={{ cursor: 'pointer' }}
                  >
                    <circle cx={x} cy={y} r="5" fill={pointColor} />
                    <circle cx={x} cy={y} r="14" fill="transparent" />
                  </g>
                );
              })}

              {labels.map((label, idx) => {
                const x = getX(label.index);
                return (
                  <text
                    key={`label-${idx}`}
                    x={x}
                    y={height - 18}
                    textAnchor="end"
                    fontSize="11"
                    fill="#475569"
                    transform={`rotate(-30 ${x} ${height - 18})`}
                  >
                    {formatDisplayDate(label.date)}
                  </text>
                );
              })}
            </svg>

            {hoveredPoint ? (
              <div
                style={{
                  position: 'absolute',
                  left: tooltipLeft,
                  top: tooltipTop,
                  maxWidth: 320,
                  background: '#111827',
                  color: '#ffffff',
                  borderRadius: 8,
                  padding: '10px 12px',
                  fontSize: 12,
                  lineHeight: 1.35,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                  pointerEvents: 'none'
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{hoveredPoint.title}</div>
                <div><strong>Date:</strong> {formatDisplayDate(hoveredPoint.date)}</div>
                <div><strong>Amount:</strong> {hoveredPoint.amountLabel}</div>
                <div><strong>Code:</strong> {hoveredPoint.transactionCode}</div>

                {String(hoveredPoint.type || '').toLowerCase() === 'switch' && hoveredPoint.ratio != null ? (
                  <div><strong>Ratio:</strong> {roundNumber(hoveredPoint.ratio, 2)}</div>
                ) : null}

                {String(hoveredPoint.type || '').toLowerCase() !== 'switch' && (hoveredPoint.contributorCodes || []).length ? (
                  <div style={{ marginTop: 6 }}>
                    <div><strong>Total amount:</strong> {roundNumber(hoveredPoint.totalAmount, 5)} g</div>
                    <div><strong>Contributing codes:</strong> {hoveredPoint.contributorCodes.join(', ')}</div>
                  </div>
                ) : null}

                {String(hoveredPoint.type || '').toLowerCase() === 'switch' && hoveredPoint.showContributorCodes && (hoveredPoint.contributorCodes || []).length ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Contributing codes:</strong> {hoveredPoint.contributorCodes.join(', ')}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
          No performance points available for this ancestry yet.
        </div>
      )}
    </div>
  );
}

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [forecastRatios, setForecastRatios] = useState({});
  const [expanded, setExpanded] = useState({});
  const [performanceExpanded, setPerformanceExpanded] = useState({});
  const [showDepotFeesByLot, setShowDepotFeesByLot] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'opened_on', direction: 'desc' });
  const [showGoldOverview, setShowGoldOverview] = useState(true);
  const [showSilverOverview, setShowSilverOverview] = useState(true);

  const refresh = async () => {
    const response = await client.get('/dashboard/current-holdings-ledger');
    setRows(response.data?.holdings || []);
    setSummary(response.data?.summary || null);
  };

  useEffect(() => {
    refresh();
  }, []);

  const displayRows = useMemo(() => {
    const mappedRows = (rows || []).map((row) => {
      const forecastRatio = forecastRatios[row.lot_key] ?? '';
      const projectedGain = calculateProjectedGain(
        row.metal,
        row.quantity_grams,
        row.basis_ratio,
        forecastRatio,
        3
      );

      const depotFeeRows = (row.history || []).filter((h) =>
        ['depot_fee', 'storage_fee'].includes(String(h.type || '').toLowerCase())
      );

      const depotFeeTotal = depotFeeRows.reduce((sum, h) => {
        const n = Number(h.quantity_grams);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0);

      const showDepotFees = !!showDepotFeesByLot[row.lot_key];

      const filteredHistory = (row.history || []).filter((h) => {
        if (showDepotFees) return true;
        return !['depot_fee', 'storage_fee'].includes(String(h.type || '').toLowerCase());
      });

      const orderedHistory = [...filteredHistory];
      const hasSwitchHistory = orderedHistory.some((h) => String(h?.type || '').toLowerCase() === 'switch');

      return {
        ...row,
        forecastRatio,
        projectedGain,
        filteredHistory: orderedHistory,
        showDepotFees: false,
        depotFeeCount: 0,
        depotFeeTotal,
        holdingOriginType: hasSwitchHistory ? 'switch' : 'purchase'
      };
    });

    return mappedRows.slice().sort((left, right) => {
      const leftValue = getRowSortValue(left, sortConfig.key);
      const rightValue = getRowSortValue(right, sortConfig.key);
      return compareSortValues(leftValue, rightValue, sortConfig.direction);
    });
  }, [rows, forecastRatios, showDepotFeesByLot, sortConfig]);

  const switchRows = useMemo(() => {
    return displayRows.filter((row) => row.holdingOriginType === 'switch');
  }, [displayRows]);

  const purchaseRows = useMemo(() => {
    return displayRows.filter((row) => row.holdingOriginType !== 'switch');
  }, [displayRows]);

  const overviewSeries = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Current holdings',
        gold: showGoldOverview ? Number(summary.gold_grams || 0) : null,
        silver: showSilverOverview ? Number(summary.silver_grams || 0) : null
      }
    ];
  }, [summary, showGoldOverview, showSilverOverview]);

  const toggleExpanded = (lotKey) => {
    setExpanded((prev) => ({ ...prev, [lotKey]: !prev[lotKey] }));
  };

  const togglePerformance = (lotKey) => {
    setPerformanceExpanded((prev) => ({ ...prev, [lotKey]: !prev[lotKey] }));
  };

  const updateForecastRatio = (lotKey, value) => {
    setForecastRatios((prev) => ({ ...prev, [lotKey]: value }));
  };

  const toggleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === 'asc' ? 'desc' : 'asc'
        };
      }

      return {
        key,
        direction: 'asc'
      };
    });
  };

  const allExpanded = displayRows.length > 0 && displayRows.every((row) => !!expanded[row.lot_key]);

  const toggleAllExpanded = () => {
    if (allExpanded) {
      setExpanded({});
      return;
    }

    const next = {};
    displayRows.forEach((row) => {
      next[row.lot_key] = true;
    });
    setExpanded(next);
  };

  const renderSortableHeader = (label, key) => (
    <button
      type="button"
      onClick={() => toggleSort(key)}
      style={sortableHeaderButtonStyle}
      title={`Sort by ${label}`}
    >
      <span>{label}</span>
      <span>{getSortIndicator(sortConfig, key)}</span>
    </button>
  );

  const renderTableSection = (title, description, rowsForSection, accentColor) => (
    <div className="card" style={{ overflowX: 'auto' }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{ width: 12, height: 12, borderRadius: 999, background: accentColor, display: 'inline-block' }}></span>
          <h3 style={{ margin: 0 }}>{title}</h3>
        </div>
        <div style={{ color: '#475569', fontSize: 14 }}>{description}</div>
      </div>

      {rowsForSection.length ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Date', 'opened_on')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Metal', 'metal')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Grams', 'quantity_grams')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('ID', 'display_transaction_code')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Purchase Ratio', 'basis_ratio')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Forecast Ratio', 'forecastRatio')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>{renderSortableHeader('Projected Gain', 'projectedGain')}</th>
              <th style={{ textAlign: 'left', padding: '8px' }}>History</th>
            </tr>
          </thead>
          <tbody>
            {rowsForSection.map((row) => (
              <FragmentRow
                key={row.lot_key}
                row={row}
                expanded={!!expanded[row.lot_key]}
                performanceExpanded={!!performanceExpanded[row.lot_key]}
                onToggle={() => toggleExpanded(row.lot_key)}
                onTogglePerformance={() => togglePerformance(row.lot_key)}
                onForecastChange={(value) => updateForecastRatio(row.lot_key, value)}
              />
            ))}
          </tbody>
        </table>
      ) : (
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: 8, padding: 12 }}>
          No rows in this section yet.
        </div>
      )}
    </div>
  );

  return (
    <div className="stack">
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ marginBottom: 8 }}>Current Portfolio</h2>
            <p style={{ marginTop: 0 }}>
              This page combines the customer dashboard and current holdings view. Switched holdings and direct purchases are shown in separate sections below.
            </p>
          </div>

          <button
            type="button"
            onClick={toggleAllExpanded}
            style={historyActionButtonStyle}
          >
            {allExpanded ? 'Hide All' : 'Show All'}
          </button>
        </div>

        {summary ? (
          <div className="grid-4">
            <div><strong>Gold now:</strong> {summary.gold_grams}</div>
            <div><strong>Silver now:</strong> {summary.silver_grams}</div>
            <div><strong>Switches:</strong> {summary.switch_count}</div>
            <div><strong>Storage fees:</strong> {summary.storage_fee_grams}</div>
          </div>
        ) : null}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h2 style={{ marginBottom: 6 }}>Portfolio overview</h2>
            <div style={{ color: '#475569', fontSize: 14 }}>
              Customer-facing summary chart moved into Current Portfolio.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showGoldOverview}
                onChange={(e) => setShowGoldOverview(e.target.checked)}
              />
              <span>Gold Holdings</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={showSilverOverview}
                onChange={(e) => setShowSilverOverview(e.target.checked)}
              />
              <span>Silver Holdings</span>
            </label>
          </div>
        </div>

        {!showGoldOverview && !showSilverOverview ? (
          <div style={{ marginTop: 18, padding: 18, background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 10 }}>
            Tick Gold Holdings, Silver Holdings, or both to show the chart.
          </div>
        ) : (
          <div style={{ marginTop: 18 }}>
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={overviewSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis />
                <Tooltip />
                {showGoldOverview ? <Line type="monotone" dataKey="gold" name="Gold" stroke="#b45309" strokeWidth={3} dot={{ r: 5 }} /> : null}
                {showSilverOverview ? <Line type="monotone" dataKey="silver" name="Silver" stroke="#475569" strokeWidth={3} dot={{ r: 5 }} /> : null}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {renderTableSection(
        'Switched Holdings',
        'Lots that have passed through one or more switches are shown first so the transformed holdings are clearly separated.',
        switchRows,
        '#d97706'
      )}

      {renderTableSection(
        'Purchased Holdings',
        'Lots held directly from purchase history with no switch event in their ancestry are shown here.',
        purchaseRows,
        '#2563eb'
      )}
    </div>
  );
}

function FragmentRow({ row, expanded, performanceExpanded, onToggle, onTogglePerformance, onForecastChange }) {
  const hasPerformance = (row.filteredHistory || []).some((h) => String(h?.type || '').toLowerCase() === 'switch');

  return (
    <>
      <tr>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>{formatDisplayDate(row.opened_on)}</td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>{titleCaseMetal(row.metal)}</td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>{roundNumber(row.quantity_grams, 4)}</td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: 12 }}>
          {row.display_transaction_code || '-'}
        </td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
          {row.basis_ratio == null ? '-' : roundNumber(row.basis_ratio, 2)}
        </td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
          <input
            type="number"
            step="0.01"
            value={row.forecastRatio}
            onChange={(e) => onForecastChange(e.target.value)}
            placeholder="e.g. 70"
            style={{ width: 90, padding: '6px' }}
          />
        </td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
          {row.projectedGain == null ? '-' : `${roundNumber(row.projectedGain, 2)}%`}
        </td>
        <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <button onClick={onToggle} style={historyActionButtonStyle}>
              {expanded ? 'Hide History' : 'Show History'}
            </button>

            {hasPerformance ? (
              <button onClick={onTogglePerformance} style={performanceActionButtonStyle}>
                {performanceExpanded ? 'Hide Performance' : 'Show Performance'}
              </button>
            ) : null}
          </div>
        </td>
      </tr>

      {expanded ? (
        <tr>
          <td colSpan="8" style={{ padding: '10px 12px', background: '#e9eef5', borderTop: '1px solid #cbd5e1' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <strong>Transaction ancestry</strong>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Metal</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Ratio</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>Grams</th>
                  <th style={{ textAlign: 'left', padding: '6px' }}>ID</th>
                </tr>
              </thead>
              <tbody>
                {(row.filteredHistory || []).slice().reverse().map((h, index) => (
                  <tr key={`${row.lot_key}-${index}`}>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb' }}>{formatDisplayDate(h.date)}</td>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb' }}>{titleCaseType(h.type)}</td>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb' }}>
                      {displayHistoryMetal(h, row.metal)}
                    </td>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb' }}>
                      {h.ratio == null ? '-' : roundNumber(h.ratio, 2)}
                    </td>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb' }}>
                      {formatHistoryGrams(h)}
                    </td>
                    <td style={{ padding: '6px', borderTop: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: 12 }}>
                      {h.transaction_code || h.transaction_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}

      {performanceExpanded && hasPerformance ? (
        <tr>
          <td colSpan="8" style={{ padding: '10px 12px', background: '#f8fafc', borderTop: '1px solid #cbd5e1' }}>
            <PerformancePanel row={row} />
          </td>
        </tr>
      ) : null}
    </>
  );
}












