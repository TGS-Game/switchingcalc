import { useEffect, useMemo, useState } from 'react';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: 14
};

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('token') || '';
  const headers = {
    ...(options.headers || {}),
    Authorization: `Bearer ${token}`
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  const response = await fetch(path, {
    ...options,
    headers
  });

  let data = {};
  try {
    data = await response.json();
  } catch (err) {
    data = {};
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || data.msg || `Request failed (${response.status})`);
  }

  return data;
}

export default function AdminSnapshotsPage() {
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedUser = useMemo(() => {
    return users.find((u) => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  async function loadUsers() {
    setLoadingUsers(true);
    setError('');
    try {
      const data = await apiRequest('/api/admin/users');
      setUsers(Array.isArray(data) ? data : []);
      if (!selectedUserId && Array.isArray(data) && data.length > 0) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      setError(err?.message || 'Failed to load users');
    } finally {
      setLoadingUsers(false);
    }
  }

  async function loadSnapshots(userId) {
    if (!userId) {
      setSnapshots([]);
      return;
    }

    setLoadingSnapshots(true);
    setError('');
    try {
      const data = await apiRequest(`/api/admin/users/${userId}/snapshots`);
      setSnapshots(data.items || []);
    } catch (err) {
      setError(err?.message || 'Failed to load snapshots');
    } finally {
      setLoadingSnapshots(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadSnapshots(selectedUserId);
    }
  }, [selectedUserId]);

  async function handleCreateSnapshot() {
    if (!selectedUserId) {
      setError('Select a user first.');
      return;
    }

    const reason = window.prompt('Snapshot reason', 'admin_manual_snapshot');
    if (!reason) return;

    setCreatingSnapshot(true);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest(`/api/admin/users/${selectedUserId}/snapshots`, {
        method: 'POST',
        body: JSON.stringify({
          reason,
          extra: {
            source: 'admin_ui_manual_snapshot'
          }
        })
      });

      setMessage(`Snapshot created: ${data.id}`);
      await loadSnapshots(selectedUserId);
    } catch (err) {
      setError(err?.message || 'Failed to create snapshot');
    } finally {
      setCreatingSnapshot(false);
    }
  }

  async function handleRestore(snapshotId) {
    if (!selectedUserId) {
      setError('Select a user first.');
      return;
    }

    const confirmed = window.confirm(
      'Restore this snapshot for the selected user? A backup snapshot will be created first.'
    );
    if (!confirmed) return;

    setRestoringSnapshotId(snapshotId);
    setError('');
    setMessage('');

    try {
      const data = await apiRequest(`/api/admin/snapshots/${snapshotId}/restore`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId
        })
      });

      setMessage(
        `Restore complete. Restored snapshot ${data.restored_snapshot_id}. Safety backup: ${data.pre_restore_backup_snapshot_id}.`
      );
      await loadSnapshots(selectedUserId);
    } catch (err) {
      setError(err?.message || 'Failed to restore snapshot');
    } finally {
      setRestoringSnapshotId('');
    }
  }

  return (
    <div className="stack" style={{ padding: 14 }}>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Snapshot History</h2>
        <p style={{ marginTop: 0 }}>
          Phase 1 restore workflow: create manual snapshots, inspect restore points, and restore a user with an automatic backup taken first.
        </p>
      </div>

      <div style={{ ...cardStyle, display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
          <label style={{ display: 'grid', gap: 6, minWidth: 280 }}>
            <span style={{ fontWeight: 700 }}>User</span>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email} ({user.role})
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={loadUsers}
            disabled={loadingUsers}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#1d4ed8',
              color: 'white',
              fontWeight: 700,
              cursor: loadingUsers ? 'not-allowed' : 'pointer'
            }}
          >
            {loadingUsers ? 'Refreshing Users...' : 'Refresh Users'}
          </button>

          <button
            type="button"
            onClick={handleCreateSnapshot}
            disabled={creatingSnapshot || !selectedUserId}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: 'none',
              background: '#7c3aed',
              color: 'white',
              fontWeight: 700,
              cursor: creatingSnapshot || !selectedUserId ? 'not-allowed' : 'pointer'
            }}
          >
            {creatingSnapshot ? 'Creating Snapshot...' : 'Create Manual Snapshot'}
          </button>
        </div>

        {selectedUser ? (
          <div style={{ color: '#334155', fontSize: 14 }}>
            Selected user: <strong>{selectedUser.email}</strong> ({selectedUser.role})
          </div>
        ) : null}

        {message ? (
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            borderRadius: 8,
            padding: '10px 12px'
          }}>
            {message}
          </div>
        ) : null}

        {error ? (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            borderRadius: 8,
            padding: '10px 12px'
          }}>
            {error}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>Available snapshots</h3>

        {loadingSnapshots ? (
          <div>Loading snapshots...</div>
        ) : snapshots.length ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Reason</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Actor</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Transactions</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Lots</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Allocations</th>
                <th style={{ textAlign: 'left', padding: '8px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snapshot) => (
                <tr key={snapshot.id}>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    {formatDateTime(snapshot.created_at || snapshot.captured_at)}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    {snapshot.reason || '-'}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb', fontFamily: 'monospace', fontSize: 12 }}>
                    {snapshot.actor_user_id || '-'}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    {snapshot.counts?.transactions ?? 0}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    {snapshot.counts?.position_lots ?? 0}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    {snapshot.counts?.lot_allocations ?? 0}
                  </td>
                  <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                    <button
                      type="button"
                      onClick={() => handleRestore(snapshot.id)}
                      disabled={restoringSnapshotId === snapshot.id || !selectedUserId}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: 'none',
                        background: '#dc2626',
                        color: 'white',
                        fontWeight: 700,
                        cursor: restoringSnapshotId === snapshot.id || !selectedUserId ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {restoringSnapshotId === snapshot.id ? 'Restoring...' : 'Restore'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div>No snapshots found for the selected user.</div>
        )}
      </div>
    </div>
  );
}