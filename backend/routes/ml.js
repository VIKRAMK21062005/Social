/**
 * ML Service Routes
 */

const express = require('express');
const router = express.Router();

const { analyzeSentiment, detectFakeNews, checkHealth } = require('../controllers/ml.controller');

router.get('/health', checkHealth);
router.post('/sentiment', analyzeSentiment);
router.post('/fake-news', detectFakeNews);

module.exports = router;