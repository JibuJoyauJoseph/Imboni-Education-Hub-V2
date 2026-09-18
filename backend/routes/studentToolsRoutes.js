const router = require('express').Router();
const { requireAuth, requireApproved, requireRole } = require('../middleware/auth');
const upload = require('../middleware/upload');
const kanbanController = require('../controllers/kanbanController');
const projectController = require('../controllers/projectController');
const aiTutorController = require('../controllers/aiTutorController');

router.use(requireAuth, requireApproved, requireRole('student'));

// Kanban dashboard
router.get('/kanban', kanbanController.getBoard);
router.post('/kanban/tasks', kanbanController.createTask);
router.patch('/kanban/tasks/:id', kanbanController.updateTask);
router.delete('/kanban/tasks/:id', kanbanController.deleteTask);

// Shared project workspaces
router.get('/projects', projectController.listProjects);
router.post('/projects', projectController.createProject);
router.get('/projects/dashboard', projectController.getDashboard);
router.post('/projects/:projectId/members', projectController.addMember);
router.post('/projects/:projectId/tasks', projectController.createTask);
router.patch('/projects/:projectId/tasks/:taskId', projectController.updateTask);
router.post('/projects/:projectId/milestones', projectController.createMilestone);
router.post('/projects/:projectId/reviews', projectController.createReview);
router.post('/projects/:projectId/reviews/:reviewId/comments', projectController.addReviewComment);
router.post('/projects/:projectId/wiki', projectController.createWikiPage);
router.post('/projects/:projectId/commits', projectController.createCommit);
router.post('/projects/:projectId/files', upload.single('file'), projectController.uploadFile);

// AI tutor
router.post('/ai-tutor/chat', aiTutorController.chat);
router.get('/ai-tutor/conversations', aiTutorController.listConversations);
router.get('/ai-tutor/conversations/:id/messages', aiTutorController.getMessages);

module.exports = router;
