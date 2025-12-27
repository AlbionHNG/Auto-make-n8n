const express = require('express');
const router = express.Router();
const User = require('./user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cor = require('cors');

router.use(cor({
    origin: 'http://localhost:3000', // Cho phép origin từ ứng dụng frontend
}));

router.post('/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Vui lòng điền tất cả các trường' });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email đã được sử dụng' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        const token = jwt.sign({ id: newUser._id }, 'secret', { expiresIn: '1h' });
        res.status(201).json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Đã xảy ra lỗi', error });
    }
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if(!email || !password){
        return res.status(400).json({ message: 'Thiếu thông tin đăng nhập' });
    }
    try{
        const user = await User.findOne({ email});
        if(!user){
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if(!isMatch){
            return res.status(400).json({ message: 'Email hoặc mật khẩu không đúng' });
        }
        const token = jwt.sign({ id: user._id }, 'secret', { expiresIn: '1h' });
        res.status(200).json({ token });
    } catch (error) {
        res.status(500).json({ message: 'Đã xảy ra lỗi', error });
    }
});