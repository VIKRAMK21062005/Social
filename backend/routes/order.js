/**
 * Order Routes
 */

const express = require('express');
const router = express.Router();

const {
  placeOrder,
  getUserOrders,
  getOrderById,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
} = require('../controllers/order');
const { protect, authorize } = require('../middleware/auth');

// Admin routes (must come before /:id to avoid route conflicts)
router.get('/admin/all', protect, authorize('ADMIN'), getAllOrders);
router.put('/admin/:id/status', protect, authorize('ADMIN'), updateOrderStatus);

// User routes
router.post('/', protect, placeOrder);
router.get('/', protect, getUserOrders);
router.get('/:id', protect, getOrderById);
router.put('/:id/cancel', protect, cancelOrder);

module.exports = router;