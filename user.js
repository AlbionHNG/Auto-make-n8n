const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: {
    type: String,
    default: ''
  },
  userID:{
    type: String,
    unique: true,
    default: () => Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  },
  email:{
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  role:{
    type: String,
    default: 'user'
  },
  N8NToken:{
    type: String,
    default: ''
  },
  n8nUrl:{
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', UserSchema);