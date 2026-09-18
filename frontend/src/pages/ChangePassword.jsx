import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext.jsx';

const HOME_BY_ROLE = {
  student: '/student',
  lecturer: '/lecturer',
  school_admin: '/admin',
  platform_admin: '/platform'
};

export default function ChangePassword() {
  const { user, setMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      setMustChangePassword(false);
      navigate(HOME_BY_ROLE[user?.role] || '/');
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-md mx-auto px-6 py-20">
        <h1 className="font-display text-3xl font-semibold mb-2">Set a new password</h1>
        <p className="text-ink/60 mb-8">Your account was created with a default password. Choose your own before continuing.</p>

        {error && <div className="mb-4 border border-clay/40 bg-clay/10 text-clay px-4 py-3 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Current (default) password</label>
            <input className="input" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={6} />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Saving...' : 'Save and continue'}</button>
        </form>
      </div>
    </div>
  );
}
