const mongoose = require('mongoose');

const n8nSchema = new mongoose.Schema({
    userID: {
        type: String,
    },
    n8nUrl: {
        type: String,
    },
    workflowName: {
        type: String,
    },
    chatName: {
        type: String,
    },
    description: {
        type: String,
    },
    date: {
        type: Date,
        default: Date.now
    },
    n8ndata:{
        type: Object,
    }
});

module.exports = mongoose.model('n8n', n8nSchema);