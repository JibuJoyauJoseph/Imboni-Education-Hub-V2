import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar.jsx';
import { api, API_ORIGIN } from '../../services/api';

const TABS = ['Resources', 'Assignments', 'Quizzes', 'Teams', 'Forum'];

export default function CourseView() {
  const { id } = useParams();
  const [tab, setTab] = useState('Resources');
  const [resources, setResources] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [teams, setTeams] = useState([]);
  const [threads, setThreads] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');
  const [newThreadTitle, setNewThreadTitle] = useState('');

  useEffect(() => {
    api.get(`/courses/${id}/resources`).then(d => setResources(d.resources)).catch(() => {});
    api.get(`/courses/${id}/assignments`).then(d => setAssignments(d.assignments)).catch(() => {});
    api.get(`/courses/${id}/quizzes`).then(d => setQuizzes(d.quizzes)).catch(() => {});
    api.get(`/courses/${id}/teams`).then(d => setTeams(d.teams)).catch(() => {});
    api.get(`/courses/${id}/forum/threads`).then(d => setThreads(d.threads)).catch(() => {});
  }, [id]);

  async function createTeam() {
    if (!newTeamName) return;
    await api.post(`/courses/${id}/teams`, { name: newTeamName });
    setNewTeamName('');
    api.get(`/courses/${id}/teams`).then(d => setTeams(d.teams));
  }

  async function joinTeam(teamId) {
    await api.post(`/teams/${teamId}/join`);
    api.get(`/courses/${id}/teams`).then(d => setTeams(d.teams));
  }

  async function createThread() {
    if (!newThreadTitle) return;
    await api.post(`/courses/${id}/forum/threads`, { title: newThreadTitle });
    setNewThreadTitle('');
    api.get(`/courses/${id}/forum/threads`).then(d => setThreads(d.threads));
  }

  async function submitAssignment(assignmentId, file) {
    const form = new FormData();
    if (file) form.append('file', file);
    await api.post(`/assignments/${assignmentId}/submit`, form, { isForm: true });
    alert('Submitted!');
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex gap-2 border-b border-ink/10 mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-mono uppercase tracking-wide ${tab === t ? 'border-b-2 border-sky text-ink' : 'text-ink/40'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Resources' && (
          <div className="space-y-3">
            {resources.map(r => (
              <div key={r.id} className="card">
                <p className="font-display font-semibold">{r.title}</p>
                <p className="text-sm text-ink/60 mb-2">{r.description}</p>
                {r.file_path && <a className="text-sky text-sm" href={`${API_ORIGIN}${r.file_path}`} target="_blank" rel="noreferrer">Download</a>}
              </div>
            ))}
            {resources.length === 0 && <p className="text-ink/50">No resources shared yet.</p>}
          </div>
        )}

        {tab === 'Assignments' && (
          <div className="space-y-3">
            {assignments.map(a => (
              <div key={a.id} className="card">
                <p className="font-display font-semibold">{a.title}</p>
                <p className="text-sm text-ink/60 mb-2">{a.instructions}</p>
                <p className="text-xs font-mono text-ink/40 mb-3">Due: {a.due_date ? new Date(a.due_date).toLocaleString() : 'no due date'}</p>
                <input type="file" onChange={e => submitAssignment(a.id, e.target.files[0])} className="text-sm" />
              </div>
            ))}
            {assignments.length === 0 && <p className="text-ink/50">No assignments posted yet.</p>}
          </div>
        )}

        {tab === 'Quizzes' && (
          <div className="space-y-3">
            {quizzes.map(q => (
              <div key={q.id} className="card flex justify-between items-center">
                <span className="font-display font-semibold">{q.title}</span>
                <span className="text-xs font-mono text-ink/40">{q.time_limit_minutes} min</span>
              </div>
            ))}
            {quizzes.length === 0 && <p className="text-ink/50">No quizzes yet.</p>}
          </div>
        )}

        {tab === 'Teams' && (
          <div>
            <div className="flex gap-2 mb-4">
              <input className="input" placeholder="New team name" value={newTeamName} onChange={e => setNewTeamName(e.target.value)} />
              <button className="btn-primary" onClick={createTeam}>Create</button>
            </div>
            <div className="space-y-3">
              {teams.map(t => (
                <div key={t.id} className="card flex justify-between items-center">
                  <div>
                    <p className="font-display font-semibold">{t.name}</p>
                    <p className="text-xs text-ink/50">{t.member_count} members</p>
                  </div>
                  {t.is_member ? <span className="badge-approved">Member</span> : t.my_request_status === 'pending' ? <span className="badge-pending">Pending approval</span> :
                    <button className="btn-secondary text-sm" onClick={() => joinTeam(t.id)}>Request to join</button>}
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Forum' && (
          <div>
            <div className="flex gap-2 mb-4">
              <input className="input" placeholder="Start a discussion..." value={newThreadTitle} onChange={e => setNewThreadTitle(e.target.value)} />
              <button className="btn-primary" onClick={createThread}>Post</button>
            </div>
            <div className="space-y-3">
              {threads.map(t => (
                <div key={t.id} className="card">
                  <p className="font-display font-semibold">{t.title}</p>
                  <p className="text-xs text-ink/50">by {t.created_by_name} · {t.post_count} replies</p>
                </div>
              ))}
              {threads.length === 0 && <p className="text-ink/50">No discussions yet — start one.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
