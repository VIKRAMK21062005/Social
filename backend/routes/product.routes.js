/**
 * Product Routes
 * Routes for product CRUD operations
 */

const express = require('express');
const router = express.Router();

const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  addReview
} = require('../controllers/product.controller');

const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Protected routes (Admin only)
router.post('/', protect, authorize('ADMIN'), createProduct);
router.put('/:id', protect, authorize('ADMIN'), updateProduct);
router.delete('/:id', protect, authorize('ADMIN'), deleteProduct);

// Protected routes (Authenticated users)
router.post('/:id/reviews', protect, addReview);

module.exports = router;