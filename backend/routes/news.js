/**
 * News Routes
 */

const express = require('express');
const router = express.Router();

const { getAllNews, getNewsById, createNews, updateNews, deleteNews, reAnalyzeNews } = require('../controllers/news');
const { protect, authorize } = require('../middleware/auth');

// Public
router.get('/', getAllNews);
router.get('/:id', getNewsById);

// Admin only
router.post('/', protect, authorize('ADMIN'), createNews);
router.put('/:id', protect, authorize('ADMIN'), updateNews);
router.delete('/:id', protect, authorize('ADMIN'), deleteNews);
router.post('/:id/analyze', protect, authorize('ADMIN'), reAnalyzeNews);

module.exports = router;