import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Mail } from 'lucide-react';
import Navbar from '../components/Navbar.jsx';
import { api } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await api.post('/auth/forgot-password', { email });
      setResult(data);
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
        <h1 className="font-display text-3xl font-semibold mb-2">Forgot your password?</h1>
        <p className="text-ink/60 mb-8">Enter the email you use to log in and we'll send you a reset link.</p>

        {error && <div className="mb-4 border border-clay/40 bg-clay/10 text-clay px-4 py-3 rounded-md text-sm">{error}</div>}

        {result?.reset_token ? (
          <div className="card space-y-4">
            <p className="text-sm text-ink/70">{result.message}</p>
            <div className="border border-sky/40 bg-sky/10 text-sky px-4 py-3 rounded-md text-sm font-mono break-all">
              Reset token: {result.reset_token}
            </div>
            <p className="text-xs text-ink/50">
              This token expires in 30 minutes. Copy it and go to the reset page to choose a new password.
            </p>
            <Link to={`/reset-password?email=${encodeURIComponent(email)}`} className="btn-primary w-full block text-center">
              Continue to reset password
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40" />
                <input className="input pl-9" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
            </div>
            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Sending...' : 'Send reset link'}</button>
          </form>
        )}

        <p className="mt-6 text-sm text-ink/60">
          Remembered your password? <Link to="/login" className="text-sky font-medium inline-flex items-center gap-1"><ArrowLeft size={14} /> Back to log in</Link>
        </p>
      </div>
    </div>
  );
}
