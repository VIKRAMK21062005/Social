const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Order routes will be implemented here
router.get('/', protect, (req, res) => {
  res.json({ success: true, message: 'Order routes - to be implemented' });
});

module.exports = router;