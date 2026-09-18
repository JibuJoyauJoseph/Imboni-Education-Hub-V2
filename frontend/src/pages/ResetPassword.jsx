import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { api } from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const data = await api.post('/auth/reset-password', { email, token, newPassword });
      setSuccess(data.message);
      setTimeout(() => navigate('/login'), 1500);
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
        <h1 className="font-display text-3xl font-semibold mb-2">Reset your password</h1>
        <p className="text-ink/60 mb-8">Enter the reset token you received and choose a new password.</p>

        {error && <div className="mb-4 border border-clay/40 bg-clay/10 text-clay px-4 py-3 rounded-md text-sm">{error}</div>}
        {success && <div className="mb-4 border border-leaf/40 bg-leaf/10 text-leaf px-4 py-3 rounded-md text-sm">{success}</div>}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Reset token</label>
            <div className="relative">
              <KeyRound size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
              <input className="input pl-9 font-mono" value={token} onChange={e => setToken(e.target.value)} placeholder="Paste the token here" required />
            </div>
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={6} placeholder="At least 6 characters" required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Resetting...' : 'Reset password'}</button>
        </form>

        <p className="mt-6 text-sm text-ink/60">
          <Link to="/login" className="text-sky font-medium inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
