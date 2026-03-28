import { useEffect, useState } from 'react';

const cardStyle = {
  background: '#ffffff',
  border: '1px solid #cbd5e1',
  borderRadius: 10,
  padding: 14
};

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

function formatDateTime(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

export default function SettingsPage() {
  const [profile, setProfile] = useState({ user_id: '', email: '' });
  const [emailInput, setEmailInput] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [creatingSnapshot, setCreatingSnapshot] = useState(false);
  const [restoringSnapshotId, setRestoringSnapshotId] = useState('');
  const [resettingData, setResettingData] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadProfile() {
    const data = await apiRequest('/api/account/profile');
    setProfile({
      user_id: data.user_id || '',
      email: data.email || ''
    });
    setEmailInput(data.email || '');
    localStorage.setItem('user_id', data.user_id || '');
    localStorage.setItem('user_email', data.email || '');
  }

  async function loadSnapshots() {
    setLoadingSnapshots(true);
    try {
      const data = await apiRequest('/api/account/snapshots');
      setSnapshots(data.items || []);
    } finally {
      setLoadingSnapshots(false);
    }
  }

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      await loadProfile();
      await loadSnapshots();
    } catch (err) {
      setError(err?.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function handleSaveEmail() {
    setSavingProfile(true);
    setMessage('');
    setError('');
    try {
      const data = await apiRequest('/api/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          email: emailInput
        })
      });

      setProfile((prev) => ({
        ...prev,
        email: data.email || prev.email
      }));
      localStorage.setItem('user_email', data.email || '');
      setMessage('Email updated successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to update email');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword() {
    setSavingPassword(true);
    setMessage('');
    setError('');
    try {
      await apiRequest('/api/account/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword
        })
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setMessage('Password updated successfully.');
    } catch (err) {
      setError(err?.message || 'Failed to update password');
    } finally {
      setSavingPassword(false);
    }
  }

  async function handleCreateSnapshot() {
    const reason = window.prompt('Snapshot reason', 'customer_manual_snapshot');
    if (reason === null) return;

    setCreatingSnapshot(true);
    setMessage('');
    setError('');
    try {
      const data = await apiRequest('/api/account/snapshots', {
        method: 'POST',
        body: JSON.stringify({
          reason: reason || 'customer_manual_snapshot'
        })
      });

      setMessage(`Snapshot created: ${data.id}`);
      await loadSnapshots();
    } catch (err) {
      setError(err?.message || 'Failed to create snapshot');
    } finally {
      setCreatingSnapshot(false);
    }
  }

  async function handleRestoreSnapshot(snapshotId) {
    const confirmed = window.confirm(
      'Restore this snapshot? A fresh backup snapshot will be taken first.'
    );
    if (!confirmed) return;

    setRestoringSnapshotId(snapshotId);
    setMessage('');
    setError('');
    try {
      const data = await apiRequest(`/api/account/snapshots/${snapshotId}/restore`, {
        method: 'POST'
      });

      setMessage(
        `Snapshot restored. Safety backup created: ${data.pre_restore_backup_snapshot_id || 'n/a'}`
      );
      await loadSnapshots();
    } catch (err) {
      setError(err?.message || 'Failed to restore snapshot');
    } finally {
      setRestoringSnapshotId('');
    }
  }

  async function handleResetData() {
    const confirmed = window.confirm(
      'Delete all uploaded and reconciled data for this account? A snapshot will be taken first.'
    );
    if (!confirmed) return;

    setResettingData(true);
    setMessage('');
    setError('');
    try {
      const data = await apiRequest('/api/dev/reset-data', {
        method: 'POST'
      });

      setMessage(`Data reset complete. Safety snapshot: ${data.snapshot_id || 'n/a'}`);
      await loadSnapshots();
    } catch (err) {
      setError(err?.message || 'Failed to reset data');
    } finally {
      setResettingData(false);
    }
  }

  if (loading) {
    return <div className="stack"><div className="card">Loading settings...</div></div>;
  }

  return (
    <div className="stack" style={{ padding: 14 }}>
      <div className="card">
        <h2 style={{ marginBottom: 8 }}>Settings</h2>
        <p style={{ marginTop: 0 }}>
          Account details, password changes, and restore history are managed here.
        </p>
      </div>

      {message ? (
        <div style={{
          ...cardStyle,
          background: '#ecfdf5',
          borderColor: '#a7f3d0',
          color: '#065f46'
        }}>
          {message}
        </div>
      ) : null}

      {error ? (
        <div style={{
          ...cardStyle,
          background: '#fef2f2',
          borderColor: '#fecaca',
          color: '#991b1b'
        }}>
          {error}
        </div>
      ) : null}

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Account Details</h3>

        <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <div>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 4 }}>User ID</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{profile.user_id || '-'}</div>
          </div>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Email Address</span>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>

          <div>
            <button
              type="button"
              onClick={handleSaveEmail}
              disabled={savingProfile}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#1d4ed8',
                color: 'white',
                fontWeight: 700,
                cursor: savingProfile ? 'not-allowed' : 'pointer'
              }}
            >
              {savingProfile ? 'Saving...' : 'Save Email'}
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <h3 style={{ marginTop: 0 }}>Change Password</h3>

        <div style={{ display: 'grid', gap: 10, maxWidth: 520 }}>
          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Current Password</span>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>New Password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>

          <label style={{ display: 'grid', gap: 6 }}>
            <span style={{ fontWeight: 700 }}>Confirm New Password</span>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              style={{ padding: '10px 12px', borderRadius: 8, border: '1px solid #cbd5e1' }}
            />
          </label>

          <div>
            <button
              type="button"
              onClick={handleChangePassword}
              disabled={savingPassword}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#0f766e',
                color: 'white',
                fontWeight: 700,
                cursor: savingPassword ? 'not-allowed' : 'pointer'
              }}
            >
              {savingPassword ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </div>
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <h3 style={{ marginTop: 0, marginBottom: 6 }}>Restore History</h3>
            <div style={{ color: '#475569', fontSize: 14 }}>
              Manual save points are listed here. Restore is tucked into Settings so it stays available without being front-and-center.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={loadSnapshots}
              disabled={loadingSnapshots}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontWeight: 700,
                cursor: loadingSnapshots ? 'not-allowed' : 'pointer'
              }}
            >
              {loadingSnapshots ? 'Refreshing...' : 'Refresh'}
            </button>

            <button
              type="button"
              onClick={handleCreateSnapshot}
              disabled={creatingSnapshot}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                border: 'none',
                background: '#7c3aed',
                color: 'white',
                fontWeight: 700,
                cursor: creatingSnapshot ? 'not-allowed' : 'pointer'
              }}
            >
              {creatingSnapshot ? 'Creating...' : 'Create Snapshot'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {snapshots.length ? (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Created</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Reason</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Transactions</th>
                  <th style={{ textAlign: 'left', padding: '8px' }}>Lots</th>
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
                    <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                      {snapshot.counts?.transactions ?? 0}
                    </td>
                    <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                      {snapshot.counts?.position_lots ?? 0}
                    </td>
                    <td style={{ padding: '8px', borderTop: '1px solid #e5e7eb' }}>
                      <button
                        type="button"
                        onClick={() => handleRestoreSnapshot(snapshot.id)}
                        disabled={restoringSnapshotId === snapshot.id}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          border: 'none',
                          background: '#dc2626',
                          color: 'white',
                          fontWeight: 700,
                          cursor: restoringSnapshotId === snapshot.id ? 'not-allowed' : 'pointer'
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
            <div style={{ marginTop: 12, color: '#475569' }}>
              No snapshots yet. Create one before making bigger changes if you want a restore point.
            </div>
          )}
        </div>
      </div>

      <div style={{
        ...cardStyle,
        borderColor: '#fed7aa',
        background: '#fff7ed'
      }}>
        <h3 style={{ marginTop: 0 }}>Danger Zone</h3>
        <p style={{ marginTop: 0, color: '#9a3412' }}>
          Resetting data removes uploaded and reconciled account data. A safety snapshot is created first.
        </p>

        <button
          type="button"
          onClick={handleResetData}
          disabled={resettingData}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: 'none',
            background: '#ea580c',
            color: 'white',
            fontWeight: 700,
            cursor: resettingData ? 'not-allowed' : 'pointer'
          }}
        >
          {resettingData ? 'Resetting...' : 'Reset Data'}
        </button>
      </div>
    </div>
  );
}