const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./user');
const n8nJson = require('./savedN8N');
const JWT_SECRET = 'vfjfndaviasdcsdvNDASVDSADAS';
const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

// Đăng nhập
router.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email không tồn tại' });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(400).json({ message: 'Mật khẩu không đúng' });
    }
    const token = jwt.sign({ userId: user.userID }, JWT_SECRET, { expiresIn: '7d' });
    console.log('User logged in:', user.userID);
    res.status(200).json({ message: 'Đăng nhập thành công', token });
  } catch (error) {
    console.error('Lỗi khi đăng nhập:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});
// Đăng ký
router.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  console.log('Received registration data:', req.body);
  try {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ email, password: hashedPassword });
    await newUser.save();
    res.status(200).json({ message: 'Đăng ký thành công' });
  } catch (error) {
    console.error('Lỗi khi đăng ký:', error);
    res.status(500).json({ message: 'Lỗi máy chủ' });
  }
});
// Đăng xuất
router.post('/api/logout', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Không có token đăng nhập' });
  }
  res.status(200).json({ message: 'Đăng xuất thành công' });
});
//Lưu n8n URL
router.post('/api/save-n8n-url', async (req, res) => {
  try {
    const { userID, n8nUrl } = req.body;
    if (!userID || !n8nUrl) {
      return res.status(400).json({ message: 'Thiếu userID hoặc n8nUrl' });
    }
    const updatedUser = await User.findOneAndUpdate(
      { userID: userID },
      { n8nUrl: n8nUrl },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }
    res.json({
      message: 'Lưu n8n URL thành công',
      user: updatedUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});
//Lưu n8n API Key
router.post('/api/save-user-n8nKey', async (req, res) => {
  try {
    const { userID, apiKey } = req.body;
    if (!userID || !apiKey) {
      return res.status(400).json({ message: 'Thiếu userID hoặc n8nApiKey' });
    }
    const updatedUser = await User.findOneAndUpdate(
      { userID: userID },
      { N8NToken: apiKey },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }
    res.json({
      message: 'Lưu n8n API Key thành công',
      user: updatedUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Lỗi server' });
  }
});
//Lấy cài đặt người dùng
router.get('/api/user/:token/setting', async (req, res) => {
  const { token } = req.params;
  try {
    const result = await User.findOne({ userID: token });
    if (!result) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }
    res.json({
      n8nApiKey: result.N8NToken,
      n8nBaseUrl: result.n8nUrl
    });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});
//Giải mã token và kiểm tra hợp lệ
router.get('/api/verify-token/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.status(200).json({ valid: true, userId: decoded.userId });
  } catch (error) {
    res.status(401).json({ valid: false, message: 'Token không hợp lệ' });
  }
});
//Lưu dữ liệu n8n
router.post('/api/save-n8n-data', async (req, res) => {
  try {
    const { userID, n8nUrl, n8ndata, chatName, description, workflowName } = req.body;
    if (!userID || !n8nUrl || !n8ndata) {
      return res.status(400).json({ message: 'Thiếu userID, n8nUrl hoặc n8ndata' });
    }
    const newN8nData = new n8nJson({
      userID: userID,
      n8nUrl: n8nUrl,
      n8ndata: n8ndata,
      chatName: chatName,
      description: description,
      workflowName: workflowName,
    });
    await newN8nData.save();
    res.status(200).json({ message: 'Lưu dữ liệu n8n thành công' });
  } catch (error) {
    console.error('Lỗi khi lưu dữ liệu n8n:', error);
    res.status(500).json({ message: 'Lỗi server' });
  }
});
//Lấy dữ liệu n8n
router.get('/api/get-n8n-data', async (req, res) => {
  try {
    const { userID } = req.query;
    if (!userID) {
      return res.status(400).json({ message: 'lỗi cookies' });
    }
    const n8nData = await n8nJson.find({ userID: userID });

    const workflows = n8nData.map(item => ({
      workflow: item.n8ndata,
      sessionName: item.chatName,
      url: item.n8nUrl,
      createdAt: item.date,
      description: item.description,
      workflowName: item.workflowName,
      Id: item._id,
    }));

    res.status(200).json({
      count: workflows.length,
      workflows: workflows
    });
  } catch (error) {
    res.status(500).json({ message: 'Không thấy n8n đâu cả' });
  }
});

//Xoá dữ liệu n8n
router.delete('/api/delete-n8n/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await n8nJson.findByIdAndDelete({ _id: id });
    res.status(200).json({ message: 'Xóa dữ liệu n8n thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

//Gửi OTP cho email người dùng
async function sendOTPEmail(email) {
  const OTP = Math.floor(100000 + Math.random() * 900000).toString();

  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'OTP khôi phục mật khẩu',
    text: `Mã OTP của bạn là: ${OTP}. Có hiệu lực 5 phút.`
  });

  return OTP;
}
//Gửi cái OTP
router.post('/api/send-otp', async (req, res) => {
  const { email } = req.body;

  try {
    const OTP = await sendOTPEmail(email);
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Email không tồn tại' });
    }
    user.resetOTP = OTP;
    user.resetOTPExpire = Date.now() + 5 * 60 * 1000; // 5 phút
    await user.save();
    res.json({ message: 'Gửi OTP thành công' });
  } catch (error) {
    res.status(500).json({ message: 'Lỗi server' });
  }
});

//quên mật khẩu
router.post('/api/forgot-password', async (req, res) => {
  const { email, otp, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) {
    return res.status(400).json({ message: 'Email không tồn tại' });
  }

  if (
    user.resetOTP !== otp ||
    Date.now() > user.resetOTPExpire
  ) {
    return res.status(400).json({ message: 'OTP không hợp lệ hoặc đã hết hạn' });
  }

  user.password = newPassword;
  user.resetOTP = null;
  user.resetOTPExpire = null;

  await user.save();

  res.json({ message: 'Đổi mật khẩu thành công' });
});


router.post('/api/checkRole', async (req, res) => {
  const { token } = req.body;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ userID: decoded.userId });
    if (!user) {
      return res.status(404).json({ message: 'User không tồn tại' });
    }
    res.status(200).json({ role: user.role });
  } catch (error) {
    res.status(401).json({ message: 'Token không hợp lệ' });
  }
});

module.exports = router;
