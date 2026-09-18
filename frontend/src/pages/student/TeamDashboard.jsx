import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardList, Users } from 'lucide-react';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

const initials = (name = '') => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function TeamDashboard() {
  const { id } = useParams();
  const [team, setTeam] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/teams/${id}/progress`).then(setTeam).catch(err => setError(err.data?.message || err.message));
  }, [id]);

  if (error) return <div className="p-10 text-clay">{error}</div>;
  if (!team) return <div className="p-10 font-mono text-ink/50">Loading team workspace...</div>;

  return <div className="min-h-screen"><Navbar /><main className="mx-auto max-w-5xl px-6 py-10">
    <Link to="/student" className="mb-8 inline-flex items-center gap-2 text-sm text-sky hover:underline"><ArrowLeft size={16} /> Back to dashboard</Link>
    <header className="mb-8 rounded-lg bg-ink p-8 text-parchment"><p className="mb-2 text-xs font-mono uppercase tracking-[0.18em] text-gold">Group workspace</p><h1 className="font-display text-3xl font-semibold">{team.team.name}</h1><p className="mt-2 text-parchment/60">{team.team.course_name} · created by {team.team.created_by_name}</p><div className="mt-6 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gold" style={{ width: `${team.progress_percent}%` }} /></div><span className="font-mono text-sm">{team.progress_percent}% complete</span></div></header>
    <div className="grid gap-8 md:grid-cols-[0.8fr_1.2fr]">
      <section className="card"><h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><Users size={19} className="text-sky" /> Group members</h2>{team.members.map(member => <div key={member.id} className="flex items-center gap-3 border-b border-ink/10 py-3"><span className="avatar avatar-small">{initials(member.full_names)}</span><div><p className="text-sm font-medium">{member.full_names}</p><p className="text-xs text-ink/50">{member.email}</p></div></div>)}</section>
      <section className="card"><h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold"><ClipboardList size={19} className="text-sky" /> Assignment progress</h2>{team.assignments.length === 0 && <p className="text-sm text-ink/50">No assignments have been posted for this course yet.</p>}{team.assignments.map(assignment => { const percent = assignment.team_member_count ? Math.round((assignment.submitted_count / assignment.team_member_count) * 100) : 0; return <div key={assignment.id} className="border-b border-ink/10 py-4"><div className="flex justify-between gap-3 text-sm"><span>{assignment.title}</span><span className="font-mono text-xs text-ink/50">{assignment.submitted_count}/{assignment.team_member_count} submitted</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-sky" style={{ width: `${percent}%` }} /></div><p className="mt-1 flex items-center justify-end gap-1 text-xs text-ink/45">{percent === 100 && <Check size={13} className="text-leaf" />}{percent}%</p></div>; })}</section>
    </div>
  </main></div>;
}
