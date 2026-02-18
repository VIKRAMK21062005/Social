/**
 * News Controller
 * CRUD for news articles with ML sentiment enrichment
 */

const axios = require('axios');
const prisma = require('../config/database');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

/**
 * Helper: call ML service for sentiment analysis
 */
const analyzeSentiment = async (text) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/sentiment`,
      { text },
      { timeout: 15000 }
    );
    return response.data;
  } catch {
    return null;
  }
};

/**
 * Helper: call ML service for fake news detection
 */
const detectFakeNews = async (text, title) => {
  try {
    const response = await axios.post(
      `${ML_SERVICE_URL}/api/fake-news`,
      { text, title },
      { timeout: 15000 }
    );
    return response.data;
  } catch {
    return null;
  }
};

/**
 * @desc    Get all published news with filters
 * @route   GET /api/news
 * @access  Public
 */
exports.getAllNews = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      category,
      sentiment,
      search,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    const skip = (Number(page) - 1) * Number(limit);

    const where = { isPublished: true };
    if (category) where.category = category;
    if (sentiment) where.sentiment = sentiment;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [news, total] = await Promise.all([
      prisma.news.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { [sortBy]: order },
        select: {
          id: true,
          title: true,
          summary: true,
          imageUrl: true,
          category: true,
          tags: true,
          sentiment: true,
          sentimentScore: true,
          isFake: true,
          fakeScore: true,
          createdAt: true,
        },
      }),
      prisma.news.count({ where }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        news,
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
 * @desc    Get single news article
 * @route   GET /api/news/:id
 * @access  Public
 */
exports.getNewsById = async (req, res, next) => {
  try {
    const article = await prisma.news.findUnique({ where: { id: req.params.id } });

    if (!article || !article.isPublished) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    res.status(200).json({ success: true, data: { article } });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create news article (Admin) — auto-runs ML analysis
 * @route   POST /api/news
 * @access  Private/Admin
 */
exports.createNews = async (req, res, next) => {
  try {
    const { title, content, summary, imageUrl, sourceUrl, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Title and content are required' });
    }

    // Run ML analysis in parallel
    const [sentimentResult, fakeResult] = await Promise.all([
      analyzeSentiment(content),
      detectFakeNews(content, title),
    ]);

    const article = await prisma.news.create({
      data: {
        title,
        content,
        summary: summary || content.substring(0, 200),
        imageUrl,
        sourceUrl,
        category: category || 'politics',
        tags: tags || [],
        createdBy: req.user.userId,
        // ML results
        sentiment: sentimentResult?.sentiment || null,
        sentimentScore: sentimentResult?.score || null,
        isFake: fakeResult?.is_fake ?? null,
        fakeScore: fakeResult?.score || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Article created successfully',
      data: { article },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update news article (Admin)
 * @route   PUT /api/news/:id
 * @access  Private/Admin
 */
exports.updateNews = async (req, res, next) => {
  try {
    const { title, content, summary, imageUrl, sourceUrl, category, tags, isPublished } =
      req.body;

    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    // Re-run ML if content changed
    let mlUpdates = {};
    if (content && content !== existing.content) {
      const [sentimentResult, fakeResult] = await Promise.all([
        analyzeSentiment(content),
        detectFakeNews(content, title || existing.title),
      ]);
      mlUpdates = {
        sentiment: sentimentResult?.sentiment || existing.sentiment,
        sentimentScore: sentimentResult?.score ?? existing.sentimentScore,
        isFake: fakeResult?.is_fake ?? existing.isFake,
        fakeScore: fakeResult?.score ?? existing.fakeScore,
      };
    }

    const article = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(summary !== undefined && { summary }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(sourceUrl !== undefined && { sourceUrl }),
        ...(category !== undefined && { category }),
        ...(tags !== undefined && { tags }),
        ...(isPublished !== undefined && { isPublished }),
        ...mlUpdates,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Article updated successfully',
      data: { article },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete news article (Admin)
 * @route   DELETE /api/news/:id
 * @access  Private/Admin
 */
exports.deleteNews = async (req, res, next) => {
  try {
    const existing = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    await prisma.news.delete({ where: { id: req.params.id } });

    res.status(200).json({ success: true, message: 'Article deleted successfully' });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Re-analyze article with ML (Admin)
 * @route   POST /api/news/:id/analyze
 * @access  Private/Admin
 */
exports.reAnalyzeNews = async (req, res, next) => {
  try {
    const article = await prisma.news.findUnique({ where: { id: req.params.id } });
    if (!article) {
      return res.status(404).json({ success: false, message: 'Article not found' });
    }

    const [sentimentResult, fakeResult] = await Promise.all([
      analyzeSentiment(article.content),
      detectFakeNews(article.content, article.title),
    ]);

    const updated = await prisma.news.update({
      where: { id: req.params.id },
      data: {
        sentiment: sentimentResult?.sentiment || null,
        sentimentScore: sentimentResult?.score || null,
        isFake: fakeResult?.is_fake ?? null,
        fakeScore: fakeResult?.score || null,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Article re-analyzed',
      data: { article: updated },
    });
  } catch (error) {
    next(error);
  }
};