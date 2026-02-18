/**
 * ML Integration Controller
 * Proxies requests to the Python ML microservice
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

const mlRequest = async (endpoint, data, timeout = 30000) => {
  return axios.post(`${ML_SERVICE_URL}${endpoint}`, data, {
    timeout,
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * @desc    Analyze sentiment of text
 * @route   POST /api/ml/sentiment
 * @access  Public
 */
exports.analyzeSentiment = async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const response = await mlRequest('/api/sentiment', { text });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ success: false, message: 'ML service is currently unavailable' });
    }
    if (error.response) {
      return res.status(error.response.status).json({
        success: false, message: error.response.data.message || 'ML service error',
      });
    }
    next(error);
  }
};

/**
 * @desc    Detect fake news
 * @route   POST /api/ml/fake-news
 * @access  Public
 */
exports.detectFakeNews = async (req, res, next) => {
  try {
    const { text, title } = req.body;
    if (!text) {
      return res.status(400).json({ success: false, message: 'Text is required' });
    }
    const response = await mlRequest('/api/fake-news', { text, title });
    res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      return res.status(503).json({ success: false, message: 'ML service is currently unavailable' });
    }
    if (error.response) {
      return res.status(error.response.status).json({
        success: false, message: error.response.data.message || 'ML service error',
      });
    }
    next(error);
  }
};

/**
 * @desc    Check ML service health
 * @route   GET /api/ml/health
 * @access  Public
 */
exports.checkHealth = async (_req, res, _next) => {
  try {
    const response = await axios.get(`${ML_SERVICE_URL}/health`, { timeout: 5000 });
    res.status(200).json({ success: true, message: 'ML service is running', data: response.data });
  } catch {
    res.status(503).json({ success: false, message: 'ML service is unavailable' });
  }
};