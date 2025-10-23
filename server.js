const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs')
const { OpenAI } = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const { Pinecone } = require('@pinecone-database/pinecone');
const mongoose = require('mongoose');
const ChatHistory = require('./chatHistory');
const WeaviateManerger = require('./weaviate.js');
const proxyRoutes = require('./proxy.js');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');
const cors = require('cors');

// CORS
app.use(cors({
    origin: 'http://localhost:3000', // Cho phép origin từ ứng dụng frontend
}));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'main.html'));
});

app.use(express.static(path.join(__dirname, 'public')));


app.use(express.json({ limit: '10mb' }));
app.use('/n8n_connect/api', proxyRoutes);
app.use('/', WeaviateManerger);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

mongoose.connect('mongodb://localhost:27017/chatbot')
    .then(() => console.log('AI Đã có não để nhớ'))
    .catch(err => console.error('MongoDB lỗi rồi, mất trí nhớ rồi!', err));

dotenv.config();

const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Function để extract JSON từ respond của ai
function extractJsonFromText(text) {//Lấy từ const detectedJsonBlocks = extractJsonFromText(aiMessage.content);
    const jsonBlockRegex = /```json\s*([\s\S]*?)```/gi;//Tìm bọc trong markdown
    const jsonBlocks = [];
    let match;

    while ((match = jsonBlockRegex.exec(text)) !== null) {
        try {
            const jsonData = JSON.parse(match[1]);
            if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
                jsonBlocks.push({
                    raw: match[1],
                    parsed: jsonData,
                    startIndex: match.index,
                    endIndex: match.index + match[0].length
                });
            }
        } catch (e) {
            // Không phải JSON hợp lệ, bỏ qua
        }
    }

    if (jsonBlocks.length === 0) {
        const jsonObjectRegex = /\{[\s\S]*?"nodes"\s*:\s*\[[\s\S]*?\]\s*[\s\S]*?\}/g;//tim ko bọc trong markdown
        while ((match = jsonObjectRegex.exec(text)) !== null) {
            try {
                const jsonData = JSON.parse(match[0]);
                if (jsonData.nodes && Array.isArray(jsonData.nodes)) {
                    jsonBlocks.push({
                        raw: match[0],
                        parsed: jsonData,
                        startIndex: match.index,
                        endIndex: match.index + match[0].length
                    });
                }
            } catch (e) {
                // Không phải JSON hợp lệ, bỏ qua
            }
        }
    }

    return jsonBlocks;
}
// Clean node để nó ko hiện n8n nodes-base hay @n8n j đó nữa
function cleanNodeType(nodeType) {
    if (!nodeType) return 'Unknown';

    let cleanType = nodeType
        .replace(/^n8n-nodes-base\./, '')
        .replace(/^@n8n\//, '')
        .replace(/^n8n-/, '');

    cleanType = cleanType
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    // Map một số tên node phổ biến sang tên thân thiện hơn
    const typeMap = {
        'Http Request': 'HTTP Request',
        'Http Webhook': 'HTTP Webhook',
        'If': 'IF',
        'Set': 'Set',
        'Code': 'Code',
        'Merge': 'Merge',
        'Wait': 'Wait',
        'Schedule Trigger': 'Schedule',
        'Manual Trigger': 'Manual',
        'Webhook': 'Webhook'
    };

    return typeMap[cleanType] || cleanType;
}
// Thêm thông tin node vào label trong Mermaid
function enhanceNodeLabels(mermaidCode, workflowData) {//lấy từ code của convertJsonToMermaid
    if (!workflowData || !workflowData.nodes) return mermaidCode;

    const nodeMap = {};
    workflowData.nodes.forEach(node => {
        nodeMap[node.id] = {
            name: node.name || '',
            type: cleanNodeType(node.type),
            operation: node.parameters?.operation || '',
            event: node.parameters?.event || '',
        };
    });

    const enhancedCode = mermaidCode.replace(/([A-Za-z0-9_-]+)(?:\["([^"]*)"\])?/g, (match, nodeId, currentLabel) => {
        const nodeInfo = nodeMap[nodeId];
        if (!nodeInfo) return match;

        if (/-->|==>|<-|->/.test(match)) return match;

        let suffix = '';
        if (nodeInfo.operation && nodeInfo.event) {
            suffix = `${nodeInfo.operation}/${nodeInfo.event}`;
        } else if (nodeInfo.operation || nodeInfo.event) {
            suffix = nodeInfo.operation || nodeInfo.event;
        }

        let label = '';
        if (nodeInfo.name !== nodeInfo.type && nodeInfo.name !== nodeId) {
            label = `${nodeInfo.name}  (${nodeInfo.type})\\n${suffix}`;
        } else {
            label = `${nodeInfo.type}\\n${suffix}`;
        }

        return `${nodeId}["${label}"]`;
    });

    return enhancedCode;
}

