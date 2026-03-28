import { useEffect, useState } from 'react';
import client from '../api/client';

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);

  const refresh = () => client.get('/transactions').then((r) => setRows(r.data || []));
  useEffect(() => { refresh(); }, []);

  return (
    <div className="stack">
      <div className="card">
        <h2>Confirmed ledger</h2>
        <p>This table shows only transactions that have already been confirmed into the ledger.</p>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Metal / From-To</th>
              <th>Grams</th>
              <th>Received grams</th>
              <th>Ratio</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.transaction_date}</td>
                <td>{row.type}</td>
                <td>
                  {row.type === 'switch'
                    ? `${row.from_metal || '-'} -> ${row.to_metal || '-'}`
                    : (row.metal || '-')}
                </td>
                <td>{row.quantity_grams}</td>
                <td>{row.to_quantity_grams || '-'}</td>
                <td>{row.ratio || '-'}</td>
                <td>{row.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
