const router = require('express').Router();
const { rateLimit } = require('express-rate-limit');
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const createLimiter = (limit, message) => rateLimit({
	windowMs: 15 * 60 * 1000,
	limit,
	standardHeaders: true,
	legacyHeaders: false,
	message: { message }
});

router.post('/login', createLimiter(10, 'Too many login attempts. Try again in 15 minutes.'), authController.login);
router.post('/verify-login-otp', createLimiter(10, 'Too many code attempts. Try again in 15 minutes.'), authController.verifyLoginOtp);
router.post('/resend-login-otp', createLimiter(3, 'Too many code requests. Try again in 15 minutes.'), authController.resendLoginOtp);
router.post('/change-password', requireAuth, authController.changePassword);
router.post('/forgot-password', createLimiter(5, 'Too many reset requests. Try again in 15 minutes.'), authController.forgotPassword);
router.post('/reset-password', createLimiter(10, 'Too many reset attempts. Try again in 15 minutes.'), authController.resetPassword);
router.get('/me', requireAuth, authController.me);

module.exports = router;