// Function để convert JSON thành Mermaid (chuyển tại server khi đăng)
async function convertJsonToMermaid(workflowData) {//Lấy từ lời gọi hàm const mermaidCode = await convertJsonToMermaid(block.parsed);
    const payload = {
        workflow_data: workflowData,
        params: {
            direction: 'LR',
            subgraph_direction: 'BT',
            show_credentials: false,
            show_key_parameters: true,
            subgraph_display_mode: 'subgraph'
        }
    };

    try {
        const res = await fetch('https://api-n8nmermaid.janwillemaltink.com/v2/mermaid/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error('API error: ' + JSON.stringify(data));
        }

        let code = data.mermaid_code || (data.diagrams && data.diagrams.main);
        if (!code) {
            throw new Error('No Mermaid code returned.');
        }

        // Clean up code
        code = code
            .replace(/([^\s@]+)@\{[^}]*label:\s*"([^"]+)"[^}]*\}/g, '$1["$2"]')
            .replace(/([^\s@]+)@\{[^}]*\}/g, '$1')
            .replace(/%%.*$/gm, '')
            .trim();
        code = enhanceNodeLabels(code, workflowData);// Thêm thông tin node vào label trong Mermaid
        return code;
    } catch (error) {
        throw error;
    }
}

// API lấy danh sách sessions
app.get('/sessions', async (req, res) => {
    try {
        const sessions = await ChatHistory.find({}, {
            sessionId: 1,
            sessionName: 1,
            createdAt: 1,
            updatedAt: 1,
            messages: 1,
        }).sort({ updatedAt: -1 });

        // Tính số lượng tin nhắn cho mỗi session
        const sessionsWithCount = sessions.map(session => ({
            sessionId: session.sessionId,
            sessionName: session.sessionName,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: session.messages ? session.messages.filter(msg =>
                msg.role === 'user' || msg.role === 'assistant'
            ).length : 0
        }));

        res.json({
            success: true,
            sessions: sessionsWithCount
        });
    } catch (err) {
        console.error('Lỗi khi lấy danh sách sessions:', err);
        res.status(500).json({ success: false, error: 'Lỗi server' });
    }
});

// API tạo session mới
app.post('/sessions/create', async (req, res) => {
    try {
        const { sessionName } = req.body;//Tạo name = null đc gửi
        const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);//Tạo sessionid
        //Tạo chat
        const newSession = new ChatHistory({
            sessionId: newSessionId,
            sessionName: sessionName || `Chat ${new Date().toLocaleDateString('vi-VN')}`,
            messages: [
                {
                    role: 'system',
                    content: `Bạn là một trợ lý AI chuyên về n8n. Khi viết code json n8n hãy luôn để nó bên trong \`\`\`json \`\`\`. Dưới đây là tài liệu tham khảo:\n${guildKnowledge}.`
                }
            ]
        });

        await newSession.save();//lưu
        //Gửi lại cho client tức createNewSession
        res.json({
            success: true,
            sessionId: newSessionId,
            sessionName: newSession.sessionName,
            message: 'Tạo session mới thành công'
        });
    } catch (err) {
        console.error('Lỗi khi tạo session:', err);
        res.status(500).json({ success: false, error: 'Không thể tạo session mới' });
    }
});

// API đổi tên session
app.put('/sessions/:sessionId/rename', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { newName } = req.body;

        if (!newName || newName.trim() === '') {
            return res.status(400).json({ success: false, error: 'Tên session không được để trống' });
        }

        const session = await ChatHistory.findOneAndUpdate(
            { sessionId },//filler
            { sessionName: newName.trim() },//kẻ được chọn
            { new: true }
        );

        if (!session) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy session' });
        }

        res.json({
            success: true,
            sessionId,
            sessionName: session.sessionName,
            message: 'Đổi tên session thành công'
        });
    } catch (err) {
        console.error('Lỗi khi đổi tên session:', err);
        res.status(500).json({ success: false, error: 'Không thể đổi tên session' });
    }
});

