import { useState } from 'react';
import client from '../api/client';

export default function FileUploader() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const onChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setMessage('');

    try {
      const form = new FormData();
      form.append('file', file);

      const { data } = await client.post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setMessage(`Upload complete. ${data.suggestion_count} suggested rows are ready for review. Open the Reconciliation page next.`);
    } catch (error) {
      const apiMessage = error?.response?.data?.error || error?.message || 'Upload failed';
      setMessage(`Upload failed: ${apiMessage}`);
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  };

  return (
    <div className="card">
      <input type="file" accept=".csv" onChange={onChange} disabled={loading} />
      <p style={{ marginTop: 12 }}>
        {loading ? 'Uploading and classifying CSV...' : 'Choose a CSV export to start the review process.'}
      </p>
      {message && <p>{message}</p>}
    </div>
  );
}
