/**
 * Cart Controller
 * Manages user shopping cart — view, add, update quantity, remove, clear
 */

const prisma = require('../config/database');

/**
 * @desc    Get user's cart
 * @route   GET /api/cart
 * @access  Private
 */
exports.getCart = async (req, res, next) => {
  try {
    let cart = await prisma.cart.findUnique({
      where: { userId: req.user.userId },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                imageUrl: true,
                stock: true,
                isActive: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    // Create cart if it doesn't exist
    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: req.user.userId },
        include: { items: { include: { product: true } } },
      });
    }

    // Calculate totals
    const subtotal = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    res.status(200).json({
      success: true,
      data: {
        cart: {
          ...cart,
          subtotal: Math.round(subtotal * 100) / 100,
          itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add item to cart
 * @route   POST /api/cart/items
 * @access  Private
 */
exports.addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1, customDesign } = req.body;

    if (!productId) {
      return res.status(400).json({ success: false, message: 'Product ID is required' });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: `Only ${product.stock} items available in stock`,
      });
    }

    // Ensure cart exists
    let cart = await prisma.cart.findUnique({ where: { userId: req.user.userId } });
    if (!cart) {
      cart = await prisma.cart.create({ data: { userId: req.user.userId } });
    }

    // Check if item already in cart (without custom design)
    const existingItem = !customDesign
      ? await prisma.cartItem.findFirst({
          where: { cartId: cart.id, productId, customDesign: null },
        })
      : null;

    let cartItem;
    if (existingItem) {
      const newQty = existingItem.quantity + Number(quantity);
      if (newQty > product.stock) {
        return res.status(400).json({
          success: false,
          message: `Cannot add more — only ${product.stock} in stock`,
        });
      }
      cartItem = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQty },
        include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
      });
    } else {
      cartItem = await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity: Number(quantity),
          customDesign: customDesign || null,
        },
        include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Item added to cart',
      data: { cartItem },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update cart item quantity
 * @route   PUT /api/cart/items/:itemId
 * @access  Private
 */
exports.updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;

    if (!quantity || quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const cart = await prisma.cart.findUnique({ where: { userId: req.user.userId } });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, cartId: cart.id },
      include: { product: true },
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    if (quantity > cartItem.product.stock) {
      return res.status(400).json({
        success: false,
        message: `Only ${cartItem.product.stock} items available`,
      });
    }

    const updated = await prisma.cartItem.update({
      where: { id: req.params.itemId },
      data: { quantity: Number(quantity) },
      include: { product: { select: { id: true, name: true, price: true, imageUrl: true } } },
    });

    res.status(200).json({
      success: true,
      message: 'Cart updated',
      data: { cartItem: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove item from cart
 * @route   DELETE /api/cart/items/:itemId
 * @access  Private
 */
exports.removeFromCart = async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.userId } });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    const cartItem = await prisma.cartItem.findFirst({
      where: { id: req.params.itemId, cartId: cart.id },
    });

    if (!cartItem) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    await prisma.cartItem.delete({ where: { id: req.params.itemId } });

    res.status(200).json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Clear entire cart
 * @route   DELETE /api/cart
 * @access  Private
 */
exports.clearCart = async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.userId } });
    if (!cart) {
      return res.status(404).json({ success: false, message: 'Cart not found' });
    }

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

    res.status(200).json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    next(error);
  }
};