// API xóa session
app.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        const deletedSession = await ChatHistory.findOneAndDelete({ sessionId });

        if (!deletedSession) {
            return res.status(404).json({ success: false, error: 'Không tìm thấy session' });
        }

        res.json({
            success: true,
            message: 'Xóa session thành công'
        });
    } catch (err) {
        console.error('Lỗi khi xóa session:', err);
        res.status(500).json({ success: false, error: 'Không thể xóa session' });
    }
});
//Lấy lịch sử chata
app.get('/history', async (req, res) => {
    try {
        const sessionId = req.query.sessionId;
        console.log('📖 Loading history for sessionId:', sessionId);

        if (!sessionId) return res.status(400).json({ error: 'Thiếu sessionId' });

        const history = await ChatHistory.findOne({ sessionId });
        if (!history) {
            console.log('📖 Không tìm thấy lịch sử cho sessionId:', sessionId);
            return res.json({ messages: [] });
        }

        //Trả về tin nhắn user và assistant
        const historyMessages = history.messages
            .filter(msg => msg.role === 'user' || msg.role === 'assistant')
            .map(msg => ({
                role: msg.role,
                content: msg.content,
                metadata: msg.metadata || {} // Trả về metadata để client render lại
            }));

        console.log('📖 Trả về', historyMessages.length, 'tin nhắn với metadata');
        res.json({ messages: historyMessages });
    } catch (err) {
        console.error('Lỗi khi lấy lịch sử:', err);
        res.status(500).json({ error: 'Lỗi server khi lấy lịch sử' });
    }
});

// Load guild docs
async function loadGuildDocs() {
    const baseDir = path.join(__dirname, 'n8n_guilds');
    const Rule = fs.readFileSync(path.join(baseDir, 'rulebuteng'), 'utf-8');
    return `Đây là quy tác trả lời:\n${Rule}.`
}

let guildKnowledge = '';
loadGuildDocs().then(data => {
    guildKnowledge = data;
    console.log('✅ Loaded n8n guild docs');
});

