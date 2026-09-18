import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

export default function SchoolAdminDashboard() {
  const [pending, setPending] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ role: 'lecturer', full_names: '', email: '' });
  const [createdCreds, setCreatedCreds] = useState(null);

  function loadPending() { api.get('/admin/students/pending').then(d => setPending(d.pending_students)); }
  function loadUsers() { api.get('/admin/users').then(d => setUsers(d.users)); }
  useEffect(() => { loadPending(); loadUsers(); }, []);

  async function decide(id, decision) {
    await api.patch(`/admin/students/${id}/approve`, { decision });
    loadPending(); loadUsers();
  }

  async function createUser(e) {
    e.preventDefault();
    const res = await api.post('/admin/users', form);
    setCreatedCreds(res.credentials);
    setForm({ role: 'lecturer', full_names: '', email: '' });
    loadUsers();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky hover:text-ink">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold mb-6">Pending student approvals</h1>
          <div className="space-y-3">
            {pending.map(s => (
              <div key={s.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-display font-semibold">{s.full_names}</p>
                  <p className="text-xs text-ink/50">
                    {s.education_level === 'university'
                      ? `${s.faculty} · ${s.department} · ${s.program_type}`
                      : `${s.trade} · ${s.year_of_study}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button className="btn-primary text-sm" onClick={() => decide(s.id, 'approved')}>Approve</button>
                  <button className="btn-secondary text-sm" onClick={() => decide(s.id, 'rejected')}>Reject</button>
                </div>
              </div>
            ))}
            {pending.length === 0 && <p className="text-ink/50">No pending registrations.</p>}
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold mb-4">Add a lecturer or student directly</h2>
          {createdCreds && (
            <div className="mb-4 border border-leaf/40 bg-leaf/10 text-leaf px-4 py-3 rounded-md text-sm font-mono">
              Share these with the owner — they'll be asked to change it on first login:<br />
              {createdCreds.email} / {createdCreds.default_password}
            </div>
          )}
          <form onSubmit={createUser} className="card grid md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="label">Role</label>
              <select className="input" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
                <option value="lecturer">Lecturer</option>
                <option value="student">Student</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Full names</label>
              <input className="input" required value={form.full_names} onChange={e => setForm(f => ({ ...f, full_names: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <button className="btn-primary md:col-span-4">Create account</button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold mb-4">School roster</h2>
          <table className="w-full text-sm card">
            <thead><tr className="text-left text-ink/50 font-mono text-xs uppercase"><th className="pb-2">Name</th><th>Role</th><th>Status</th><th>Password</th></tr></thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-ink/10">
                  <td className="py-2">{u.full_names}</td>
                  <td className="text-ink/60">{u.role}</td>
                  <td><span className={u.approval_status === 'approved' ? 'badge-approved' : u.approval_status === 'pending' ? 'badge-pending' : 'badge-rejected'}>{u.approval_status}</span></td>
                  <td className="text-ink/50 text-xs">{u.is_default_password ? 'default (not changed)' : 'changed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
