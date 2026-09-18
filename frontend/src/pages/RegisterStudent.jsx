import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import { api } from '../services/api';

const PROGRAM_TYPES = [
  { value: 'day', label: 'Day' },
  { value: 'evening', label: 'Evening' },
  { value: 'weekend', label: 'Weekend' },
  { value: 'in_service', label: 'In-service' }
];

export default function RegisterStudent() {
  const navigate = useNavigate();
  const [level, setLevel] = useState(null); // 'university' | 'secondary' — Rule 7 step 1
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!level) return;
    api.get('/platform/schools/public').then(({ schools }) => {
      setSchools(schools.filter(s => s.school_type === level));
    }).catch(() => {});
  }, [level]);

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.post('/students/register', { ...form, education_level: level });
      setSuccess('Registration submitted. Your school admin will review and approve your account — you can then log in.');
    } catch (err) {
      setError(err.data?.message || err.message);
    } finally {
      setBusy(false);
    }
  }

  if (success) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="max-w-md mx-auto px-6 py-24 text-center">
          <div className="card">
            <p className="badge-pending inline-block mb-4">Pending approval</p>
            <h1 className="font-display text-2xl font-semibold mb-3">Almost there</h1>
            <p className="text-ink/70">{success}</p>
            <Link to="/login" className="btn-primary inline-block mt-6">Go to login</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-lg mx-auto px-6 py-16">
        <h1 className="font-display text-3xl font-semibold mb-2">Student registration</h1>
        <p className="text-ink/60 mb-8">Every registration waits for admin approval before you can log in.</p>

        {!level ? (
          <div className="card">
            <p className="label mb-3">Are you a student of a secondary school or a university?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setLevel('secondary')} className="btn-secondary py-6">Secondary school</button>
              <button onClick={() => setLevel('university')} className="btn-secondary py-6">University</button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="card space-y-4">
            <button type="button" onClick={() => setLevel(null)} className="text-xs font-mono text-sky mb-2">← change level</button>

            {error && <div className="border border-clay/40 bg-clay/10 text-clay px-4 py-3 rounded-md text-sm">{error}</div>}

            <div>
              <label className="label">{level === 'university' ? 'Name of university' : 'School name'}</label>
              <select className="input" required onChange={e => update('school_id', e.target.value)} defaultValue="">
                <option value="" disabled>Select your institution</option>
                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              {schools.length === 0 && (
                <p className="text-xs text-ink/50 mt-1">No subscribed {level} institutions found yet — ask your school admin to register first.</p>
              )}
            </div>

            <div>
              <label className="label">Full names</label>
              <input className="input" required onChange={e => update('full_names', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" required onChange={e => update('email', e.target.value)} />
            </div>
            <div>
              <label className="label">Phone</label>
              <input className="input" onChange={e => update('phone', e.target.value)} />
            </div>
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" required onChange={e => update('password', e.target.value)} />
            </div>

            {level === 'university' ? (
              <>
                <div>
                  <label className="label">National ID</label>
                  <input className="input" required onChange={e => update('national_id', e.target.value)} />
                </div>
                <div>
                  <label className="label">Faculty</label>
                  <input className="input" required onChange={e => update('faculty', e.target.value)} />
                </div>
                <div>
                  <label className="label">Department</label>
                  <input className="input" required onChange={e => update('department', e.target.value)} />
                </div>
                <div>
                  <label className="label">Program</label>
                  <select className="input" required onChange={e => update('program_type', e.target.value)} defaultValue="">
                    <option value="" disabled>Select program type</option>
                    {PROGRAM_TYPES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">Trade you study</label>
                  <input className="input" required placeholder="e.g. Software Development" onChange={e => update('trade', e.target.value)} />
                </div>
                <div>
                  <label className="label">Year of study</label>
                  <input className="input" required placeholder="e.g. Year 3" onChange={e => update('year_of_study', e.target.value)} />
                </div>
              </>
            )}

            <button className="btn-primary w-full" disabled={busy}>{busy ? 'Submitting...' : 'Submit registration'}</button>
          </form>
        )}
      </div>
    </div>
  );
}
