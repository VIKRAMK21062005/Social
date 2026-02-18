/**
 * Order Controller
 * Place orders, list, status management, cancellation
 */

const prisma = require('../config/database');

/**
 * @desc    Place a new order from cart
 * @route   POST /api/orders
 * @access  Private
 */
exports.placeOrder = async (req, res, next) => {
  try {
    const { shippingAddress, paymentMethod, notes } = req.body;

    if (!shippingAddress) {
      return res.status(400).json({ success: false, message: 'Shipping address is required' });
    }

    // Get user's cart with items
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.userId },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    // Validate stock for each item
    for (const item of cart.items) {
      if (!item.product.isActive) {
        return res.status(400).json({
          success: false,
          message: `Product "${item.product.name}" is no longer available`,
        });
      }
      if (item.product.stock < item.quantity) {
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${item.product.name}". Available: ${item.product.stock}`,
        });
      }
    }

    // Calculate total
    const total = cart.items.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0
    );

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          userId: req.user.userId,
          total: Math.round(total * 100) / 100,
          shippingAddress,
          paymentMethod: paymentMethod || 'cod',
          notes,
          items: {
            create: cart.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              price: item.product.price,
              customDesign: item.customDesign,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: { select: { id: true, name: true, imageUrl: true } },
            },
          },
        },
      });

      // Decrement stock for each product
      for (const item of cart.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      // Clear the cart
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: { order },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get current user's orders
 * @route   GET /api/orders
 * @access  Private
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = { userId: req.user.userId };
    if (status) where.status = status.toUpperCase();

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          items: {
            include: { product: { select: { id: true, name: true, imageUrl: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single order by ID
 * @route   GET /api/orders/:id
 * @access  Private
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, imageUrl: true, description: true } },
          },
        },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Users can only see their own orders; admins can see all
    if (req.user.role !== 'ADMIN' && order.userId !== req.user.userId) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.status(200).json({ success: true, data: { order } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel order (by user, only if PENDING)
 * @route   PUT /api/orders/:id/cancel
 * @access  Private
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: { items: true },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId !== req.user.userId && req.user.role !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (!['PENDING', 'CONFIRMED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: 'Order cannot be cancelled at this stage',
      });
    }

    // Restore stock and cancel
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
    });

    res.status(200).json({ success: true, message: 'Order cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── ADMIN ────────────────────────────────────────────────────────────────────

/**
 * @desc    Get all orders (Admin)
 * @route   GET /api/orders/admin/all
 * @access  Private/Admin
 */
exports.getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, userId } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status.toUpperCase();
    if (userId) where.userId = userId;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: {
            include: { product: { select: { id: true, name: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update order status (Admin)
 * @route   PUT /api/orders/admin/:id/status
 * @access  Private/Admin
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { status, paymentStatus } = req.body;

    const validStatuses = [
      'PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED',
    ];

    if (status && !validStatuses.includes(status.toUpperCase())) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const updated = await prisma.order.update({
      where: { id: req.params.id },
      data: {
        ...(status && { status: status.toUpperCase() }),
        ...(paymentStatus && { paymentStatus }),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Order status updated',
      data: { order: updated },
    });
  } catch (error) {
    next(error);
  }
};