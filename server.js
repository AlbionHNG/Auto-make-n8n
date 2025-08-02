const express = require('express');
const app = express();
const multer = require('multer');
const fs = require('fs')
const {OpenAI} = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const {Pinecone} = require('@pinecone-database/pinecone')
const mongoose = require('mongoose');
const ChatHistory = require('./chatHistory');
const proxyRoutes = require('./proxy.js');

app.use(proxyRoutes);

app.use(express.json());

mongoose.connect('mongodb://localhost:27017/chatbot') 
    .then(() => console.log('AI đã có não để nhớ'))
    .catch(err => console.error('MongoDB lỗi rồi, mất trí nhớ rồi!', err));

dotenv.config();

const upload = multer({ dest: 'uploads/' });
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'public' ,'index.html'));
});

app.post('/chat', upload.single('image'), async (req, res) => {
    try {
        const userPrompt = req.body.prompt || '';
        const sessionId = req.ip || 'default-session';

let history = await ChatHistory.findOne({ sessionId });
if (!history) {
    history = new ChatHistory({ 
        sessionId, 
        messages: [
            {
                role: 'system',
                content: 'Bạn là môt trợ lý AI thông minh, giúp người dùng trả lời câu hỏi và giải quyết vấn đề.'
            }
        ]
    });
}

// Tạo user message
let userMessage;
if (req.file) {
    const base64Image = fs.readFileSync(req.file.path, { encoding: 'base64' });
    userMessage = {
        role: 'user',
        content: [
            { type: 'text', text: userPrompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
        ]
    };
    fs.unlinkSync(req.file.path);
} 

else {
    userMessage = {
        role: 'user',
        content: userPrompt
    };
}

// Thêm user message vào history
history.messages.push(userMessage);

//Nhúng văn bản
const embeddingResponse = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: userPrompt
});

const vector = embeddingResponse.data[0].embedding;

//Kết nối pinecone
const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const INDEX_NAME= process.env.INDEX_NAME;
const INDEX_HOST= process.env.INDEX_HOST;
const PRE_namespace= process.env.namespace;
const namespace = pc.index(INDEX_NAME, INDEX_HOST).namespace(PRE_namespace);

const pineconeResponse = await namespace.query({
  vector: vector,
  topK: 20,
  includeMetadata: true,
  includeValues: false
});

//log để kiểm tra kết nối
console.log('Vector length:', vector.length);
console.log('Pinecone matches:', pineconeResponse.matches?.length);
console.log('Sample data:', pineconeResponse.matches?.[0]?.metadata);
        
let MGE = null;

// Xử lý Pinecone
if(pineconeResponse.matches?.length > 0){
    const PineconeInfo = pineconeResponse.matches
        .map(match => match.metadata.text|| '')
        .filter(Boolean)
        .join('\n\n');
    
    // Debug: In ra PineconeInfo để kiểm tra
    console.log('PineconeInfo content:', PineconeInfo.substring(0, 200));
    
    // Chỉ gán khi có dữ liệu dạng string
    if (PineconeInfo.trim()) {
        MGE = {
            role: 'system',
            content: `Tài liệu tham khảo liên quan:\n${PineconeInfo}`
        };
        console.log('✅ Đã tạo MGE với content length:', MGE.content.length);
    }
}

if (MGE) {
    history.messages.push(MGE);
    console.log('✅ Đã push MGE vào history');
} else {
    console.log('❌ Không push MGE - không có dữ liệu');
}


// Gửi toàn bộ history.messages lên OpenAI
const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4.1-mini-2025-04-14',
    messages: history.messages,
    max_tokens: 5000
});

// Thêm AI message vào history
const aiMessage = chatCompletion.choices[0].message;
history.messages.push(aiMessage);

// Lưu lại vào MongoDB
await history.save();
res.json({ reply: aiMessage.content });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'AI Lỗi Rồi Mua Claude đi' });
    }
});

app.listen(3000, () => {
    console.log('Server đang chạy vèo vèo ở cổng http://localhost:3000');
});

