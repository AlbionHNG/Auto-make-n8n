const form = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');
const promptInput = document.getElementById('prompt');
const imageInput = document.getElementById('imageInput');

// Hiển thị ảnh preview khi chọn file
imageInput.addEventListener('change', function () {
  let oldPreview = document.getElementById('image-preview');
  if (oldPreview) oldPreview.remove();

  if (imageInput.files && imageInput.files[0]) {
    const img = document.createElement('img');
    img.id = 'image-preview';
    img.src = URL.createObjectURL(imageInput.files[0]);
    img.style.maxWidth = '120px';
    img.style.marginLeft = '8px';
    img.style.borderRadius = '6px';
    img.style.border = '1px solid #ddd';
    form.insertBefore(img, form.querySelector('button'));
  }
});

// Xóa ảnh khi submit
form.addEventListener('submit', function () {
  let oldPreview = document.getElementById('image-preview');
  if (oldPreview) oldPreview.remove();
});

// Hiển thị tin nhắn lên khung chat.
function appendMessage(role, text, imageUrl) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message ' + (role === 'user' ? 'user' : 'ai');
// Lấy mermaid
  const mermaidMatch = text.match(/```mermaid\s*([\s\S]*?)\s*```/);
  if (mermaidMatch) {
    const mermaidCode = mermaidMatch[1];
    msgDiv.innerHTML = `<div class="mermaid">${mermaidCode}</div>`;
    setTimeout(() => {
      if (window.mermaid) window.mermaid.run();
    }, 0);
  } else if (text) {
    msgDiv.innerHTML = text.replace(/\n/g, '<br>');
  }

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    msgDiv.appendChild(img);
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// form trả lời
form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const prompt = promptInput.value.trim();
  if (!prompt) return;

  let imageUrl = null;
  if (imageInput.files && imageInput.files[0]) {
    imageUrl = URL.createObjectURL(imageInput.files[0]);
  }
  appendMessage('user', prompt, imageUrl);

  const formData = new FormData(form);
  promptInput.value = '';
  imageInput.value = '';
  appendMessage('ai', 'Đang trả lời...');

  try {
    const response = await fetch('/chat', {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    chatBox.removeChild(chatBox.lastChild);

    if (data.reply) {
      appendMessage('ai', data.reply);
    } else {
      appendMessage('ai', 'AI không phản hồi.');
    }
  } catch (err) {
    chatBox.removeChild(chatBox.lastChild);
    appendMessage('ai', '⚠️ Lỗi khi gửi yêu cầu.');
    console.error(err);
  }
});

// Nhấn Enter để gửi, ctrl+shift xuống dòng
promptInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});
