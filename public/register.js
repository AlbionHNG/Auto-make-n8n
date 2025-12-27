document.getElementById('registerBtn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();

    if (!email || !password) {
        alert("Nhập đầy đủ email và mật khẩu");
        return;
    }
    try {
        const res = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();
        console.log("Server trả về:", data);

        if (res.ok) {
            alert("Đăng ký thành công!");
            window.location.href = "login.html";
        } else {
            alert(data.message || "Đăng ký thất bại");
        }

    } catch (error) {
        console.error("Lỗi fetch:", error);
        alert("Không kết nối được server");
    }
});