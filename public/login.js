document.getElementById('loginBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || !password) {
        alert("Nhập đầy đủ email và mật khẩu");
        return;
    }
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await response.json();
        if (response.ok) {
            alert('Đăng nhập thành công! với id là ' + data.token.userId);
            document.cookie = `token=${data.token}; path=/;`;
            window.location.href = 'main.html';
        } else {
            alert('Lỗi đăng nhập: ' + data.message);
        }
    } catch (error) {
        console.error('Lỗi khi đăng nhập:', error);
        alert('Không thể đăng nhập. Vui lòng thử lại sau.');
    }
});