/**
 * Global Error Handler Middleware
 */

const errorHandler = (err, req, res, next) => {
  let error = { ...err, message: err.message };

  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Prisma errors
  if (err.code === 'P2002') error = { message: 'Duplicate field value', statusCode: 400 };
  if (err.code === 'P2025') error = { message: 'Record not found', statusCode: 404 };
  if (err.code === 'P2003') error = { message: 'Invalid input data', statusCode: 400 };
  if (err.code === 'P2014') error = { message: 'Related record required', statusCode: 400 };

  // JWT errors
  if (err.name === 'JsonWebTokenError') error = { message: 'Invalid token', statusCode: 401 };
  if (err.name === 'TokenExpiredError') error = { message: 'Token expired', statusCode: 401 };

  // Validation errors
  if (err.name === 'ValidationError') {
    error = {
      message: Object.values(err.errors).map((e) => e.message).join(', '),
      statusCode: 400,
    };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;