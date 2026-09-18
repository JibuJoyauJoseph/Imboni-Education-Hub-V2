const router = require('express').Router();
const studentController = require('../controllers/studentController');
const { requireAuth, requireApproved, requireRole } = require('../middleware/auth');

// Public self-registration (Rule 2 + Rule 7 branching)
router.post('/register', studentController.registerStudent);

// Authenticated + approved student endpoints
router.get('/me/dashboard', requireAuth, requireApproved, requireRole('student'), studentController.getMyDashboard);
router.get('/courses/available', requireAuth, requireApproved, requireRole('student'), studentController.getAvailableCourses);

module.exports = router;
