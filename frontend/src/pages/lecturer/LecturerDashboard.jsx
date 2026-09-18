import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

export default function LecturerDashboard() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: '', code: '', trade_or_program: '' });
  const [msg, setMsg] = useState('');

  function load() {
    api.get('/courses').then(d => setCourses(d.courses));
  }
  useEffect(load, []);

  async function createCourse(e) {
    e.preventDefault();
    try {
      await api.post('/courses', form);
      setForm({ name: '', code: '', trade_or_program: '' });
      setMsg('Course created.');
      load();
    } catch (err) {
      setMsg(err.data?.message || err.message);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky hover:text-ink">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <h1 className="font-display text-3xl font-semibold mb-6">Your courses</h1>

        <form onSubmit={createCourse} className="card mb-8 grid md:grid-cols-4 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="label">Course name</label>
            <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="label">Code</label>
            <input className="input" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} />
          </div>
          <div>
            <label className="label">Trade / Program</label>
            <input className="input" value={form.trade_or_program} onChange={e => setForm(f => ({ ...f, trade_or_program: e.target.value }))} />
          </div>
          <button className="btn-primary md:col-span-4">Create course</button>
        </form>
        {msg && <p className="text-sm text-sky mb-4">{msg}</p>}

        <div className="space-y-3">
          {courses.map(c => (
            <Link key={c.id} to={`/lecturer/courses/${c.id}`} className="card flex justify-between items-center hover:border-sky/50">
              <div>
                <p className="font-display font-semibold">{c.name} <span className="text-ink/40 font-mono text-sm">{c.code}</span></p>
                <p className="text-sm text-ink/60">{c.student_count} students enrolled</p>
              </div>
              <span className="text-sky text-sm">Manage →</span>
            </Link>
          ))}
          {courses.length === 0 && <p className="text-ink/50">You haven't created a course yet.</p>}
        </div>
      </div>
    </div>
  );
}
