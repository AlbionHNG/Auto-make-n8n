const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = 4000;
const router = express.Router();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));


//Làm sạch baseUrl
function sanitizeBaseUrl(baseUrl) {
    let clean = baseUrl.trim();
      if (!clean.startsWith('http')) 
      {
        clean = `http://${clean}`;
      }
    return clean.replace(/\/$/, '');
    }

// endpoint để test kết nối với n8n
router.post("/api/n8n/test", async (req, res) => {
  try {
    const { apiKey, baseUrl } = req.body;
    
    console.log("Test connection request:", { baseUrl, hasApiKey: !!apiKey });
    
    if (!apiKey || !baseUrl) {
      return res.status(400).json({ 
        success: false,
        error: "Thiếu apiKey hoặc baseUrl" 
      });
    }

    // 
    const cleanBaseUrl = sanitizeBaseUrl(baseUrl);
    
    const apiUrl = `${cleanBaseUrl}/api/v1/workflows`;
    
    console.log("Kết nối thử tới:", apiUrl);
    
    // Thực hiện yêu cầu GET xem có bao nhiêu workflow để kiểm tra kết nối
    const response = await axios.get(apiUrl, {
      headers: {
        'X-N8N-API-KEY': apiKey
      },
      timeout: 10000
    });
    
    console.log("Test successful, response status:", response.status);
    
    res.json({
      success: true,
      message: 'Connection successful',
      workflowCount: response.data?.data?.length || 0,
      n8nVersion: response.headers['x-n8n-version'] || 'unknown'
    });
    
  } catch (error) {
    console.error('N8N Test Error:', error.message);
    console.error('Error details:', {
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    
    let errorResponse = {
      success: false,
      error: 'Connection test failed'
    };
    
    if (error.response) {
      // n8n returned an error response
      errorResponse.error = `n8n returned ${error.response.status}: ${error.response.data?.message || error.response.statusText}`;
      errorResponse.status = error.response.status;
      res.status(error.response.status).json(errorResponse);
    } else if (error.code === 'ECONNREFUSED') {
      errorResponse.error = 'Cannot connect to n8n server. Make sure n8n is running and accessible.';
      errorResponse.code = 'CONNECTION_REFUSED';
      res.status(503).json(errorResponse);
    } else if (error.code === 'ETIMEDOUT') {
      errorResponse.error = 'Request to n8n server timed out.';
      errorResponse.code = 'TIMEOUT';
      res.status(504).json(errorResponse);
    } else if (error.code === 'ENOTFOUND') {
      errorResponse.error = 'Cannot resolve n8n server hostname. Check the URL.';
      errorResponse.code = 'DNS_ERROR';
      res.status(505).json(errorResponse);
    } else {
      errorResponse.error = error.message || 'Unknown connection error';
      res.status(500).json(errorResponse);
    }
  }
});

// endpoint để tạo workflow mới
router.post("/api/n8n/workflows", async (req, res) => {
  try {
    const { apiKey, baseUrl, workflowData } = req.body;
    
    console.log("Create workflow request:", { 
      baseUrl, 
      hasApiKey: !!apiKey, 
      hasWorkflowData: !!workflowData,
      workflowName: workflowData?.name
    });

    //console.log("Raw workflowData:", JSON.stringify(workflowData, null, 2)); log ra toàn bộ workflow nhưng xóa đi cho đỡ dài
    // Kiểm tra các trường bắt buộc
    if (!apiKey || !baseUrl || !workflowData) {
      return res.status(400).json({ 
        success: false,
        error: "Thiếu trường cần thiết: apiKey, baseUrl, workflowData" 
      });
    }
    //Đưa lên baseUrl
    const cleanBaseUrl = sanitizeBaseUrl(baseUrl);
    //Tạo apiUrl
    const apiUrl = `${cleanBaseUrl}/api/v1/workflows`;

    //Chuẩn bị dữ liệu workflow
    const cleanWorkflowData = {
      name: workflowData.name || 'Imported Workflow', // Bắt buộc có tên
      nodes: workflowData.nodes || [], // Bắt buộc có nodes
      connections: workflowData.connections || {}, // Bắt buộc có connections
      settings: typeof workflowData.settings === 'object' ? workflowData.settings : {},// Bắt buộc có settings là object
    };

    if (workflowData.staticData) {
      cleanWorkflowData.staticData = workflowData.staticData; // Giữ nguyên staticData nếu có
    }
    if (workflowData.tags && workflowData.tags.length > 0) {
      cleanWorkflowData.tags = workflowData.tags; // Giữ nguyên tags nếu có
    }
    if (workflowData.pinData && Object.keys(workflowData.pinData).length > 0) {
      cleanWorkflowData.pinData = workflowData.pinData;
    }

    // Log final workflow data
    console.log("Final workflow data keys:", Object.keys(cleanWorkflowData));
    console.log("Workflow details:", {
      name: cleanWorkflowData.name,
      nodeCount: cleanWorkflowData.nodes?.length || 0,
      active: cleanWorkflowData.active,
      settings: cleanWorkflowData.settings,
      hasPinData: !!cleanWorkflowData.pinData,
      tagCount: cleanWorkflowData.tags?.length || 0
    });
    // Gửi yêu cầu lên n8n để tạo workflow mới
    const response = await axios.post(apiUrl, cleanWorkflowData, {
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey
      },
      timeout: 30000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });
    
    const createdWorkflow = response.data;
    console.log("Workflow created successfully:", createdWorkflow?.id);

    res.json({
      success: true,
      data: createdWorkflow,
      message: 'Workflow created successfully'
    });

  } catch (error) {
    console.error('N8N API Error:', error.message);
    console.error('Error details:', {
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });

    let errorResponse = {
      success: false,
      error: 'Failed to create workflow'
    };

    if (error.response) {
      const errorData = error.response.data;
      errorResponse.error = errorData?.message || errorData?.error || `n8n API error: ${error.response.status}`;
      errorResponse.status = error.response.status;
      errorResponse.details = errorData;
      res.status(error.response.status).json(errorResponse);
    } else if (error.code === 'ECONNREFUSED') {
      errorResponse.error = 'Cannot connect to n8n server. Make sure n8n is running.';
      errorResponse.code = 'CONNECTION_REFUSED';
      res.status(503).json(errorResponse);
    } else if (error.code === 'ETIMEDOUT') {
      errorResponse.error = 'Request to n8n server timed out.';
      errorResponse.code = 'TIMEOUT';
      res.status(504).json(errorResponse);
    } else if (error.code === 'ENOTFOUND') {
      errorResponse.error = 'Cannot resolve n8n server hostname. Check the URL.';
      errorResponse.code = 'DNS_ERROR';
      res.status(505).json(errorResponse);
    } else {
      errorResponse.error = error.message || 'Unknown error occurred';
      res.status(500).json(errorResponse);
    }
  }
});

// Bật proxy server
app.listen(port, () => {  
  console.log(`Server running at http://localhost:${port}`);
});

module.exports = router;