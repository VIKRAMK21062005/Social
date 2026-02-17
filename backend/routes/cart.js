const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');

// Cart routes will be implemented here
router.get('/', protect, (req, res) => {
  res.json({ success: true, message: 'Cart routes - to be implemented' });
});

module.exports = router;