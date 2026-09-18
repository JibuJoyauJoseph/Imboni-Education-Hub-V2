import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const HOME_BY_ROLE = {
  student: '/student',
  lecturer: '/lecturer',
  school_admin: '/admin',
  platform_admin: '/platform'
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = await login(email, password);
      if (data.must_change_password) {
        navigate('/change-password');
      } else {
        navigate(HOME_BY_ROLE[data.user.role] || '/');
      }
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
        <h1 className="font-display text-3xl font-semibold mb-2">Log in</h1>
        <p className="text-ink/60 mb-8">Access your school's space on IMBONI.</p>

        {error && <div className="mb-4 border border-clay/40 bg-clay/10 text-clay px-4 py-3 rounded-md text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
            <div className="mt-1 text-right">
              <Link to="/forgot-password" className="text-xs font-medium text-sky hover:text-ink">Forgot password?</Link>
            </div>
          </div>
          <button className="btn-primary w-full" disabled={busy}>{busy ? 'Signing in...' : 'Log in'}</button>
        </form>

        <p className="mt-6 text-sm text-ink/60">
          New student? <Link to="/register" className="text-sky font-medium">Register here</Link> — your account will need admin approval before you can log in.
        </p>
      </div>
    </div>
  );
}
