/**
 * User Routes (Admin Management)
 */

const express = require('express');
const router = express.Router();

const { getAllUsers, getUserById, updateUser, deleteUser, getDashboardStats } = require('../controllers/user');
const { protect, authorize } = require('../middleware/auth');

router.use(protect, authorize('ADMIN')); // All user management routes require Admin

router.get('/admin/dashboard', getDashboardStats);
router.get('/', getAllUsers);
router.get('/:id', getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

module.exports = router;