/**
 * Product Controller
 * Full CRUD, filtering, pagination, and reviews
 */

const { validationResult } = require('express-validator');
const prisma = require('../config/database');

/**
 * @desc    Get all products with filtering & pagination
 * @route   GET /api/products
 * @access  Public
 */
exports.getAllProducts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where = { isActive: true };
    if (category) where.category = category;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number(minPrice);
      if (maxPrice) where.price.lte = Number(maxPrice);
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: order },
        include: {
          reviews: {
            select: { rating: true },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Attach average rating
    const productsWithRating = products.map((p) => {
      const avgRating =
        p.reviews.length > 0
          ? p.reviews.reduce((sum, r) => sum + r.rating, 0) / p.reviews.length
          : 0;
      const { reviews, ...rest } = p;
      return { ...rest, avgRating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length };
    });

    res.status(200).json({
      success: true,
      data: {
        products: productsWithRating,
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
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
exports.getProductById = async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          include: {
            user: { select: { id: true, name: true, avatar: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const avgRating =
      product.reviews.length > 0
        ? product.reviews.reduce((sum, r) => sum + r.rating, 0) / product.reviews.length
        : 0;

    res.status(200).json({
      success: true,
      data: {
        product: {
          ...product,
          avgRating: Math.round(avgRating * 10) / 10,
          reviewCount: product.reviews.length,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create product (Admin)
 * @route   POST /api/products
 * @access  Private/Admin
 */
exports.createProduct = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { name, description, price, imageUrl, images, category, stock, tags } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price: Number(price),
        imageUrl,
        images: images || [],
        category: category || 'general',
        stock: Number(stock) || 0,
        tags: tags || [],
        createdBy: req.user.userId,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product (Admin)
 * @route   PUT /api/products/:id
 * @access  Private/Admin
 */
exports.updateProduct = async (req, res, next) => {
  try {
    const { name, description, price, imageUrl, images, category, stock, tags, isActive } =
      req.body;

    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(images !== undefined && { images }),
        ...(category !== undefined && { category }),
        ...(stock !== undefined && { stock: Number(stock) }),
        ...(tags !== undefined && { tags }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: { product },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product (Admin) - soft delete
 * @route   DELETE /api/products/:id
 * @access  Private/Admin
 */
exports.deleteProduct = async (req, res, next) => {
  try {
    const existing = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    await prisma.product.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.status(200).json({ success: true, message: 'Product deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add product review
 * @route   POST /api/products/:id/reviews
 * @access  Private
 */
exports.addReview = async (req, res, next) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Upsert review (one per user per product)
    const review = await prisma.review.upsert({
      where: {
        userId_productId: { userId: req.user.userId, productId: req.params.id },
      },
      update: { rating: Number(rating), comment },
      create: {
        userId: req.user.userId,
        productId: req.params.id,
        rating: Number(rating),
        comment,
      },
      include: {
        user: { select: { id: true, name: true, avatar: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully',
      data: { review },
    });
  } catch (error) {
    next(error);
  }
};