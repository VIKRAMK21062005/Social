
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

// ─── Route Imports ────────────────────────────────────────────────────────────
const authRoutes    = require('./routes/auth');
const productRoutes = require('./routes/product');
const cartRoutes    = require('./routes/cart');
const orderRoutes   = require('./routes/order');
const newsRoutes    = require('./routes/news');
const userRoutes    = require('./routes/user');
const mlRoutes      = require('./routes/ml');

const errorHandler = require('./middleware/errorHandler');

// ─── App Init ─────────────────────────────────────────────────────────────────
const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV === 'development') {
  app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) =>
  res.status(200).json({
    success: true,
    message: 'Server is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  })
);

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',     authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart',     cartRoutes);
app.use('/api/orders',   orderRoutes);
app.use('/api/news',     newsRoutes);
app.use('/api/users',    userRoutes);
app.use('/api/ml',       mlRoutes);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});


// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   Political E-Commerce Platform  ·  Backend API  ║
╠══════════════════════════════════════════════════╣
║   Server  : http://localhost:${PORT}               ║
║   Env     : ${(process.env.NODE_ENV || 'development').padEnd(38)}║
║   Status  : Running ✓                            ║
╚══════════════════════════════════════════════════╝
  `);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

module.exports = app;