const router = require('express').Router();
const platformController = require('../controllers/platformAdminController');
const upload = require('../middleware/upload');
const { requireAuth, requireRole } = require('../middleware/auth');

// Public — used by the registration dropdown to list active/subscribed schools
router.get('/schools/public', platformController.listSchoolsPublic);
router.get('/resources/public', platformController.listPublicPlatformResources);

router.use(requireAuth, requireRole('platform_admin'));
router.post('/schools', platformController.registerSchool);
router.get('/schools', platformController.listSchools);
router.post('/schools/:id/payments', platformController.recordPayment);
router.post('/resources', upload.single('file'), platformController.createPlatformResource);
router.get('/resources', platformController.listPlatformResources);

module.exports = router;
