import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

export default function AvailableCourses() {
  const [courses, setCourses] = useState([]);
  const [msg, setMsg] = useState('');

  function load() {
    api.get('/students/courses/available').then(d => setCourses(d.courses));
  }
  useEffect(load, []);

  async function join(id) {
    setMsg('');
    try {
      const res = await api.post(`/courses/${id}/join`);
      setMsg(res.message);
      load();
    } catch (err) {
      setMsg(err.data?.message || err.message);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-semibold mb-2">Courses in your school</h1>
        <p className="text-ink/60 mb-6">Click "Join" on the one you're supposed to be in — your lecturer approves the request.</p>
        {msg && <div className="mb-4 border border-sky/40 bg-sky/10 text-sky px-4 py-3 rounded-md text-sm">{msg}</div>}

        <div className="space-y-3">
          {courses.map(c => (
            <div key={c.id} className="card flex items-center justify-between">
              <div>
                <p className="font-display font-semibold">{c.name} <span className="text-ink/40 font-mono text-sm">{c.code}</span></p>
                <p className="text-ink/60 text-sm">{c.lecturer_name} {c.trade_or_program ? `· ${c.trade_or_program}` : ''}</p>
              </div>
              {c.my_request_status === 'approved' ? (
                <span className="badge-approved">Enrolled</span>
              ) : c.my_request_status === 'pending' ? (
                <span className="badge-pending">Pending approval</span>
              ) : c.my_request_status === 'rejected' ? (
                <span className="badge-rejected">Rejected</span>
              ) : (
                <button onClick={() => join(c.id)} className="btn-primary text-sm">Join</button>
              )}
            </div>
          ))}
          {courses.length === 0 && <p className="text-ink/50">No courses have been created in your school yet.</p>}
        </div>
      </div>
    </div>
  );
}
