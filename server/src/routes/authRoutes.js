const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts, try again later' },
});

const signupRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2 to 80 characters'),
  body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email'),
  body('password').isLength({ min: 8, max: 72 }).withMessage('Password must be 8 to 72 characters'),
];

const loginRules = [
  body('email').trim().toLowerCase().isEmail().withMessage('Enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/signup', authLimiter, signupRules, validate, controller.signup);
router.post('/login', authLimiter, loginRules, validate, controller.login);
router.get('/me', protect, controller.me);

module.exports = router;