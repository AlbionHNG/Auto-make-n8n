const express = require('express');
const router = express.Router();

const WEAVIATE_URL = 'http://localhost:8080';

// Helper function để gọi Weaviate API
const weaviateAPI = {
  async get(endpoint) {
    const response = await fetch(`${WEAVIATE_URL}${endpoint}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  },

  async post(endpoint, data) {
    const response = await fetch(`${WEAVIATE_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  },

  async put(endpoint, data) {
    const response = await fetch(`${WEAVIATE_URL}${endpoint}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  },

  async delete(endpoint) {
    const response = await fetch(`${WEAVIATE_URL}${endpoint}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.status === 204 ? { success: true } : await response.json();
  }
};

// Health check
router.get('/health', async (req, res) => {
  try {
    const meta = await weaviateAPI.get('/v1/meta');
    res.json({
      service: 'weaviate',
      connected: true,
      version: meta.version,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      service: 'weaviate',
      connected: false,
      error: error.message
    });
  }
});

// Get schema
router.get('/schema', async (req, res) => {
  try {
    const schema = await weaviateAPI.get('/v1/schema');
    res.json({
      classes: schema.classes?.map(cls => ({
        name: cls.class,
        description: cls.description,
        properties: cls.properties?.length || 0,
        propertyNames: cls.properties?.map(prop => prop.name) || []
      })) || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Initialize schema
router.post('/init', async (req, res) => {
  try {
    const classDefinition = {
      class: 'Article',
      description: 'A collection of articles',
      properties: [
        {
          name: 'title',
          dataType: ['text'],
          description: 'Title of the article'
        },
        {
          name: 'content',
          dataType: ['text'],
          description: 'Content of the article'
        },
        {
          name: 'author',
          dataType: ['text'],
          description: 'Author of the article'
        },
        {
          name: 'category',
          dataType: ['text'],
          description: 'Article category'
        },
        {
          name: 'publishedDate',
          dataType: ['date'],
          description: 'Publication date'
        },
        {
          name: 'tags',
          dataType: ['text[]'],
          description: 'Article tags'
        }
      ]
    };  

    await weaviateAPI.post('/v1/schema', classDefinition);
    res.json({ message: 'Article schema created successfully' });
  } catch (error) {
    if (error.message.includes('already exists')) {
      res.json({ message: 'Article schema already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get all articles
router.get('/articles', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    const query = {
      query: `{
        Get {
          Article(limit: ${parseInt(limit)}) {
            title
            content
            author
            category
            publishedDate
            tags
            _additional {
              id
            }
          }
        }
      }`
    };

    const result = await weaviateAPI.post('/v1/graphql', query);
    const articles = result.data?.Get?.Article || [];

    res.json({
      articles: articles.map(article => ({
        id: article._additional?.id,
        ...article
      })),
      count: articles.length,
      limit: parseInt(limit)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new article
router.post('/articles', async (req, res) => {
  try {
    const { title, content, author, category, tags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        error: 'Title and content are required'
      });
    }

    const articleData = {
      class: 'Article',
      properties: {
        title: title.trim(),
        content: content.trim(),
        author: author || 'Anonymous',
        category: category || 'General',
        tags: Array.isArray(tags) ? tags : [],
        publishedDate: new Date().toISOString()
      }
    };

    const result = await weaviateAPI.post('/v1/objects', articleData);

    res.status(201).json({
      message: 'Article created successfully',
      id: result.id,
      data: articleData.properties
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search articles
router.get('/articles/search', async (req, res) => {
  try {
    const { q, category, author, limit = 10 } = req.query;

    let graphqlQuery = `{
      Get {
        Article(limit: ${parseInt(limit)}`;

    // Add text search
    if (q) {
      graphqlQuery += `, nearText: { concepts: ["${q}"] }`;
    }

    // Add where clause for filters
    const whereConditions = [];
    if (category) {
      whereConditions.push(`{ path: ["category"], operator: Equal, valueText: "${category}" }`);
    }
    if (author) {
      whereConditions.push(`{ path: ["author"], operator: Equal, valueText: "${author}" }`);
    }

    if (whereConditions.length > 0) {
      const whereClause = whereConditions.length === 1 ? 
        whereConditions[0] : 
        `{ operator: And, operands: [${whereConditions.join(', ')}] }`;
      
      graphqlQuery += `, where: ${whereClause}`;
    }

    graphqlQuery += `) {
        title
        content
        author
        category
        publishedDate
        tags
        _additional {
          id
          distance
        }
      }
    }
  }`;

    const result = await weaviateAPI.post('/v1/graphql', { query: graphqlQuery });
    const articles = result.data?.Get?.Article || [];

    res.json({
      articles: articles.map(article => ({
        id: article._additional?.id,
        relevance: article._additional?.distance,
        ...article
      })),
      searchQuery: q,
      filters: { category, author },
      count: articles.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update article
router.put('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...req.body };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        delete updateData[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        error: 'No update data provided'
      });
    }

    await weaviateAPI.put(`/v1/objects/${id}`, {
      class: 'Article',
      properties: updateData
    });

    res.json({
      message: 'Article updated successfully',
      id,
      updatedFields: Object.keys(updateData)
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'Article not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete article
router.delete('/articles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await weaviateAPI.delete(`/v1/objects/${id}`);

    res.json({
      message: 'Article deleted successfully',
      id
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: 'Article not found' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Batch import
router.post('/articles/batch', async (req, res) => {
  try {
    const { articles } = req.body;

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(400).json({
        error: 'Articles must be a non-empty array'
      });
    }

    const batchData = {
      objects: articles.map(article => ({
        class: 'Article',
        properties: {
          title: article.title?.trim(),
          content: article.content?.trim(),
          author: article.author || 'Anonymous',
          category: article.category || 'General',
          tags: Array.isArray(article.tags) ? article.tags : [],
          publishedDate: article.publishedDate || new Date().toISOString()
        }
      }))
    };

    const result = await weaviateAPI.post('/v1/batch/objects', batchData);

    res.json({
      message: `Successfully imported ${articles.length} articles`,
      imported: articles.length,
      results: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get stats
router.get('/articles/stats', async (req, res) => {
  try {
    // Get total count
    const countQuery = {
      query: `{
        Aggregate {
          Article {
            meta {
              count
            }
          }
        }
      }`
    };

    const countResult = await weaviateAPI.post('/v1/graphql', countQuery);
    const totalCount = countResult.data?.Aggregate?.Article?.[0]?.meta?.count || 0;

    res.json({
      totalArticles: totalCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;