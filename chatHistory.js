const mongoose = require('mongoose');

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