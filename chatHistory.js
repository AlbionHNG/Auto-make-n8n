//Khởi tạo mongo
const mongoose = require('mongoose');

//Tạo cái khung Schema
const messageSchema = new mongoose.Schema({
    role: String,
    content: mongoose.Schema.Types.Mixed
    });

const chatHistorySchema = new mongoose.Schema({
    sessionId: String,
    messages: [messageSchema],
    updateAt: {type: Date, default: Date.now}
});

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
