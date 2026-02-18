/**
 * Authentication Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { register, login, getMe, updateProfile, changePassword } = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().withMessage('Please enter a valid email').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
];

const loginValidation = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
];

const changePasswordValidation = [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').notEmpty().withMessage('New password is required').isLength({ min: 6 })
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain uppercase, lowercase, and number'),
];

// Public
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);

// Protected
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePasswordValidation, changePassword);

module.exports = router;