import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../../components/Navbar.jsx';
import { api } from '../../services/api';

const TABS = ['Join requests', 'Teams', 'Resources', 'Assignments', 'Gradebook', 'Quizzes', 'Live sessions', 'Attendance'];

function TeamRow({ team, courseId, progress, onDecide }) {
  const [requests, setRequests] = useState([]);
  const [students, setStudents] = useState([]);
  const [memberIds, setMemberIds] = useState([]);

  useEffect(() => {
    api.get(`/teams/${team.id}/join-requests`).then(result => setRequests(result.requests.filter(request => request.status === 'pending')));
    api.get(`/courses/${courseId}/students`).then(result => setStudents(result.students));
    api.get(`/teams/${team.id}/members`).then(result => setMemberIds(result.members.map(member => member.id)));
  }, [courseId, team.id]);

  async function addStudent(studentId) {
    await api.post(`/teams/${team.id}/members`, { student_id: studentId });
    setMemberIds(ids => ids.includes(studentId) ? ids : [...ids, studentId]);
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display font-semibold">{team.name}</p>
          <p className="text-xs text-ink/50">{team.member_count} members · created by {team.created_by_name || 'a student'}</p>
        </div>
        <span className="badge-approved">Active</span>
      </div>
      <div className="mt-4 border-t border-ink/10 pt-3"><div className="mb-1 flex justify-between text-xs text-ink/60"><span>Work completed</span><span>{progress?.progress_percent || 0}% · {progress?.completed_work || 0}/{(progress?.member_count || 0) * (progress?.assignment_count || 0)} submissions</span></div><div className="h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full rounded-full bg-leaf" style={{ width: `${progress?.progress_percent || 0}%` }} /></div><p className="mt-2 text-xs text-ink/45">{progress?.assignment_count || 0} assignment{progress?.assignment_count === 1 ? '' : 's'} tracked across {progress?.member_count || 0} members</p></div>
      {requests.length > 0 && (
        <div className="mt-4 border-t border-ink/10 pt-3">
          <p className="label">Pending join requests</p>
          {requests.map(request => (
            <div key={request.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{request.full_names} <span className="text-ink/40">({request.email})</span></span>
              <span className="flex gap-3"><button className="text-leaf" onClick={() => onDecide(team.id, request.id, 'approved')}>Approve</button><button className="text-clay" onClick={() => onDecide(team.id, request.id, 'rejected')}>Reject</button></span>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 border-t border-ink/10 pt-3">
        <p className="label">Add students from class</p>
        {students.length === 0 && <p className="text-sm text-ink/50">No approved students are enrolled in this course.</p>}
        <div className="divide-y divide-ink/10">
          {students.map(student => (
            <div key={student.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{student.full_names} <span className="text-ink/40">({student.email})</span></span>
              {memberIds.includes(student.id) ? <span className="badge-approved">Added</span> : <button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => addStudent(student.id)}>Add</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function CourseManage() {
  const { id } = useParams();
  const [tab, setTab] = useState('Join requests');
  const [requests, setRequests] = useState([]);
  const [resources, setResources] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState('');
  const [teamProgress, setTeamProgress] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [quizAttempts, setQuizAttempts] = useState([]);
  const [quizForm, setQuizForm] = useState({ title: '', time_limit_minutes: 30, open_at: '', close_at: '', questions: [{ question_text: '', points: 1, options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }] });
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [classStudents, setClassStudents] = useState([]);
  const [attendanceSession, setAttendanceSession] = useState('');
  const [attendance, setAttendance] = useState({});
  const [attendanceMessage, setAttendanceMessage] = useState('');
  const [quizMessage, setQuizMessage] = useState('');
  const [resourceForm, setResourceForm] = useState({ title: '', description: '' });
  const [assignmentForm, setAssignmentForm] = useState({ title: '', instructions: '', due_date: '', max_score: 100 });
  const [sessionForm, setSessionForm] = useState({ title: '', meeting_link: '', scheduled_at: '' });

  function loadRequests() { api.get(`/courses/${id}/requests`).then(d => setRequests(d.requests)); }
  function loadResources() { api.get(`/courses/${id}/resources`).then(d => setResources(d.resources)); }
  function loadAssignments() { api.get(`/courses/${id}/assignments`).then(d => setAssignments(d.assignments)); }
  function loadSessions() { api.get(`/courses/${id}/sessions`).then(d => setSessions(d.sessions)); }
  function loadTeams() { api.get(`/courses/${id}/teams`).then(d => setTeams(d.teams)); }
  function loadTeamProgress() { api.get(`/courses/${id}/team-progress`).then(d => setTeamProgress(d.teams)); }
  function loadQuizzes() { api.get(`/courses/${id}/quizzes`).then(d => setQuizzes(d.quizzes)); }
  function loadQuizAttempts() { api.get(`/courses/${id}/quiz-attempts`).then(d => setQuizAttempts(d.attempts)); }
  function loadStudents() { api.get(`/courses/${id}/students`).then(d => setClassStudents(d.students)); }

  useEffect(() => { loadRequests(); loadResources(); loadAssignments(); loadSessions(); loadTeams(); loadTeamProgress(); loadQuizzes(); loadQuizAttempts(); loadStudents(); }, [id]);

  async function decide(requestId, decision) {
    await api.patch(`/courses/requests/${requestId}`, { decision });
    loadRequests();
    if (decision === 'approved') loadStudents();
  }

  async function addResource(e) {
    e.preventDefault();
    const body = new FormData();
    body.append('title', resourceForm.title);
    body.append('description', resourceForm.description);
    if (resourceForm.file) body.append('file', resourceForm.file);
    await api.post(`/courses/${id}/resources`, body, { isForm: true });
    setResourceForm({ title: '', description: '', file: null });
    loadResources();
  }

  async function addAssignment(e) {
    e.preventDefault();
    const body = new FormData();
    body.append('title', assignmentForm.title);
    body.append('instructions', assignmentForm.instructions);
    body.append('due_date', assignmentForm.due_date);
    body.append('max_score', assignmentForm.max_score);
    if (assignmentForm.file) body.append('file', assignmentForm.file);
    await api.post(`/courses/${id}/assignments`, body, { isForm: true });
    setAssignmentForm({ title: '', instructions: '', due_date: '', max_score: 100, file: null });
    loadAssignments();
  }

  async function addSession(e) {
    e.preventDefault();
    await api.post(`/courses/${id}/sessions`, sessionForm);
    setSessionForm({ title: '', meeting_link: '', scheduled_at: '' });
    loadSessions();
  }

  async function createTeam(e) {
    e.preventDefault();
    if (!teamName.trim()) return;
    await api.post(`/courses/${id}/teams`, { name: teamName.trim() });
    setTeamName('');
    loadTeams();
    loadTeamProgress();
  }

  async function decideTeamRequest(teamId, requestId, status) {
    await api.patch(`/teams/${teamId}/join-requests/${requestId}`, { status });
    loadTeams();
    loadTeamProgress();
  }

  function addQuizQuestion() {
    setQuizForm(form => ({ ...form, questions: [...form.questions, { question_text: '', points: 1, options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }] }));
  }

  function addQuizOption(questionIndex) {
    setQuizForm(form => ({
      ...form,
      questions: form.questions.map((question, index) => index === questionIndex
        ? { ...question, options: [...question.options, { option_text: '', is_correct: false }] }
        : question)
    }));
  }

  function removeQuizOption(questionIndex, optionIndex) {
    setQuizForm(form => ({
      ...form,
      questions: form.questions.map((question, index) => {
        if (index !== questionIndex || question.options.length <= 2) return question;
        const removedWasCorrect = question.options[optionIndex]?.is_correct;
        const options = question.options
          .filter((_, subIndex) => subIndex !== optionIndex)
          .map((option, subIndex) => ({ ...option, is_correct: removedWasCorrect ? subIndex === 0 : option.is_correct }));
        return { ...question, options };
      })
    }));
  }

  async function createQuiz(event) {
    event.preventDefault();
    setQuizMessage('');
    try {
      await api.post(`/courses/${id}/quizzes`, {
        ...quizForm,
        open_at: quizForm.open_at || null,
        close_at: quizForm.close_at || null,
        questions: quizForm.questions.map(question => ({
          ...question,
          points: Number(question.points) || 1,
          options: question.options.map(option => ({ ...option, option_text: option.option_text.trim() }))
        }))
      });
      setQuizMessage('Quiz published successfully.');
    } catch (err) {
      setQuizMessage(err.data?.message || err.message);
      return;
    }
    setQuizForm({ title: '', time_limit_minutes: 30, open_at: '', close_at: '', questions: [{ question_text: '', points: 1, options: [{ option_text: '', is_correct: true }, { option_text: '', is_correct: false }] }] });
    loadQuizzes();
    loadQuizAttempts();
  }

  async function reviewSubmissions(assignment) {
    setSelectedAssignment(assignment);
    const result = await api.get(`/assignments/${assignment.id}/submissions`);
    setSubmissions(result.submissions);
  }

  async function saveGrade(submission) {
    await api.patch(`/submissions/${submission.id}/grade`, { score: submission.score, feedback: submission.feedback });
    setSubmissions(items => items.map(item => item.id === submission.id ? { ...item, graded_at: new Date().toISOString() } : item));
  }

  async function loadAttendance(sessionId) {
    if (!sessionId) return;
    setAttendanceMessage('');
    setAttendanceSession(sessionId);
    const result = await api.get(`/sessions/${sessionId}/attendance`);
    const saved = Object.fromEntries(result.attendance.map(record => [record.student_id, record.status]));
    setAttendance(Object.fromEntries(classStudents.map(student => [student.id, saved[student.id] || 'absent'])));
  }

  async function saveAttendance() {
    await api.post(`/sessions/${attendanceSession}/attendance`, { records: Object.entries(attendance).map(([student_id, status]) => ({ student_id, status })) });
    await loadAttendance(attendanceSession);
    setAttendanceMessage('Attendance saved.');
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="mb-6 flex gap-2 overflow-x-auto border-b border-ink/10">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-mono uppercase tracking-wide ${tab === t ? 'border-b-2 border-sky text-ink' : 'text-ink/40'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Join requests' && (
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className="card flex justify-between items-center">
                <div>
                  <p className="font-display font-semibold">{r.full_names}</p>
                  <p className="text-xs text-ink/50">{r.email}</p>
                </div>
                {r.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button className="btn-primary text-sm" onClick={() => decide(r.id, 'approved')}>Approve</button>
                    <button className="btn-secondary text-sm" onClick={() => decide(r.id, 'rejected')}>Reject</button>
                  </div>
                ) : (
                  <span className={r.status === 'approved' ? 'badge-approved' : 'badge-rejected'}>{r.status}</span>
                )}
              </div>
            ))}
            {requests.length === 0 && <p className="text-ink/50">No join requests yet.</p>}
          </div>
        )}

        {tab === 'Teams' && (
          <div>
            <form onSubmit={createTeam} className="card mb-6 flex gap-2">
              <input className="input" placeholder="Team name" required value={teamName} onChange={e => setTeamName(e.target.value)} />
              <button className="btn-primary">Create team</button>
            </form>
            <div className="space-y-3">
              {teams.map(team => (
                <TeamRow key={team.id} team={team} courseId={id} progress={teamProgress.find(item => item.id === team.id)} onDecide={decideTeamRequest} />
              ))}
              {teams.length === 0 && <p className="text-ink/50">No teams created for this course yet.</p>}
            </div>
          </div>
        )}

        {tab === 'Resources' && (
          <div>
            <form onSubmit={addResource} className="card mb-6 space-y-3">
              <input className="input" placeholder="Title" required value={resourceForm.title} onChange={e => setResourceForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="input" placeholder="Description" value={resourceForm.description} onChange={e => setResourceForm(f => ({ ...f, description: e.target.value }))} />
              <input className="input" type="file" onChange={e => setResourceForm(f => ({ ...f, file: e.target.files[0] || null }))} />
              <button className="btn-primary">Share resource</button>
            </form>
            <div className="space-y-3">
              {resources.map(r => (
                <div key={r.id} className="card"><p className="font-display font-semibold">{r.title}</p><p className="text-sm text-ink/60">{r.description}</p>{r.file_path && <a className="text-sm text-sky underline" href={`http://localhost:5000${r.file_path}`} target="_blank" rel="noreferrer">Download attachment</a>}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Assignments' && (
          <div>
            <form onSubmit={addAssignment} className="card mb-6 space-y-3">
              <input className="input" placeholder="Title" required value={assignmentForm.title} onChange={e => setAssignmentForm(f => ({ ...f, title: e.target.value }))} />
              <textarea className="input" placeholder="Instructions" value={assignmentForm.instructions} onChange={e => setAssignmentForm(f => ({ ...f, instructions: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3">
                <input className="input" type="datetime-local" value={assignmentForm.due_date} onChange={e => setAssignmentForm(f => ({ ...f, due_date: e.target.value }))} />
                <input className="input" type="number" placeholder="Max score" value={assignmentForm.max_score} onChange={e => setAssignmentForm(f => ({ ...f, max_score: e.target.value }))} />
              </div>
              <input className="input" type="file" onChange={e => setAssignmentForm(f => ({ ...f, file: e.target.files[0] || null }))} />
              <button className="btn-primary">Post assignment</button>
            </form>
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} className="card"><p className="font-display font-semibold">{a.title}</p>{a.file_path && <a className="text-sm text-sky underline" href={`http://localhost:5000${a.file_path}`} target="_blank" rel="noreferrer">Download attachment</a>}</div>
              ))}
            </div>
          </div>
        )}

        {tab === 'Gradebook' && (
          <div className="space-y-6">
            <div className="card"><h2 className="mb-4 font-display text-xl font-semibold">Assignment submissions</h2>{assignments.length === 0 && <p className="text-ink/50">No assignments have been posted yet.</p>}{assignments.map(assignment => <div key={assignment.id} className="flex items-center justify-between border-b border-ink/10 py-3"><div><p className="font-medium">{assignment.title}</p><p className="text-xs text-ink/50">Max score: {assignment.max_score} · Due: {assignment.due_date || 'No deadline'}</p></div><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => reviewSubmissions(assignment)}>Review submissions</button></div>)}</div>
            {selectedAssignment && <div className="card"><h3 className="mb-4 font-display text-xl font-semibold">{selectedAssignment.title}</h3>{submissions.length === 0 && <p className="text-ink/50">No submissions yet.</p>}{submissions.map(submission => <div key={submission.id} className="border-b border-ink/10 py-4"><div className="flex items-center justify-between"><div><p className="font-medium">{submission.student_name}</p><p className="text-xs text-ink/50">Submitted {new Date(submission.submitted_at).toLocaleString()}</p>{submission.file_path && <a className="text-xs text-sky underline" href={`http://localhost:5000${submission.file_path}`} target="_blank" rel="noreferrer">Open submission</a>}</div><button className="btn-primary !px-3 !py-1.5 text-xs" onClick={() => saveGrade(submission)}>Save grade</button></div><div className="mt-3 grid gap-2 md:grid-cols-[120px_1fr]"><input className="input" type="number" min="0" max={selectedAssignment.max_score} placeholder="Score" value={submission.score || ''} onChange={event => setSubmissions(items => items.map(item => item.id === submission.id ? { ...item, score: event.target.value } : item))} /><textarea className="input" placeholder="Feedback" value={submission.feedback || ''} onChange={event => setSubmissions(items => items.map(item => item.id === submission.id ? { ...item, feedback: event.target.value } : item))} /></div></div>)}</div>}
          </div>
        )}

        {tab === 'Quizzes' && (
          <div className="space-y-6">
            <form onSubmit={createQuiz} className="card space-y-4"><h2 className="font-display text-xl font-semibold">Create auto-graded quiz</h2>{quizMessage && <p className={quizMessage.includes('successfully') ? 'text-sm text-leaf' : 'text-sm text-clay'}>{quizMessage}</p>}<input className="input" placeholder="Quiz title" required value={quizForm.title} onChange={event => setQuizForm({ ...quizForm, title: event.target.value })} /><div className="grid gap-2 md:grid-cols-3"><input className="input" type="number" min="1" placeholder="Time limit in minutes" value={quizForm.time_limit_minutes} onChange={event => setQuizForm({ ...quizForm, time_limit_minutes: event.target.value })} /><input className="input" type="datetime-local" value={quizForm.open_at} onChange={event => setQuizForm({ ...quizForm, open_at: event.target.value })} /><input className="input" type="datetime-local" value={quizForm.close_at} onChange={event => setQuizForm({ ...quizForm, close_at: event.target.value })} /></div>{quizForm.questions.map((question, questionIndex) => <div key={questionIndex} className="rounded-md border border-ink/10 p-4"><div className="mb-3 flex gap-2"><input className="input" placeholder={`Question ${questionIndex + 1}`} required value={question.question_text} onChange={event => setQuizForm(form => ({ ...form, questions: form.questions.map((item, index) => index === questionIndex ? { ...item, question_text: event.target.value } : item) }))} /><input className="input max-w-24" type="number" min="1" value={question.points} onChange={event => setQuizForm(form => ({ ...form, questions: form.questions.map((item, index) => index === questionIndex ? { ...item, points: event.target.value } : item) }))} /></div>{question.options.map((option, optionIndex) => <div key={optionIndex} className="mb-2 flex gap-2"><input className="input" placeholder={`Option ${optionIndex + 1}`} required value={option.option_text} onChange={event => setQuizForm(form => ({ ...form, questions: form.questions.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((entry, subIndex) => subIndex === optionIndex ? { ...entry, option_text: event.target.value } : entry) } : item) }))} /><label className="flex items-center gap-2 text-xs text-ink/60"><input type="radio" name={`correct-${questionIndex}`} checked={option.is_correct} onChange={() => setQuizForm(form => ({ ...form, questions: form.questions.map((item, index) => index === questionIndex ? { ...item, options: item.options.map((entry, subIndex) => ({ ...entry, is_correct: subIndex === optionIndex })) } : item) }))} /> Correct</label></div>)}</div>)}<div className="flex gap-2"><button className="btn-secondary" type="button" onClick={addQuizQuestion}><Plus size={15} /> Add question</button><button className="btn-primary" type="submit">Publish quiz</button></div></form>
            <div className="card"><h2 className="mb-4 font-display text-xl font-semibold">Auto-graded results</h2>{quizAttempts.length === 0 && <p className="text-ink/50">No quiz attempts yet.</p>}<div className="space-y-2">{quizAttempts.map(attempt => <div key={attempt.id} className="flex items-center justify-between border-b border-ink/10 py-3 text-sm"><span>{attempt.student_name} · {attempt.quiz_title}</span><span className="font-mono">{attempt.auto_score}/{attempt.max_score}</span></div>)}</div></div>
          </div>
        )}

        {tab === 'Attendance' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="mb-4 font-display text-xl font-semibold">Attendance</h2>
              {attendanceMessage && <p className="mb-3 text-sm text-leaf">{attendanceMessage}</p>}
              {sessions.length === 0 ? (
                <p className="text-ink/50">Schedule a live session before taking attendance.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <select className="input" value={attendanceSession} onChange={event => loadAttendance(event.target.value)}>
                    <option value="">Select a session</option>
                    {sessions.map(session => (
                      <option key={session.id} value={session.id}>
                        {session.title} - {new Date(session.scheduled_at).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <button className="btn-secondary" type="button" disabled={!attendanceSession} onClick={() => loadAttendance(attendanceSession)}>Refresh</button>
                </div>
              )}
            </div>

            {attendanceSession && (
              <div className="card">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="label">Approved class list</p>
                    <p className="text-sm text-ink/60">{classStudents.length} enrolled student{classStudents.length === 1 ? '' : 's'}</p>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="badge-approved">{Object.values(attendance).filter(status => status === 'present').length} present</span>
                    <span className="badge-pending">{Object.values(attendance).filter(status => status === 'late').length} late</span>
                    <span className="badge-rejected">{Object.values(attendance).filter(status => status === 'absent').length} absent</span>
                  </div>
                </div>
                {classStudents.length === 0 ? (
                  <p className="text-sm text-ink/50">No approved students are enrolled in this course yet.</p>
                ) : (
                  <div className="divide-y divide-ink/10">
                    {classStudents.map(student => (
                      <div key={student.id} className="grid gap-2 py-3 text-sm md:grid-cols-[1fr_160px] md:items-center">
                        <div>
                          <p className="font-medium">{student.full_names}</p>
                          <p className="text-xs text-ink/45">{student.email}</p>
                        </div>
                        <select className="input !py-1.5" value={attendance[student.id] || 'absent'} onChange={event => setAttendance(records => ({ ...records, [student.id]: event.target.value }))}>
                          <option value="present">Present</option>
                          <option value="late">Late</option>
                          <option value="absent">Absent</option>
                        </select>
                      </div>
                    ))}
                  </div>
                )}
                <button className="btn-primary mt-5" type="button" disabled={!classStudents.length} onClick={saveAttendance}>Save attendance</button>
              </div>
            )}
          </div>
        )}

        {tab === 'Live sessions' && (
          <div>
            <form onSubmit={addSession} className="card mb-6 space-y-3">
              <input className="input" placeholder="Session title" required value={sessionForm.title} onChange={e => setSessionForm(f => ({ ...f, title: e.target.value }))} />
              <input className="input" placeholder="Meeting link" value={sessionForm.meeting_link} onChange={e => setSessionForm(f => ({ ...f, meeting_link: e.target.value }))} />
              <div className="grid grid-cols-2 gap-3"><input className="input" type="datetime-local" required value={sessionForm.scheduled_at} onChange={e => setSessionForm(f => ({ ...f, scheduled_at: e.target.value }))} /><input className="input" type="number" min="1" placeholder="Duration (minutes)" value={sessionForm.duration_minutes || ''} onChange={e => setSessionForm(f => ({ ...f, duration_minutes: e.target.value }))} /></div>
              <button className="btn-primary">Schedule session</button>
            </form>
            <div className="space-y-3">
              {sessions.map(s => (
                <div key={s.id} className="card"><div className="flex justify-between"><div><p className="font-display font-semibold">{s.title}</p><p className="text-xs text-ink/50">{new Date(s.scheduled_at).toLocaleString()} · {s.duration_minutes} minutes</p>{s.meeting_link && <a className="text-xs text-sky underline" href={s.meeting_link} target="_blank" rel="noreferrer">Open meeting link</a>}</div><span className="badge-pending">{s.status}</span></div><div className="mt-4 flex flex-wrap gap-2"><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => api.patch(`/sessions/${s.id}/status`, { status: 'live' }).then(loadSessions)}>Start</button><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => api.patch(`/sessions/${s.id}/status`, { status: 'ended' }).then(loadSessions)}>End</button><button className="btn-secondary !px-3 !py-1.5 text-xs" onClick={() => loadAttendance(s.id)}>Mark attendance</button></div>{attendanceSession === s.id && <div className="mt-4 border-t border-ink/10 pt-4"><p className="label">Attendance</p>{classStudents.map(student => <div key={student.id} className="flex items-center justify-between border-b border-ink/10 py-2 text-sm"><span>{student.full_names}</span><select className="input max-w-32 !py-1" value={attendance[student.id] || 'absent'} onChange={e => setAttendance(records => ({ ...records, [student.id]: e.target.value }))}><option value="present">Present</option><option value="late">Late</option><option value="absent">Absent</option></select></div>)}<button className="btn-primary mt-4" onClick={saveAttendance}>Save attendance</button></div>}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
