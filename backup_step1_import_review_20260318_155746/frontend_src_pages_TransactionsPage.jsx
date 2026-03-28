import { useEffect, useState } from 'react';
import client from '../api/client';

const initialForm = {
  transaction_date: '',
  type: 'purchase',
  metal: 'gold',
  quantity_grams: '',
  ratio: '',
  notes: ''
};

export default function TransactionsPage() {
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(initialForm);

  const refresh = () => client.get('/transactions').then((r) => setRows(r.data));
  useEffect(() => { refresh(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    await client.post('/transactions', form);
    setForm(initialForm);
    refresh();
  };

  return (
    <div className="stack">
      <div className="card">
        <h2>Add transaction</h2>
        <form className="grid-3" onSubmit={submit}>
          <input value={form.transaction_date} type="date" onChange={(e) => setForm({ ...form, transaction_date: e.target.value })} />
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="purchase">Purchase</option>
            <option value="switch_in">Switch in</option>
            <option value="sale">Sale</option>
            <option value="storage_fee">Storage fee</option>
            <option value="adjustment">Adjustment</option>
          </select>
          <select value={form.metal} onChange={(e) => setForm({ ...form, metal: e.target.value })}>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
          </select>
          <input placeholder="Quantity grams" value={form.quantity_grams} onChange={(e) => setForm({ ...form, quantity_grams: e.target.value })} />
          <input placeholder="Ratio" value={form.ratio} onChange={(e) => setForm({ ...form, ratio: e.target.value })} />
          <input placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <button type="submit">Save</button>
        </form>
      </div>
      <div className="card">
        <h2>Transactions</h2>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Metal</th><th>Grams</th><th>Ratio</th></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.transaction_date}</td>
                <td>{row.type}</td>
                <td>{row.metal}</td>
                <td>{row.quantity_grams}</td>
                <td>{row.ratio || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
