import React, { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

const COLUMNS = [
  { key: 'todo', label: 'To do' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'done', label: 'Done' }
];

export default function Kanban() {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');

  function load() {
    api.get('/kanban').then(d => setTasks(d.tasks));
  }
  useEffect(load, []);

  async function addTask() {
    if (!title) return;
    await api.post('/kanban/tasks', { title });
    setTitle('');
    load();
  }

  async function move(taskId, status) {
    await api.patch(`/kanban/tasks/${taskId}`, { status });
    load();
  }

  async function remove(taskId) {
    await api.del(`/kanban/tasks/${taskId}`);
    load();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-5xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-semibold mb-2">Your Kanban board</h1>
        <p className="text-ink/60 mb-6">Every task, across every course, in one place.</p>

        <div className="flex gap-2 mb-8">
          <input className="input" placeholder="Add a task..." value={title} onChange={e => setTitle(e.target.value)} />
          <button className="btn-primary" onClick={addTask}>Add</button>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {COLUMNS.map(col => (
            <div key={col.key}>
              <p className="label mb-3">{col.label}</p>
              <div className="space-y-3">
                {tasks.filter(t => t.status === col.key).map(t => (
                  <div key={t.id} className="card">
                    <p className="font-body font-medium">{t.title}</p>
                    {t.course_name && <p className="text-xs text-ink/50">{t.course_name}</p>}
                    <div className="flex gap-2 mt-3 text-xs">
                      {COLUMNS.filter(c => c.key !== col.key).map(c => (
                        <button key={c.key} onClick={() => move(t.id, c.key)} className="text-sky">→ {c.label}</button>
                      ))}
                      <button onClick={() => remove(t.id)} className="text-clay ml-auto">Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
