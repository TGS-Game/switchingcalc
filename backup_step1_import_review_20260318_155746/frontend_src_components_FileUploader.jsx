import { useState } from 'react';
import client from '../api/client';

export default function FileUploader() {
  const [message, setMessage] = useState('');

  const onChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const { data } = await client.post('/uploads', form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    setMessage(`Uploaded. ${data.reconciliation_case_count} cases need review.`);
  };

  return (
    <div className="card">
      <input type="file" accept=".csv,.pdf" onChange={onChange} />
      {message && <p>{message}</p>}
    </div>
  );
}
