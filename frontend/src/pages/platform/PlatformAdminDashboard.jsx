import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

export default function PlatformAdminDashboard() {
  const [schools, setSchools] = useState([]);
  const [resources, setResources] = useState([]);
  const [form, setForm] = useState({ name: '', school_type: 'university', admin_full_names: '', admin_email: '' });
  const [resourceForm, setResourceForm] = useState({ title: '', category: '', description: '', resource_url: '', file: null });
  const [createdCreds, setCreatedCreds] = useState(null);

  function load() {
    api.get('/platform/schools').then(d => setSchools(d.schools));
    api.get('/platform/resources').then(d => setResources(d.resources));
  }
  useEffect(load, []);

  async function registerSchool(e) {
    e.preventDefault();
    const res = await api.post('/platform/schools', form);
    setCreatedCreds(res.school_admin_credentials);
    setForm({ name: '', school_type: 'university', admin_full_names: '', admin_email: '' });
    load();
  }

  async function recordPayment(id) {
    await api.post(`/platform/schools/${id}/payments`, { amount: 50000 });
    load();
  }

  async function publishResource(e) {
    e.preventDefault();
    const body = new FormData();
    body.append('title', resourceForm.title);
    body.append('category', resourceForm.category);
    body.append('description', resourceForm.description);
    body.append('resource_url', resourceForm.resource_url);
    if (resourceForm.file) body.append('file', resourceForm.file);
    await api.post('/platform/resources', body, { isForm: true });
    setResourceForm({ title: '', category: '', description: '', resource_url: '', file: null });
    load();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky hover:text-ink">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <div>
          <h1 className="font-display text-3xl font-semibold mb-2">Register a school</h1>
          <p className="text-ink/60 mb-6">Sch1, Sch2, Sch3... each school gets its own admin account with a default password.</p>

          {createdCreds && (
            <div className="mb-4 border border-leaf/40 bg-leaf/10 text-leaf px-4 py-3 rounded-md text-sm font-mono">
              School admin login: {createdCreds.email} / {createdCreds.default_password}
            </div>
          )}

          <form onSubmit={registerSchool} className="card grid md:grid-cols-2 gap-3 items-end">
            <div>
              <label className="label">School name</label>
              <input className="input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="label">Type</label>
              <select className="input" value={form.school_type} onChange={e => setForm(f => ({ ...f, school_type: e.target.value }))}>
                <option value="university">University</option>
                <option value="secondary">Secondary school</option>
              </select>
            </div>
            <div>
              <label className="label">School admin full names</label>
              <input className="input" required value={form.admin_full_names} onChange={e => setForm(f => ({ ...f, admin_full_names: e.target.value }))} />
            </div>
            <div>
              <label className="label">School admin email</label>
              <input className="input" type="email" required value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} />
            </div>
            <button className="btn-primary md:col-span-2">Register school</button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold mb-2">Free student resource library</h2>
          <p className="text-ink/60 mb-6">Publish learning material for every approved student across all schools.</p>
          <form onSubmit={publishResource} className="card grid md:grid-cols-2 gap-3 items-end mb-6">
            <input className="input" placeholder="Course or resource title" required value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} />
            <input className="input" placeholder="Category, e.g. Programming" required value={resourceForm.category} onChange={e => setResourceForm(f => ({ ...f, category: e.target.value }))} />
            <textarea className="input md:col-span-2" placeholder="Description" value={resourceForm.description} onChange={e => setResourceForm(f => ({ ...f, description: e.target.value }))} />
            <input className="input" placeholder="External resource URL (optional)" type="url" value={resourceForm.resource_url} onChange={e => setResourceForm(f => ({ ...f, resource_url: e.target.value }))} />
            <input className="input" type="file" onChange={e => setResourceForm(f => ({ ...f, file: e.target.files[0] || null }))} />
            <button className="btn-primary md:col-span-2">Publish free resource</button>
          </form>
          <div className="space-y-3">
            {resources.map(resource => (
              <div key={resource.id} className="card flex justify-between gap-4">
                <div><p className="font-display font-semibold">{resource.title}</p><p className="text-xs text-ink/50">{resource.category}</p><p className="text-sm text-ink/60">{resource.description}</p></div>
                <span className="badge-approved">published</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="font-display text-2xl font-semibold mb-4">Schools & subscriptions</h2>
          <div className="space-y-3">
            {schools.map(s => (
              <div key={s.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-display font-semibold">{s.name} <span className="text-ink/40 font-mono text-xs">{s.school_type}</span></p>
                  <p className="text-xs text-ink/50">{s.active_students} students · {s.lecturer_count} lecturers · valid until {s.current_period_end}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={s.subscription_status === 'active' ? 'badge-approved' : 'badge-pending'}>{s.subscription_status}</span>
                  <button className="btn-secondary text-sm" onClick={() => recordPayment(s.id)}>Record 50,000 RWF payment</button>
                </div>
              </div>
            ))}
            {schools.length === 0 && <p className="text-ink/50">No schools registered yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
