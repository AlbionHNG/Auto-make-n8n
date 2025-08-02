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

// Xóa ảnh preview khi submit
form.addEventListener('submit', function () {
  let oldPreview = document.getElementById('image-preview');
  if (oldPreview) oldPreview.remove();
});

// Hiển thị tin nhắn lên khung chat
function appendMessage(role, text, imageUrl) {
  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message ' + (role === 'user' ? 'user' : 'ai');

  const parts = [];
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = mermaidRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: text.slice(lastIndex, match.index)
      });
    }

    parts.push({
      type: 'mermaid',
      content: match[1]
    });

    lastIndex = mermaidRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({
      type: 'text',
      content: text.slice(lastIndex)
    });
  }

  for (const part of parts) {
    if (part.type === 'text') {
      const p = document.createElement('div');
      p.innerHTML = part.content.replace(/\n/g, '<br>');
      msgDiv.appendChild(p);
    } else if (part.type === 'mermaid') {
      const div = document.createElement('div');
      div.className = 'mermaid';
      div.textContent = part.content;
      msgDiv.appendChild(div);
    }
  }

  if (imageUrl) {
    const img = document.createElement('img');
    img.src = imageUrl;
    msgDiv.appendChild(img);
  }

  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;

  // Kích hoạt mermaid sau khi render
  setTimeout(() => {
    if (window.mermaid) window.mermaid.run();
  }, 0);
}

// Xử lý gửi form
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

// Nhấn Enter để gửi
promptInput.addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.dispatchEvent(new Event('submit'));
  }
});
