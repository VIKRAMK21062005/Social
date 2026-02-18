/**
 * Cart Routes
 */

const express = require('express');
const router = express.Router();

const { getCart, addToCart, updateCartItem, removeFromCart, clearCart } = require('../controllers/cart');
const { protect } = require('../middleware/auth');

router.use(protect); // All cart routes require authentication

router.get('/', getCart);
router.post('/items', addToCart);
router.put('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeFromCart);
router.delete('/', clearCart);

module.exports = router;