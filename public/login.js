const loginBtn = document.getElementById('signin-button');
const signoutBtn = document.getElementById('signout-button');
const email = document.getElementById('email');
const password = document.getElementById('password');
const toast = document.getElementById('toast');

AOS.init({
    duration: 1500,
    once: true,
});

let currentUser = null;

function handleCredentialResponse(response) {
    try {
        const user = parseJwt(response.credential);

        fetch('http://localhost:3000/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: user.email,
                name: user.name,
                sub: user.sub
            })
        })
            .then(res => res.json())
            .then(data => {
                showToast(`Đăng nhập Google thành công: ${data.name}`);
                setTimeout(() => window.location.href = 'main.html', 1500);
            });

        loginBtn.style.display = 'none';
        signoutBtn.style.display = 'inline-block';

    } catch (error) {
        console.error('JWT decode error:', error);
        showToast('Lỗi xác thực Google!', 'error');
    }
}

function parseJwt(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
    return JSON.parse(jsonPayload);
}

function handleManualLogin(event) {
    event.preventDefault();
    email.value;
    password.value;
    fetch('http://localhost:3000/auth/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    })
        .then(res => res.json())
        .then(data => {
            showToast(`Đăng nhập thủ công thành công: ${data.email}`);
            setTimeout(() => window.location.href = 'upload.html', 1500);
        });
}

function signOut() {
    google.accounts.id.disableAutoSelect();
    currentUser = null;
    showToast('Đã đăng xuất');
    loginBtn.style.display = 'block';
    signoutBtn.style.display = 'none';
}

function showToast(message, type = 'success') {
    toast.textContent = message;
    if (type === 'error') toast.style.backgroundColor = '#ef4444';
    else toast.style.backgroundColor = '#10b981';
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
} 