//Xử lý tin nhắn
app.post('/chat', upload.single('image'), async (req, res) => {
    try {
        const userPrompt = req.body.prompt || '';
        const sessionId = req.body.sessionId

        let history = await ChatHistory.findOne({ sessionId });
        if (!history) {
            history = new ChatHistory({
                sessionId,
                messages: [
                    {
                        role: 'system',
                        content: `Bạn là một trợ lý AI chuyên về n8n. Khi viết code json n8n hãy luôn để nó bên trong \`\`\`json \`\`\`. Dưới đây là tài liệu tham khảo:\n${guildKnowledge}.`

                    }
                ]
            });
        }
        // Tạo user message với metadata
        let userMessage = {
            role: 'user',
            content: userPrompt,
            metadata: {
                detectedJsonBlocks: [],
                hasFile: false,
                fileInfo: null
            }
        };

        if (req.file) {

            if (req.file.mimetype.startsWith('image/')) {
                const base64Image = fs.readFileSync(req.file.path, { encoding: 'base64' });
                userMessage.content = [
                    { type: 'text', text: userPrompt },
                    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                ];

                // lưu ảnh vào metadata
                userMessage.metadata.fileInfo = {
                    type: 'image',
                    name: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    base64Data: `data:${req.file.mimetype};base64,${base64Image}`,
                };
            } else {
                let fileData = "";

                switch (req.file.mimetype) {
                    case 'application/pdf':
                        const pdfBuffer = fs.readFileSync(req.file.path);
                        const pdfData = await pdfParse(pdfBuffer);
                        fileData = pdfData.text;
                        break;

                    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': // docx
                        const docxBuffer = fs.readFileSync(req.file.path);
                        const docxResult = await mammoth.extractRawText({ buffer: docxBuffer });
                        fileData = docxResult.value;
                        break;

                    case 'text/plain':
                        fileData = fs.readFileSync(req.file.path, 'utf8');//txt
                        break;

                    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': // xlsx
                        const workbook = xlsx.readFile(req.file.path);
                        const sheetName = workbook.SheetNames[0];
                        fileData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                        break;

                    default:
                        fileData = "[⚠️ Loại file chưa hỗ trợ đọc trực tiếp]";
                }

                userMessage.content = [
                    { type: 'text', text: userPrompt },
                    {
                        type: 'text',
                        text: `📄 Tệp: ${req.file.originalname} (${req.file.size} bytes)\n\nNội dung:\n${fileData}`
                    }
                ];

                // lưu thông tin file
                userMessage.metadata.fileInfo = {
                    type: 'document',
                    name: req.file.originalname,
                    mimetype: req.file.mimetype,
                    size: req.file.size,
                    content: fileData
                };
            }
            userMessage.metadata.hasFile = true;
            fs.unlinkSync(req.file.path); // Xóa file tạm sau khi đọc
        }

        // Thêm user message vào history
        history.messages.push(userMessage);

        // Giới hạn lại lịch sử
        let limitedMessages = [];
        if (history.messages.length > 0) {
            const systemMsg = history.messages.find(msg => msg.role === 'system');
            const otherMsgs = history.messages.filter(msg => msg.role !== 'system');
            const lastMessages = otherMsgs.slice(-10);
            limitedMessages = systemMsg ? [systemMsg, ...lastMessages] : lastMessages;
        }

        //Tạo tool
        const tools = [
            {
                type: "function",
                function: {
                    name: "searchAPI",
                    description: "Tra cứu những api đã tạo trong thư viên api",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Câu hỏi hoặc từ khóa để tìm trong thư viện API"
                            },
                            topK: {
                                type: "number",
                                description: "Số lượng kết quả cần lấy",
                                default: 5
                            }
                        },
                        required: ["query"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "searchNode",
                    description: "Tra cứu thông tin node trong Weaviate",
                    parameters: {
                        type: "object",
                        properties: {
                            query: {
                                type: "string",
                                description: "Chỉ cần dùng tên của node đá ví dụ HTTP Request"
                            },
                            topK: {
                                type: "number",
                                description: "Số lượng kết quả cần lấy",
                                default: 10
                            }
                        },
                        required: ["query"]
                    }
                }
            }
        ];

        // Gửi lên OpenAI
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-5-mini",
            messages: limitedMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            })),
            tools: tools,//set tool
            max_completion_tokens: 3000
        });
        //Respond của openai, có thể là trả lời trực tiếp hoặc call toool
        const choice = chatCompletion.choices[0].message;

        //nếu dùng tool
        let aiMessage;

        if (choice.tool_calls) {
            console.log("AI đã dùng tool:", JSON.stringify(choice, null, 2));

            const toolResponses = [];

            for (const toolCall of choice.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                let toolData = "";

                if (toolCall.function.name === "searchNode") {
                    console.log('AI chọn tool searchNode');
                    const graphqlQuery = {
                        query: `{
                                Get {
                                    N8N_Nodes(
                                        limit: ${parseInt(args.topK)},
                                        where: {
                                            operator: Or,
                                            operands: [{
                                                operator: Like,
                                                path: ["node_Name"],
                                                valueText: "*${args.query}*"
                                            }]
                                        }
                                    ) {
                                        node_Name
                                        operator
                                        jsonCode
                                        description
                                        method
                                        publishedDate
                                        _additional { id }
                                    }
                                }
                            }`
                    };

                    const res = await fetch("http://localhost:8080/v1/graphql", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(graphqlQuery),
                    });

                    const data = await res.json();
                    const matches = data?.data?.Get?.N8N_Nodes || [];
                    toolData = matches.map(m => `
                            Node: ${m.node_Name}
                            Operator: ${m.operator}
                            Mô tả: ${m.description}
                            Method: ${m.method}
                            Json Code: ${m.jsonCode}
            `).join("\n\n");
                }
                else if (toolCall.function.name === "searchAPI") {
                    console.log('AI chọn tool searchAPI');
                    const graphqlQuery = {
                        query: `{
                                Get {
                                    API_LIBRARY(
                                        limit: ${parseInt(args.topK)},
                                        where: {
                                            operator: Or,
                                            operands: [{
                                                operator: Like,
                                                path: ["category"],
                                                valueText: "*${args.query}*"
                                            }]
                                        }
                                    ) {
                                        api_Name
                                        api_URL
                                        description
                                        parameter
                                        method
                                        category
                                        publishedDate
                                        _additional { id }
                                    }
                                }
                            }`
                    };

                    const res = await fetch("http://localhost:8080/v1/graphql", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(graphqlQuery),
                    });

                    const data = await res.json();
                    const matches = data?.data?.Get?.API_LIBRARY || [];
                    toolData = matches.map(m => `
                            API: ${m.api_Name}
                            URL: ${m.api_URL}
                            Mô tả: ${m.description}
                            Parameter: ${m.parameter}
                            Method: ${m.method}
                            Category: ${m.category}
                        `).join("\n\n");
                }

                toolResponses.push({
                    role: "tool",
                    tool_call_id: toolCall.id,
                    content: toolData || "Không thấy kết quả phù hợp.",
                });
            }

            const supMessages = [...limitedMessages, choice, ...toolResponses];

            console.log("📨 Messages trước khi gọi followUp:", JSON.stringify(supMessages, null, 2));

            //Gửi cho ai lần 1, nếu gọi tool thì tới if tiếp theo
            const followUp = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: supMessages,
                tools: tools,
                max_completion_tokens: 3000
            });

            //Vẫn gọi thì làm tiếp
            if (followUp.choices[0].message.tool_calls) {
                console.log("⚠️ AI gọi tool lần 2, đang xử lý...");

                const secondToolResponses = [];
                for (const toolCall of followUp.choices[0].message.tool_calls) {
                    const args = JSON.parse(toolCall.function.arguments);
                    let toolData = "";

                    if (toolCall.function.name === "searchNode") {
                        console.log('AI chọn tool searchNode');
                        const graphqlQuery = {
                            query: `{
                                Get {
                                    N8N_Nodes(limit: 21) {
                                        node_Name
                                        operator
                                        description
                                        method
                                        jsonCode
                                        publishedDate
                                        _additional { id }
                                    }
                                }
                            }`
                        };

                        const res = await fetch("http://localhost:8080/v1/graphql", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(graphqlQuery),
                        });

                        const data = await res.json();
                        const matches = data?.data?.Get?.N8N_Nodes || [];
                        toolData = matches.map(m => `
                            Node: ${m.node_Name}
                            Operator: ${m.operator}
                            Mô tả: ${m.description}
                            Json Code: ${m.jsonCode}
                        `).join("\n\n");
                    }
                    else if (toolCall.function.name === "searchAPI") {
                        console.log('AI chọn tool searchAPI');
                        const graphqlQuery = {
                            query: `{
                                    Get {
                                        API_LIBRARY(
                                            limit: ${parseInt(args.topK)},
                                            where: {
                                                operator: Or,
                                                operands: [{
                                                    operator: Like,
                                                    path: ["category"],
                                                    valueText: "*${args.query}*"
                                                }]
                                            }
                                        ) {
                                            api_Name
                                            api_URL
                                            description
                                            parameter
                                            method
                                            category
                                            publishedDate
                                            _additional { id }
                                        }
                                    }
                                }`
                        };

                        const res = await fetch("http://localhost:8080/v1/graphql", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(graphqlQuery),
                        });

                        const data = await res.json();
                        const matches = data?.data?.Get?.API_LIBRARY || [];
                        toolData = matches.map(m => `
                                    API: ${m.api_Name}
                                    URL: ${m.api_URL}
                                    Mô tả: ${m.description}
                                    Parameter: ${m.parameter}
                                    Method: ${m.method}
                                    Category: ${m.category}
                                `).join("\n\n");
                    }

                    secondToolResponses.push({
                        role: "tool",
                        tool_call_id: toolCall.id,
                        content: toolData || "Không tìm thấy kết quả phù hợp.",
                    });
                }

                const finalMessages = [...supMessages, followUp.choices[0].message, ...secondToolResponses];

                const finalResponse = await openai.chat.completions.create({
                    model: "gpt-4o-mini",
                    messages: finalMessages,
                    max_completion_tokens: 3000
                });

                aiMessage = finalResponse.choices[0].message;
            } else {
                aiMessage = followUp.choices[0].message;
            }
        } else {
            aiMessage = choice;
        }

        // XỬ LÝ AI RESPONSE: Extract JSON và convert thành Mermaid
        const detectedJsonBlocks = extractJsonFromText(aiMessage.content);

        // Convert từng JSON block thành Mermaid
        for (let block of detectedJsonBlocks) {
            try {
                const mermaidCode = await convertJsonToMermaid(block.parsed);
                block.mermaidCode = mermaidCode;
            } catch (error) {
                console.error('❌ Error converting to Mermaid:', error.message);
                block.mermaidCode = null;
            }
        }

        // Tạo AI message với metadata
        const AiResponse = {
            role: 'assistant',
            content: aiMessage.content,
            metadata: {
                detectedJsonBlocks: detectedJsonBlocks,
                hasImage: false,
            }
        };

        // Thêm AI message vào history
        history.messages.push(AiResponse);

        // Lưu lại vào MongoDB
        await history.save();

        // Trả về response có metadata
        res.json({
            reply: aiMessage.content,
            metadata: {
                detectedJsonBlocks: detectedJsonBlocks
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'AI Lỗi Rồi' });
    }
});

app.listen(3000, () => {
    console.log('Server đang chạy vèo vèo ở cổng http://localhost:3000');
});
