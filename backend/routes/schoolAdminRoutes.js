const router = require('express').Router();
const adminController = require('../controllers/schoolAdminController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.use(requireAuth, requireRole('school_admin'));

router.post('/users', adminController.createUser);
router.get('/users', adminController.listSchoolUsers);
router.patch('/users/:id/deactivate', adminController.setUserActive);

router.get('/students/pending', adminController.listPendingStudents);
router.patch('/students/:id/approve', adminController.decideStudent);

module.exports = router;
