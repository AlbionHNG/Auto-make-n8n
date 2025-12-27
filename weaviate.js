const express = require('express');
const router = express.Router();
const {OpenAI} = require('openai');
const dotenv = require('dotenv');

router.get('/', (req, res) => {
  res.sendFile('/UI.html', { root: __dirname });
});
// URL của Weaviate
const WEAVIATE_URL = 'http://localhost:8080';
// Load biến môi trường từ .env
dotenv.config();
// Khởi tạo OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
// Tạo endpoint cho mấy api khác
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

// api kiểm tra kết nối
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
//tạo schema mới
router.post('/schema', async (req, res) => {
  try {
    const schema = req.body;
    const result = await weaviateAPI.post('/v1/schema', schema);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      service: 'weaviate',
      connected: false,
      error: error.message
    }); 
  }
});
//lấy schema theo tên class
router.get('/schema/:className', async (req, res) => {
  try {
    const { className } = req.params;
    const result = await weaviateAPI.get(`/v1/schema/${className}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({"error": error.message});
  }
});

//xóa schema theo tên class
router.delete('/schema/:className', async (req, res) => {
  try {
    const {className} = req.params;
    const result = await (weaviateAPI.delete(`/v1/schema/${className}`));
    res.json(result)
  } catch (error) {
    res.status(500).json(`Lỗi ${error.message}`)
  }
});

//cập nhật cả schema
router.put('/schema/:className', async(req, res) =>{
  try {
    const schema = req.body;
    const className = req.className;
    const result = await(weaviateAPI.put(`/v1/schema/${className}`, schema));
    res.json(result)
  } catch (error) {
     res.status(500).join(`Lỗi ${error.message}`)
  }
});

//Lấy toàn bộ ojb của một class
router.get('/objects/:className', async (req, res) => {
  try {
    const { className } = req.params;
    const result = await weaviateAPI.get(`/v1/objects?class=${className}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//Tạo obj cho một class
router.post('/objects/:className', async(req, res)=>{
  try {
    const {className} = req.params;
    const objectData = req.body;
    const result = await weaviateAPI.post(`/objects/${className}`, objectData);
    res.json(result);
  } catch (error) {
    res.status(500).json({"error": error.message});
  }
});

//Lấy obj theo ID
router.get('/objects/:className/:id', async(req, res)=>{
  try {
    const {className, id} = req.params;
    const result = await weaviateAPI.get(`/objects/${className}/${id}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({"error": error.message});
  }
});
//Cập nhật obj theo ID
router.put('/objects/:className/:id', async(req, res)=>{
  try {
    const {className, id} = req.params;
    const objectData = req.body;
    const result = await weaviateAPI.put(`/objects/${className}/${id}`, objectData);
    res.json(result);
  } catch (error) {
    res.status(500).json({"error": error.message});
  }
});

//Xóa obj theo ID
router.delete('/objects/:className/:id', async(req, res)=>{
  try { 
    const {className, id} = req.params;
    const result = await weaviateAPI.delete(`/objects/${className}/${id}`);
    res.json(result);
  } catch (error) {
    res.status(500).json({"error": error.message});
  }
});
//lấy schema của apicontroler

// Initialize schema
router.post('/ApiControler', async (req, res) => {
  try {
    const schema = 'CompaniesAPI';
    await weaviateAPI.post('/v1/schema', schema);
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
router.get('/GetAPI', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const query = {
      query: `{
        Get {
          API_LIBRARY(limit: ${parseInt(limit)}) {
            api_Name
            api_URL
            description
            parameter
            method
            category
            publishedDate
            _additional {
              id
              vector
            }
          }
        }
      }`
    };

    const result = await weaviateAPI.post('/v1/graphql', query);
    const data = result?.data?.data || result?.data || result;

    const APIData = data?.Get?.API_LIBRARY || [];

    res.json({
      data: {
        Get: {
          API_LIBRARY: APIData
        }
      },
      count: APIData.length,
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('❌ Lỗi GetAPI:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Create new article
router.post('/NEW_API', async (req, res) => {
  try {
    const { api_URL, api_Name, description, parameter, method, category } = req.body;

    if (!api_URL || !api_Name || !description || !parameter || !method || !category) {
      console.log('❌ Lỗi NEW_API: Tất cả các trường là bắt buộc');
      return res.status(400).json({
        error: 'All fields are required'
      });
    }
    const ApiData = {
      class: 'API_LIBRARY',
      properties: {
        api_URL: api_URL.trim(),
        api_Name: api_Name.trim(),
        description: description.trim() || 'Không có',
        parameter: parameter.trim(),
        method: method.trim(),
        category: category.trim(),
        publishedDate: new Date().toISOString()
      }
    };

    const result = await weaviateAPI.post('/v1/objects', ApiData);

    res.status(201).json({
      message: 'Article created successfully',
      id: result.id,
      data: ApiData.properties
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// Delete article
router.delete('/DeleteAPI/:id', async (req, res) => {
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


// Get all articles
router.get('/GetNode', async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const query = {
      query: `{
        Get {
          N8N_Nodes(limit: ${parseInt(limit)}) {
            node_Name
            operator
            description
            method
            jsonCode
            publishedDate
            _additional {
              id
            }
          }
        }
      }`
    };
    const result = await weaviateAPI.post('/v1/graphql', query);
    const data = result?.data?.data || result?.data || result;
    const NodesData = data?.Get?.N8N_Nodes || [];

    res.json({
      data: {
        Get: {
          N8N_Nodes: NodesData
        }
      },
      count: NodesData.length,
      limit: parseInt(limit)
    });

  } catch (error) {
    console.error('❌ Lỗi GetAPI:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Tạo node mới 
router.post('/NEW_NODE', async (req, res) => {
  try {
    const { node_Name, operator, description, jsonCode, method } = req.body;

    if (!node_Name || !description || !jsonCode) {
      console.log('❌ Lỗi NEW_NODE: Thiếu trường bắt buộc');
      return res.status(400).json({ error: 'All fields are required' });
    }

    const textToEmbed = `${node_Name} ${description} ${method} ${operator}`;
    console.log('vector hóa text:', textToEmbed);
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: textToEmbed,
    });

    const vector = embeddingResponse.data[0].embedding;
    console.log('✅ Vector hóa thành công cho node:', vector);

    const NodeData = {
      class: 'N8N_Nodes',
      vector: vector,
      properties: {
        node_Name: node_Name.trim(),
        operator: operator?.trim() || '',
        description: description.trim(),
        method: method?.trim() || '',
        jsonCode: jsonCode.trim(),
        publishedDate: new Date().toISOString(),
      },
    };
    console.log('🚀 Dữ liệu node chuẩn bị gửi đến Weaviate:', NodeData);

    // Gửi object đến Weaviate
    const result = await weaviateAPI.post('/v1/objects', NodeData);

    res.status(201).json({
      message: '✅ Node tạo thành công và đã vector hóa',
      id: result.data?.id,
      data: NodeData.properties,
    });

  } catch (error) {
    console.error('❌ Lỗi khi tạo node:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete Node
router.delete('/DeleteNode/:id', async (req, res) => {
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

// Tìm kiếm node theo từ khóa
router.get('/SearchNode', async (req, res) => {
    try {
        const { keyword, limit = 20 } = req.query;
        console.log('🔍 Tìm kiếm node với từ khóa:', keyword);
        if (!keyword || keyword.trim() === '') {
            return res.json({
                success: false,
                error: 'Vui lòng nhập từ khóa tìm kiếm'
            });
        }

        const trimmedKeyword = keyword.trim();
        const limitNum = parseInt(limit) || 20;

        // Tạo truy vấn GraphQL
        const graphqlQuery = `{
            Get {
                N8N_Nodes(
                    limit: ${limitNum},
                    where: {
                        operator: Or,
                        operands: [
                            {
                                operator: Like,
                                path: ["node_Name"],
                                valueText: "*${keyword}*"
                            },
                            {
                                operator: Like,
                                path: ["method"],
                                valueText: "*${keyword}*"
                            }
                        ]
                    }
                ) {
                    node_Name
                    operator
                    description
                    method
                    jsonCode
                    publishedDate
                    _additional {
                        id
                    }
                }
            }
        }`;

        // Gửi tới Weaviate
        const result = await weaviateAPI.post('/v1/graphql', { query: graphqlQuery });
        console.log('✅ Kết quả tìm kiếm từ Weaviate:', JSON.stringify(result.data, null, 2));
        const nodes = result.data?.Get?.N8N_Nodes || [];
        console.log(`🔍 Tìm thấy ${nodes.length} node(s) phù hợp với từ khóa "${keyword}":`);

        // Thêm id vào từng node
        const nodesWithId = nodes.map(node => ({
            ...node,
            id: node._additional?.id
        }));

        res.json({
            success: true,
            data: nodesWithId,
            count: nodesWithId.length,
            searchQuery: trimmedKeyword,
            limit: limitNum
        });

    } catch (error) {
        console.error('❌ Lỗi tìm kiếm node:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Lỗi server'
        });
    }
});




module.exports = router