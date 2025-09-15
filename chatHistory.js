const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    role: {
        type: String,
        required: true,
        enum: ['user', 'assistant', 'system']
    },
    content: mongoose.Schema.Types.Mixed,
    fileData: {
        type: String,
        filename: String,
        filecontent: String,
        filemimetype: String,
        filetype: String    
    },
    // Metadata để lưu JSON, Mermaid và file
    metadata: {
        detectedJsonBlocks: [{
            raw: String,
            parsed: mongoose.Schema.Types.Mixed,
            startIndex: Number,
            endIndex: Number,
            mermaidCode: String
        }],
        forceJsonData: mongoose.Schema.Types.Mixed,
        forceMermaidCode: String,
        hasFile: Boolean,
       
        fileInfo: {
            type: {
                type: String, // ảnh hoặc file
                enum: ['image', 'document']
            },
            name: String,
            mimetype: String,
            size: Number,
            base64Data: String, // Cho ảnh
            content: String     // Cho file text
        }
    }
}, { timestamps: true });

const chatHistorySchema = new mongoose.Schema({
    sessionId: {
        type: String,
        required: true,
        unique: true
    },
    messages: [messageSchema]
}, { timestamps: true });

module.exports = mongoose.model('ChatHistory', chatHistorySchema);
