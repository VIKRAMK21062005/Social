/**
 * Product Routes
 */

const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const { getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, addReview } = require('../controllers/product');
const { protect, authorize } = require('../middleware/auth');

const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('imageUrl').notEmpty().withMessage('Image URL is required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
];

// Public
router.get('/', getAllProducts);
router.get('/:id', getProductById);

// Admin only
router.post('/', protect, authorize('ADMIN'), productValidation, createProduct);
router.put('/:id', protect, authorize('ADMIN'), updateProduct);
router.delete('/:id', protect, authorize('ADMIN'), deleteProduct);

// Authenticated users
router.post('/:id/reviews', protect, addReview);

module.exports = router;