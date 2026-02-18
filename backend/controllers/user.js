/**
 * User Controller
 * Admin-only user management + dashboard analytics
 */

const prisma = require('../config/database');

/**
 * @desc    Get all users (Admin)
 * @route   GET /api/users
 * @access  Private/Admin
 */
exports.getAllUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, role, search, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where = {};
    if (role) where.role = role.toUpperCase();
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          phone: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        users,
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
 * @desc    Get single user (Admin)
 * @route   GET /api/users/:id
 * @access  Private/Admin
 */
exports.getUserById = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        address: true,
        avatar: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        orders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: { user } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update user role or status (Admin)
 * @route   PUT /api/users/:id
 * @access  Private/Admin
 */
exports.updateUser = async (req, res, next) => {
  try {
    const { role, isActive } = req.body;

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Prevent admin from deactivating themselves
    if (req.user.userId === req.params.id && isActive === false) {
      return res.status(400).json({ success: false, message: 'You cannot deactivate your own account' });
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(role && { role: role.toUpperCase() }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, updatedAt: true,
      },
    });

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: { user: updated },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete user (Admin)
 * @route   DELETE /api/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.user.userId === req.params.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await prisma.user.delete({ where: { id: req.params.id } });

    res.status(200).json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get admin dashboard analytics
 * @route   GET /api/users/admin/dashboard
 * @access  Private/Admin
 */
exports.getDashboardStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      totalOrders,
      totalProducts,
      totalNews,
      recentOrders,
      ordersByStatus,
      revenueResult,
      sentimentBreakdown,
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'USER' } }),
      prisma.order.count(),
      prisma.product.count({ where: { isActive: true } }),
      prisma.news.count({ where: { isPublished: true } }),
      prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      prisma.order.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.order.aggregate({
        where: { status: { notIn: ['CANCELLED', 'REFUNDED'] } },
        _sum: { total: true },
      }),
      prisma.news.groupBy({
        by: ['sentiment'],
        _count: { id: true },
        where: { sentiment: { not: null } },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        stats: {
          totalUsers,
          totalOrders,
          totalProducts,
          totalNews,
          totalRevenue: revenueResult._sum.total || 0,
        },
        ordersByStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.id;
          return acc;
        }, {}),
        sentimentBreakdown: sentimentBreakdown.reduce((acc, item) => {
          acc[item.sentiment] = item._count.id;
          return acc;
        }, {}),
        recentOrders,
      },
    });
  } catch (error) {
    next(error);
  }
};