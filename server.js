const express = require('express');
const app = express();
const fs = require('fs')
const {OpenAI} = require('openai');
const dotenv = require('dotenv');
const path = require('path');
const mongoose = require('mongoose');
const ChatHistory = require('./chatHistory');

mongoose.connect('mongodb://localhost:27017/chatbot') 
    .then(() => console.log('AI đã có não để nhớ'))
    .catch(err => console.error('MongoDB lỗi rồi, mất trí nhớ rồi!', err));

dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname,'index.html'));
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
} else {
    userMessage = {
        role: 'user',
        content: userPrompt
    };
}

// Thêm user message vào history
history.messages.push(userMessage);

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

