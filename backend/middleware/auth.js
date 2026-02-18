/**
 * JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');

/**
 * Protect routes — verify JWT token
 */
exports.protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized. Please login.',
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
      next();
    } catch {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.',
      });
    }
  } catch (error) {
    next(error);
  }
};

/**
 * Authorize specific roles
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

/**
 * Optional auth — attaches user if token is valid, continues without error if not
 */
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.userId, email: decoded.email, role: decoded.role };
      } catch {
        req.user = null;
      }
    }
    next();
  } catch (error) {
    next(error);
  }
};