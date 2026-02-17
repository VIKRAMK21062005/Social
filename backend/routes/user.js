const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');

// User routes will be implemented here
router.get('/', protect, authorize('ADMIN'), (req, res) => {
  res.json({ success: true, message: 'User routes - to be implemented' });
});

module.exports = router;