const router = require('express').Router();
const { requireAuth, requireApproved, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');

const courseController = require('../controllers/courseController');
const teamController = require('../controllers/teamController');
const resourceController = require('../controllers/resourceController');
const assignmentController = require('../controllers/assignmentController');
const quizController = require('../controllers/quizController');
const sessionController = require('../controllers/sessionController');
const forumController = require('../controllers/forumController');

router.use(requireAuth, requireApproved);

// ----- Courses -----
router.post('/courses', requireRole('lecturer'), courseController.createCourse);
router.get('/courses', requireRole('lecturer', 'school_admin'), courseController.listCourses);
router.post('/courses/:id/join', requireRole('student'), courseController.requestToJoin);
router.get('/courses/:id/requests', requireRole('lecturer'), courseController.listJoinRequests);
router.patch('/courses/requests/:requestId', requireRole('lecturer'), courseController.decideJoinRequest);

// ----- Teams -----
router.post('/courses/:courseId/teams', requireRole('student', 'lecturer'), teamController.createTeam);
router.get('/courses/:courseId/students', requireRole('lecturer'), teamController.listCourseStudents);
router.get('/courses/:courseId/teams', teamController.listTeams);
router.get('/courses/:courseId/team-progress', requireRole('lecturer'), teamController.listCourseTeamProgress);
router.get('/teams/available', requireRole('student'), teamController.listAvailableForStudent);
router.post('/teams/:teamId/join', requireRole('student'), teamController.joinTeam);
router.post('/teams/:teamId/members', requireRole('lecturer'), teamController.addMemberDirect);
router.get('/teams/:teamId/join-requests', requireRole('student', 'lecturer'), teamController.listJoinRequests);
router.patch('/teams/:teamId/join-requests/:requestId', requireRole('student', 'lecturer'), teamController.decideJoinRequest);
router.get('/teams/:teamId/members', teamController.listMembers);
router.get('/teams/:teamId/progress', requireRole('student'), teamController.getTeamProgress);

// ----- Resources -----
router.post('/courses/:courseId/resources', requireRole('lecturer'), upload.single('file'), resourceController.createResource);
router.get('/courses/:courseId/resources', resourceController.listResources);
router.get('/platform-resources', resourceController.listPlatformResources);

// ----- Assignments / Gradebook -----
router.post('/courses/:courseId/assignments', requireRole('lecturer'), upload.single('file'), assignmentController.createAssignment);
router.get('/courses/:courseId/assignments', assignmentController.listAssignments);
router.post('/assignments/:id/submit', requireRole('student'), upload.single('file'), assignmentController.submitAssignment);
router.get('/assignments/:id/submissions', requireRole('lecturer'), assignmentController.listSubmissions);
router.patch('/submissions/:id/grade', requireRole('lecturer'), assignmentController.gradeSubmission);

// ----- Quizzes (auto-graded) -----
router.post('/courses/:courseId/quizzes', requireRole('lecturer'), quizController.createQuiz);
router.get('/courses/:courseId/quizzes', quizController.listQuizzes);
router.get('/courses/:courseId/quiz-attempts', requireRole('lecturer'), quizController.listAttempts);
router.get('/quizzes/:id', quizController.getQuiz);
router.post('/quizzes/:id/attempt', requireRole('student'), quizController.submitAttempt);

// ----- Live sessions + attendance -----
router.post('/courses/:courseId/sessions', requireRole('lecturer'), sessionController.createSession);
router.get('/courses/:courseId/sessions', sessionController.listSessions);
router.patch('/sessions/:id/status', requireRole('lecturer'), sessionController.updateSessionStatus);
router.post('/sessions/:id/attendance', requireRole('lecturer'), sessionController.markAttendance);
router.get('/sessions/:id/attendance', requireRole('lecturer'), sessionController.getAttendance);

// ----- Discussion forums -----
router.post('/courses/:courseId/forum/threads', forumController.createThread);
router.get('/courses/:courseId/forum/threads', forumController.listThreads);
router.post('/forum/threads/:threadId/posts', forumController.createPost);
router.get('/forum/threads/:threadId/posts', forumController.listPosts);

module.exports = router;
