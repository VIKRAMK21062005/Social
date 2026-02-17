/**
 * ML Integration Routes
 * Routes for ML service integration
 */

const express = require('express');
const router = express.Router();

const {
  analyzeSentiment,
  detectFakeNews,
  checkHealth
} = require('../controllers/ml.controller');

// Public routes
router.post('/sentiment', analyzeSentiment);
router.post('/fake-news', detectFakeNews);
router.get('/health', checkHealth);

module.exports = router;