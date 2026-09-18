import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  ClipboardList,
  Clock,
  Code2,
  FileText,
  GitCommitHorizontal,
  GitPullRequest,
  GraduationCap,
  GripVertical,
  MessageSquare,
  Plus,
  Sparkles,
  Target,
  Trophy,
  Users
} from 'lucide-react';
import Navbar from '../../components/Navbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { api } from '../../services/api';

const COLUMNS = [
  { key: 'backlog', label: 'Backlog', tone: 'text-ink/50' },
  { key: 'doing', label: 'In progress', tone: 'text-sky' },
  { key: 'review', label: 'In review', tone: 'text-gold' },
  { key: 'done', label: 'Done', tone: 'text-leaf' }
];

const initials = (name = '') => name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase() || '?';
const asDate = value => (value ? new Date(value) : null);
const formatDate = value => {
  const date = asDate(value);
  return date ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date';
};
const formatDateTime = value => {
  const date = asDate(value);
  return date ? date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No date';
};
const clampPercent = value => Math.max(0, Math.min(100, Number(value) || 0));

function dueStatus(dueDate) {
  const date = asDate(dueDate);
  if (!date) return { label: 'Flexible', className: 'badge-approved' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.ceil((due - today) / 86400000);
  if (days < 0) return { label: 'Overdue', className: 'badge-rejected' };
  if (days === 0) return { label: 'Due today', className: 'badge-pending' };
  if (days <= 3) return { label: `${days} day${days === 1 ? '' : 's'} left`, className: 'badge-pending' };
  return { label: `${days} days left`, className: 'badge-approved' };
}

function EmptyState({ title, body, action }) {
  return (
    <div className="rounded-md border border-dashed border-ink/15 bg-parchment/60 p-5">
      <p className="font-display font-semibold">{title}</p>
      <p className="mt-1 text-sm text-ink/55">{body}</p>
      {action}
    </div>
  );
}

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [resources, setResources] = useState([]);
  const [workspace, setWorkspace] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('board');
  const [dragged, setDragged] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: '', description: '' });
  const [taskTitle, setTaskTitle] = useState('');
  const [milestone, setMilestone] = useState({ title: '', due_date: '', progress: 0 });
  const [review, setReview] = useState({ title: '', description: '' });
  const [comment, setComment] = useState({ reviewId: '', body: '', file_path: '', line_number: '' });
  const [commit, setCommit] = useState({ message: '', branch: 'main' });
  const [wiki, setWiki] = useState({ title: '', body: '' });
  const [member, setMember] = useState({ user_id: '', role: 'member' });
  const [teamName, setTeamName] = useState('');
  const [teamCourseId, setTeamCourseId] = useState('');
  const navigate = useNavigate();

  const upcomingAssignments = useMemo(() => {
    if (!data) return [];
    return [...data.pending_assignments].sort((a, b) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date) - new Date(b.due_date);
    });
  }, [data]);

  const averageGrade = useMemo(() => {
    if (!data?.recent_grades?.length) return null;
    const grades = data.recent_grades
      .filter(item => item.score !== null && item.max_score)
      .map(item => (Number(item.score) / Number(item.max_score)) * 100);
    if (!grades.length) return null;
    return Math.round(grades.reduce((total, grade) => total + grade, 0) / grades.length);
  }, [data]);

  const workspaceProgress = useMemo(() => {
    if (!workspace?.tasks?.length) return 0;
    return Math.round((workspace.tasks.filter(task => task.status === 'done').length / workspace.tasks.length) * 100);
  }, [workspace]);

  const urgentAssignments = upcomingAssignments.filter(item => ['Overdue', 'Due today'].includes(dueStatus(item.due_date).label));
  const pendingCourseRequests = data?.pending_join_requests || [];
  const focusItems = [
    urgentAssignments.length ? `${urgentAssignments.length} urgent assignment${urgentAssignments.length === 1 ? '' : 's'} need attention` : null,
    upcomingAssignments[0] ? `Next deadline: ${upcomingAssignments[0].title}` : null,
    pendingCourseRequests.length ? `${pendingCourseRequests.length} course request${pendingCourseRequests.length === 1 ? '' : 's'} awaiting approval` : null,
    workspace ? `${workspaceProgress}% of active workspace tasks are done` : 'Create a project workspace for portfolio work'
  ].filter(Boolean).slice(0, 4);

  async function loadWorkspace(projectId) {
    try {
      const result = await api.get(`/projects/dashboard${projectId ? `?project_id=${projectId}` : ''}`);
      setWorkspace(result);
    } catch (err) {
      if (err.status !== 404) setError(err.data?.message || err.message);
      setWorkspace(null);
    }
  }

  async function refreshDashboard() {
    const result = await api.get('/students/me/dashboard');
    setData(result);
  }

  useEffect(() => {
    api.get('/students/me/dashboard').then(setData).catch(err => setError(err.data?.message || err.message));
    api.get('/platform-resources').then(result => setResources(result.resources)).catch(() => {});
    api.get('/projects').then(result => {
      const latestProject = result.projects[0];
      if (latestProject) loadWorkspace(latestProject.id);
    }).catch(err => setError(err.data?.message || err.message));
  }, []);

  async function createProject(event) {
    event.preventDefault();
    if (!projectForm.name.trim()) return;
    const result = await api.post('/projects', projectForm);
    setProjectForm({ name: '', description: '' });
    await loadWorkspace(result.project_id);
  }

  async function addTask(event) {
    event.preventDefault();
    if (!taskTitle.trim() || !workspace) return;
    await api.post(`/projects/${workspace.project.id}/tasks`, { title: taskTitle.trim() });
    setTaskTitle('');
    await loadWorkspace(workspace.project.id);
  }

  async function moveTask(status) {
    if (!dragged || !workspace) return;
    await api.patch(`/projects/${workspace.project.id}/tasks/${dragged}`, { status });
    setDragged(null);
    await loadWorkspace(workspace.project.id);
  }

  async function createTeam(event) {
    event.preventDefault();
    if (!teamName.trim() || !teamCourseId) return;
    await api.post(`/courses/${teamCourseId}/teams`, { name: teamName.trim() });
    setTeamName('');
    setTeamCourseId('');
    await refreshDashboard();
  }

  async function requestToJoin(teamId) {
    await api.post(`/teams/${teamId}/join`);
    await refreshDashboard();
  }

  async function decideTeamRequest(requestId, teamId, status) {
    await api.patch(`/teams/${teamId}/join-requests/${requestId}`, { status });
    await refreshDashboard();
  }

  async function submit(path, body, reset) {
    if (!workspace) return;
    await api.post(`/projects/${workspace.project.id}/${path}`, body);
    reset();
    await loadWorkspace(workspace.project.id);
  }

  if (error) return <div className="p-10 text-clay">{error}</div>;
  if (!data) return <div className="p-10 font-mono text-ink/50">Loading your dashboard...</div>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-sky hover:text-ink">
          <ArrowLeft size={16} /> Back to Home
        </Link>
        <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="label">Student home</p>
            <h1 className="font-display text-3xl font-semibold">Welcome back{user?.full_names ? `, ${user.full_names.split(' ')[0]}` : ''}</h1>
            <p className="mt-2 max-w-2xl text-sm text-ink/60">Track deadlines, grades, teams, learning resources, and project work from one place.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/student/courses/available" className="btn-secondary text-sm">Browse courses</Link>
            <Link to="/student/kanban" className="btn-secondary text-sm">Kanban board</Link>
            <Link to="/student/ai-tutor" className="btn-primary text-sm">AI Tutor</Link>
          </div>
        </header>

        <section className="mb-8 grid gap-4 md:grid-cols-4">
          <div className="card"><p className="label">Courses</p><p className="font-display text-3xl font-semibold">{data.courses.length}</p><p className="mt-1 text-xs text-ink/50">Active enrollments</p></div>
          <div className="card"><p className="label">Pending work</p><p className="font-display text-3xl font-semibold">{data.pending_assignments.length}</p><p className="mt-1 text-xs text-ink/50">{urgentAssignments.length} urgent</p></div>
          <div className="card"><p className="label">Average grade</p><p className="font-display text-3xl font-semibold">{averageGrade === null ? '--' : `${averageGrade}%`}</p><p className="mt-1 text-xs text-ink/50">Recent graded submissions</p></div>
          <div className="card"><p className="label">Workspace</p><p className="font-display text-3xl font-semibold">{workspace ? `${workspaceProgress}%` : '--'}</p><p className="mt-1 text-xs text-ink/50">Project completion</p></div>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="card">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2"><CalendarClock size={18} className="text-clay" /><h2 className="font-display text-xl font-semibold">Upcoming assignments</h2></div>
              <span className="text-xs font-mono uppercase text-ink/45">{upcomingAssignments.length} open</span>
            </div>
            {upcomingAssignments.length === 0 ? (
              <EmptyState title="No pending assignments" body="You are clear for now. Browse course materials or practice with the AI tutor." action={<Link to="/student/ai-tutor" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky">Start practice <ArrowRight size={15} /></Link>} />
            ) : (
              <div className="space-y-3">
                {upcomingAssignments.slice(0, 5).map(assignment => {
                  const status = dueStatus(assignment.due_date);
                  return (
                    <Link key={assignment.id} to={`/student/courses/${assignment.course_id || ''}`} className="flex flex-col gap-3 rounded-md border border-ink/10 p-4 transition-colors hover:border-sky/40 hover:bg-parchment md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="font-medium">{assignment.title}</p>
                        <p className="mt-1 text-xs text-ink/50">{assignment.course_name} - {formatDateTime(assignment.due_date)}</p>
                      </div>
                      <span className={status.className}>{status.label}</span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="mb-5 flex items-center gap-2"><Target size={18} className="text-sky" /><h2 className="font-display text-xl font-semibold">This week</h2></div>
            <div className="space-y-3">
              {focusItems.map(item => <div key={item} className="flex gap-3 rounded-md bg-parchment p-3 text-sm"><Sparkles size={16} className="mt-0.5 shrink-0 text-gold" /><span>{item}</span></div>)}
            </div>
            {pendingCourseRequests.length > 0 && (
              <div className="mt-5 border-t border-ink/10 pt-4">
                <p className="label">Course requests</p>
                {pendingCourseRequests.map(request => <p key={request.id} className="mt-2 flex items-center justify-between gap-3 text-sm"><span>{request.course_name}</span><span className="badge-pending">pending</span></p>)}
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-8 md:grid-cols-2">
          <section className="card">
            <div className="mb-5 flex items-center gap-2"><Trophy size={18} className="text-gold" /><h2 className="font-display text-xl font-semibold">Recent grades</h2></div>
            {data.recent_grades.length === 0 ? <p className="text-sm text-ink/50">No graded submissions yet.</p> : (
              <div className="space-y-3">
                {data.recent_grades.slice(0, 6).map((grade, index) => {
                  const percent = grade.max_score ? Math.round((Number(grade.score) / Number(grade.max_score)) * 100) : 0;
                  return (
                    <div key={`${grade.title}-${index}`} className="rounded-md border border-ink/10 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-medium">{grade.title}</p><p className="text-xs text-ink/50">{grade.course_name} - graded {formatDate(grade.graded_at)}</p></div>
                        <span className="font-display text-lg font-semibold">{grade.score}/{grade.max_score}</span>
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-leaf" style={{ width: `${clampPercent(percent)}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card">
            <div className="mb-5 flex items-center gap-2"><GraduationCap size={18} className="text-sky" /><h2 className="font-display text-xl font-semibold">Your courses</h2></div>
            {data.courses.length === 0 ? (
              <EmptyState title="You are not enrolled yet" body="Find courses from your school and request access." action={<Link to="/student/courses/available" className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky">Browse courses <ArrowRight size={15} /></Link>} />
            ) : (
              <div className="space-y-3">
                {data.courses.map(course => {
                  const openCount = data.pending_assignments.filter(item => item.course_name === course.name).length;
                  return (
                    <Link key={course.id} to={`/student/courses/${course.id}`} className="block rounded-md border border-ink/10 p-4 transition-colors hover:border-sky/40 hover:bg-parchment">
                      <div className="flex items-start justify-between gap-3">
                        <div><p className="font-display font-semibold">{course.name}</p><p className="mt-1 text-xs text-ink/50">{course.code || 'No code'} - {course.lecturer_name}</p></div>
                        <span className={openCount ? 'badge-pending' : 'badge-approved'}>{openCount ? `${openCount} open` : 'clear'}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          <section className="card md:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-2"><BookOpen size={18} className="text-sky" /><h2 className="font-display text-xl font-semibold">Free IT learning library</h2></div>
              <Link to="/free-courses" className="text-sm font-semibold text-sky">Explore all</Link>
            </div>
            {resources.length === 0 && <p className="text-sm text-ink/50">No platform resources have been published yet.</p>}
            <div className="grid gap-3 md:grid-cols-3">{resources.slice(0, 6).map(resource => <article key={resource.id} className="rounded-md border border-ink/10 p-3"><p className="text-xs font-mono uppercase text-sky">{resource.category}</p><p className="font-display font-semibold">{resource.title}</p><p className="mt-1 text-sm text-ink/60">{resource.description}</p></article>)}</div>
          </section>

          {!workspace ? (
            <section className="card border-l-4 border-gold md:col-span-2">
              <p className="label">Project workspace</p>
              <h2 className="font-display text-2xl font-semibold">Start with your own project</h2>
              <p className="mt-1 text-sm text-ink/60">Create a portfolio workspace for tasks, milestones, code reviews, files, and documentation.</p>
              <form onSubmit={createProject} className="mt-5 grid gap-3 md:grid-cols-[1fr_1.5fr_auto] md:items-end">
                <label className="text-sm font-medium">Project name<input className="input mt-1" value={projectForm.name} onChange={event => setProjectForm({ ...projectForm, name: event.target.value })} required /></label>
                <label className="text-sm font-medium">Description<input className="input mt-1" value={projectForm.description} onChange={event => setProjectForm({ ...projectForm, description: event.target.value })} /></label>
                <button className="btn-primary" type="submit"><Plus size={16} /> Create project</button>
              </form>
            </section>
          ) : (
            <section className="project-studio md:col-span-2">
              <header className="flex flex-col gap-5 border-b border-white/10 p-6 md:flex-row md:items-start md:justify-between">
                <div><div className="mb-2 flex items-center gap-2 text-xs font-mono uppercase tracking-[0.18em] text-gold"><span className="h-2 w-2 rounded-full bg-leaf" /> Active workspace</div><h2 className="font-display text-2xl font-semibold text-parchment">{workspace.project.name}</h2><p className="mt-1 max-w-xl text-sm text-parchment/60">{workspace.project.description || 'Your shared project workspace.'}</p></div>
                <div className="flex items-center gap-3 text-sm text-parchment/70"><span className="flex -space-x-2">{workspace.members.slice(0, 3).map(item => <span key={item.user_id} className="avatar">{initials(item.full_names)}</span>)}</span><span>{workspace.members.length} collaborator{workspace.members.length === 1 ? '' : 's'}</span></div>
              </header>
              <nav className="flex gap-6 overflow-x-auto border-b border-white/10 px-6">{[['board', 'Sprint board', Code2], ['review', 'Code review', GitPullRequest], ['files', 'Files & wiki', FileText]].map(([key, label, Icon]) => <button key={key} className={`studio-tab ${tab === key ? 'studio-tab-active' : ''}`} onClick={() => setTab(key)}><Icon size={16} />{label}</button>)}</nav>
              {tab === 'board' && <div className="p-6"><div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between"><div><p className="label !text-parchment/50">Sprint board</p><p className="text-sm text-parchment/60">{workspace.tasks.filter(task => task.status === 'done').length} of {workspace.tasks.length} tasks complete</p></div><form onSubmit={addTask} className="flex gap-2"><input className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-parchment" placeholder="New task" value={taskTitle} onChange={event => setTaskTitle(event.target.value)} /><button className="btn-studio" type="submit"><Plus size={15} /> Add task</button></form></div><div className="grid gap-4 overflow-x-auto pb-2 md:grid-cols-4">{COLUMNS.map(column => <div key={column.key} className="min-w-[210px]" onDragOver={event => event.preventDefault()} onDrop={() => moveTask(column.key)}><div className="mb-3 flex justify-between"><span className={`text-xs font-mono uppercase tracking-wide ${column.tone}`}>{column.label}</span><span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-parchment/50">{workspace.tasks.filter(task => task.status === column.key).length}</span></div><div className="min-h-[150px] space-y-3 rounded-md bg-white/[0.04] p-2">{workspace.tasks.filter(task => task.status === column.key).map(task => <article key={task.id} draggable onDragStart={() => setDragged(task.id)} className="task-tile cursor-grab"><div className="flex items-start gap-2"><GripVertical size={15} className="shrink-0 text-parchment/25" /><p className="text-sm font-medium text-parchment">{task.title}</p></div><div className="mt-3 flex justify-between text-[11px] text-parchment/45"><span>{task.priority}</span>{task.assignee_name && <span>{initials(task.assignee_name)}</span>}</div>{task.status === 'done' && <Check size={15} className="mt-3 text-leaf" />}</article>)}{workspace.tasks.filter(task => task.status === column.key).length === 0 && <p className="p-3 text-xs text-parchment/30">No tasks</p>}</div></div>)}</div><div className="mt-6 border-t border-white/10 pt-5"><p className="mb-3 text-xs font-mono uppercase text-parchment/50">Add milestone</p><form onSubmit={event => submit('milestones', milestone, () => setMilestone({ title: '', due_date: '', progress: 0 }))} className="grid gap-2 md:grid-cols-[1fr_150px_100px_auto]"><input className="input" placeholder="Milestone title" value={milestone.title} onChange={event => setMilestone({ ...milestone, title: event.target.value })} required /><input className="input" type="date" value={milestone.due_date} onChange={event => setMilestone({ ...milestone, due_date: event.target.value })} /><input className="input" type="number" min="0" max="100" value={milestone.progress} onChange={event => setMilestone({ ...milestone, progress: event.target.value })} /><button className="btn-studio" type="submit">Save</button></form>{workspace.milestones.map(item => <div key={item.id} className="mt-4"><div className="mb-1 flex justify-between text-xs text-parchment/70"><span>{item.title}</span><span>{item.progress}% {item.due_date || ''}</span></div><div className="progress-track"><div className="progress-fill" style={{ width: `${clampPercent(item.progress)}%` }} /></div></div>)}</div></div>}
              {tab === 'review' && <div className="grid gap-6 p-6 md:grid-cols-2"><div><h3 className="mb-4 flex items-center gap-2 font-display text-xl text-parchment"><GitPullRequest size={18} className="text-leaf" />Code reviews</h3><form onSubmit={event => submit('reviews', review, () => setReview({ title: '', description: '' }))} className="mb-5 space-y-2"><input className="input" placeholder="Review title" value={review.title} onChange={event => setReview({ ...review, title: event.target.value })} required /><textarea className="input min-h-20" placeholder="What should peers review?" value={review.description} onChange={event => setReview({ ...review, description: event.target.value })} /><button className="btn-studio" type="submit"><Plus size={15} /> Open review</button></form>{workspace.reviews.length === 0 && <p className="text-sm text-parchment/45">No reviews yet.</p>}{workspace.reviews.map(item => <div key={item.id} className="review-row mb-3"><div><p className="text-sm font-medium text-parchment">{item.title}</p><p className="text-xs text-parchment/45">{item.creator_name} - {item.comment_count} comments</p></div><span className="text-xs text-gold">{item.status}</span></div>)}</div><div className="rounded-md bg-white/[0.05] p-5"><div className="mb-4 flex items-center gap-2 text-gold"><MessageSquare size={17} />Inline feedback</div>{workspace.reviews.length === 0 ? <p className="text-sm text-parchment/45">Create a review before adding feedback.</p> : <form onSubmit={event => submit(`reviews/${comment.reviewId || workspace.reviews[0].id}/comments`, comment, () => setComment({ ...comment, body: '' }))} className="space-y-2"><select className="input" value={comment.reviewId || workspace.reviews[0].id} onChange={event => setComment({ ...comment, reviewId: event.target.value })}>{workspace.reviews.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select><input className="input" placeholder="File path (optional)" value={comment.file_path} onChange={event => setComment({ ...comment, file_path: event.target.value })} /><input className="input" type="number" placeholder="Line number (optional)" value={comment.line_number} onChange={event => setComment({ ...comment, line_number: event.target.value })} /><textarea className="input min-h-24" placeholder="Leave inline feedback" value={comment.body} onChange={event => setComment({ ...comment, body: event.target.value })} required /><button className="btn-studio" type="submit">Add comment</button></form>}</div></div>}
              {tab === 'files' && <div className="grid gap-8 p-6 md:grid-cols-2"><div><h3 className="mb-4 flex items-center gap-2 font-display text-xl text-parchment"><GitCommitHorizontal size={18} className="text-gold" />Commit history</h3><form onSubmit={event => submit('commits', commit, () => setCommit({ message: '', branch: 'main' }))} className="mb-5 flex gap-2"><input className="input" placeholder="Commit message" value={commit.message} onChange={event => setCommit({ ...commit, message: event.target.value })} required /><input className="input max-w-28" placeholder="Branch" value={commit.branch} onChange={event => setCommit({ ...commit, branch: event.target.value })} /><button className="btn-studio" type="submit">Record</button></form>{workspace.commits.length === 0 && <p className="text-sm text-parchment/45">No commits yet.</p>}{workspace.commits.map(item => <div key={item.id} className="review-row mb-2"><div><p className="text-sm text-parchment">{item.message}</p><p className="text-xs text-parchment/45">{item.branch} - {item.author_name}</p></div><code className="text-xs text-parchment/40">{item.hash.slice(0, 7)}</code></div>)}</div><div><h3 className="mb-4 flex items-center gap-2 font-display text-xl text-parchment"><BookOpen size={18} className="text-gold" />Files and wiki</h3><form onSubmit={event => submit('wiki', wiki, () => setWiki({ title: '', body: '' }))} className="mb-5 space-y-2"><input className="input" placeholder="Wiki page title" value={wiki.title} onChange={event => setWiki({ ...wiki, title: event.target.value })} required /><textarea className="input min-h-24" placeholder="Write shared documentation" value={wiki.body} onChange={event => setWiki({ ...wiki, body: event.target.value })} required /><button className="btn-studio" type="submit"><Plus size={15} /> Add wiki page</button></form><label className="btn-studio mb-4 inline-flex cursor-pointer"><FileText size={15} /> Upload file<input className="hidden" type="file" onChange={event => { const file = event.target.files?.[0]; if (!file) return; const formData = new FormData(); formData.append('file', file); api.post(`/projects/${workspace.project.id}/files`, formData, { isForm: true }).then(() => loadWorkspace(workspace.project.id)); }} /></label>{workspace.files.length === 0 && workspace.wiki.length === 0 && <p className="text-sm text-parchment/45">No files or wiki pages yet.</p>}{workspace.files.map(item => <div key={item.id} className="border-b border-white/10 py-2 text-sm text-parchment/70">{item.name}</div>)}{workspace.wiki.map(item => <div key={item.id} className="border-b border-white/10 py-2 text-sm text-parchment/70">{item.title}</div>)}</div></div>}
            </section>
          )}

          {workspace && <section className="card md:col-span-2"><div className="mb-3 flex items-center gap-2"><Users size={18} className="text-sky" /><p className="label !mb-0">Project collaborators</p></div><p className="mb-4 text-sm text-ink/60">Add active student accounts by their user ID, including students from another school.</p><form onSubmit={event => submit('members', member, () => setMember({ user_id: '', role: 'member' }))} className="grid max-w-2xl gap-2 md:grid-cols-[1fr_150px_auto]"><input className="input" type="number" placeholder="Student user ID" value={member.user_id} onChange={event => setMember({ ...member, user_id: event.target.value })} required /><select className="input" value={member.role} onChange={event => setMember({ ...member, role: event.target.value })}><option value="member">Member</option><option value="developer">Developer</option><option value="designer">Designer</option><option value="reviewer">Reviewer</option></select><button className="btn-secondary" type="submit">Add</button></form></section>}

          <section className="card md:col-span-2">
            <div className="mb-5 flex items-center gap-2"><Users size={18} className="text-sky" /><h2 className="font-display text-xl font-semibold">Teams</h2></div>
            <div className="grid gap-6 md:grid-cols-2">
              <div><p className="label">My teams</p>{data.teams.length === 0 && <p className="text-sm text-ink/50">You have not joined any teams yet.</p>}{data.teams.map(team => <button key={team.id} onClick={() => navigate(`/student/teams/${team.id}`)} className="mb-2 block w-full rounded-md border border-ink/10 p-3 text-left transition-colors hover:border-sky/40 hover:bg-parchment"><p className="font-medium">{team.name}</p><p className="text-xs text-ink/50">{team.course_name} - created by {team.created_by_name}</p></button>)}</div>
              <div><p className="label">Available teams</p>{data.available_teams?.length === 0 && <p className="text-sm text-ink/50">No teams are available in your enrolled courses yet.</p>}{data.available_teams?.map(team => <div key={team.id} className="mb-2 flex items-center justify-between gap-3 rounded-md border border-ink/10 p-3"><div><p className="font-medium">{team.name}</p><p className="text-xs text-ink/50">{team.course_name} - {team.member_count} member{team.member_count === 1 ? '' : 's'}</p></div>{team.request_status === 'pending' ? <span className="badge-pending">pending approval</span> : <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => requestToJoin(team.id)}>Request to join</button>}</div>)}</div>
            </div>
            <div className="mt-6 border-t border-ink/10 pt-5"><p className="label">Create your own team</p><form onSubmit={createTeam} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]"><input className="input" placeholder="Team name" value={teamName} onChange={event => setTeamName(event.target.value)} required /><select className="input" value={teamCourseId} onChange={event => setTeamCourseId(event.target.value)} required><option value="">Select an enrolled course</option>{data.courses.map(course => <option key={course.id} value={course.id}>{course.name}</option>)}</select><button className="btn-primary" type="submit"><Plus size={16} /> Create team</button></form></div>
            {data.team_join_requests?.length > 0 && <div className="mt-6 border-t border-ink/10 pt-5"><p className="label">Join requests to approve</p>{data.team_join_requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 py-3 text-sm"><span><strong>{request.requested_by_name}</strong> wants to join <strong>{request.team_name}</strong><span className="text-ink/50"> - {request.course_name}</span></span><span className="flex gap-2"><button className="text-leaf" onClick={() => decideTeamRequest(request.id, request.team_id, 'approved')}>Approve</button><button className="text-clay" onClick={() => decideTeamRequest(request.id, request.team_id, 'rejected')}>Reject</button></span></div>)}</div>}
          </section>

          {urgentAssignments.length > 0 && (
            <section className="card border-l-4 border-clay md:col-span-2">
              <div className="mb-3 flex items-center gap-2"><AlertCircle size={18} className="text-clay" /><h2 className="font-display text-xl font-semibold">Needs attention</h2></div>
              <div className="grid gap-3 md:grid-cols-2">{urgentAssignments.map(assignment => <Link key={assignment.id} to={`/student/courses/${assignment.course_id || ''}`} className="rounded-md border border-ink/10 p-3 hover:border-clay/50"><p className="font-medium">{assignment.title}</p><p className="text-xs text-ink/50">{assignment.course_name} - {dueStatus(assignment.due_date).label}</p></Link>)}</div>
            </section>
          )}

          <section className="card md:col-span-2">
            <div className="mb-4 flex items-center gap-2"><ClipboardList size={18} className="text-sky" /><h2 className="font-display text-xl font-semibold">Quick actions</h2></div>
            <div className="grid gap-3 md:grid-cols-4">
              <Link to="/student/courses/available" className="rounded-md border border-ink/10 p-4 text-sm font-semibold transition-colors hover:border-sky/40 hover:bg-parchment"><BookOpen size={18} className="mb-3 text-sky" />Find a course</Link>
              <Link to="/student/kanban" className="rounded-md border border-ink/10 p-4 text-sm font-semibold transition-colors hover:border-sky/40 hover:bg-parchment"><Check size={18} className="mb-3 text-leaf" />Plan tasks</Link>
              <Link to="/student/ai-tutor" className="rounded-md border border-ink/10 p-4 text-sm font-semibold transition-colors hover:border-sky/40 hover:bg-parchment"><Sparkles size={18} className="mb-3 text-gold" />Ask AI Tutor</Link>
              {data.courses[0] ? <Link to={`/student/courses/${data.courses[0].id}`} className="rounded-md border border-ink/10 p-4 text-sm font-semibold transition-colors hover:border-sky/40 hover:bg-parchment"><Clock size={18} className="mb-3 text-clay" />Resume course</Link> : <span className="rounded-md border border-ink/10 p-4 text-sm font-semibold text-ink/35"><Clock size={18} className="mb-3" />Resume course</span>}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
