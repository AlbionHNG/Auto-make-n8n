const form = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');
const promptInput = document.getElementById('prompt');
const imageInput = document.getElementById('imageInput');
const jsonInput = document.getElementById('jsonInput');

// Lấy hoặc tạo sessionId
let sessionId = localStorage.getItem('chatSessionId');
if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatSessionId', sessionId);
}

//LOAD DOM
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const res = await fetch(`/history?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
                if (typeof msg.content === 'string') {
                    // Truyền fileInfo từ server
                    appendMessage(
                        msg.role, 
                        msg.content,
                        null,
                        msg.metadata?.forceJsonData || null,
                        msg.metadata?.forceMermaidCode || null,
                        msg.metadata?.detectedJsonBlocks || [],
                        msg.metadata?.fileInfo || null
                    );
                } else if (Array.isArray(msg.content)) {
                    // Nếu là tin nhắn có ảnh
                    const textPart = msg.content.find(p => p.type === 'text')?.text || '';
                    appendMessage(
                        msg.role, 
                        textPart, 
                        null,  
                        msg.metadata?.forceJsonData || null,
                        msg.metadata?.forceMermaidCode || null,
                        msg.metadata?.detectedJsonBlocks || [],
                        msg.metadata?.fileInfo || null 
                    );
                }
            }
        }
    } catch (err) {
        console.error('Không thể load lịch sử chat:', err);
    }
});

// Preview trên thanh chat
imageInput.addEventListener('change', function () {
    let oldPreview = document.getElementById('file-preview');
    if (oldPreview) oldPreview.remove();

    if (imageInput.files && imageInput.files[0]) {
        if (imageInput.files[0].type.startsWith('image/')) {
        const img = document.createElement('img');
        img.id = 'file-preview';
        img.src = URL.createObjectURL(imageInput.files[0]);
        img.style.maxWidth = '120px';
        img.style.marginLeft = '8px';
        img.style.borderRadius = '6px';
        img.style.border = '1px solid #ddd';
        form.insertBefore(img, form.querySelector('button'));
    } else if (imageInput.files[0].type === 'application/pdf' 
        || imageInput.files[0].type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || imageInput.files[0].type === 'text/plain'
        || imageInput.files[0].type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        const fileIcon = document.createElement('div');
        fileIcon.id = 'file-preview';
        fileIcon.textContent = `📄 ${imageInput.files[0].name}`;
        fileIcon.style.cssText = `
            background: #e3f2fd;
            color: #1976d2;
            padding: 8px 12px;
            border-radius: 6px;
            margin-left: 8px;
            font-size: 14px;
            border: 1px solid #bbdefb;
        `;
        form.insertBefore(fileIcon, form.querySelector('button'));
    }}
});

if (jsonInput) {
    jsonInput.addEventListener('change', function () {
        let oldPreview = document.getElementById('json-preview');
        if (oldPreview) oldPreview.remove();

        if (jsonInput.files && jsonInput.files[0]) {
            const preview = document.createElement('div');
            preview.id = 'json-preview';
            preview.textContent = `📄 ${jsonInput.files[0].name}`;
            preview.style.cssText = `
                background: #e3f2fd;
                color: #1976d2;
                padding: 8px 12px;
                border-radius: 6px;
                margin-left: 8px;
                font-size: 14px;
                border: 1px solid #bbdefb;
            `;
            form.insertBefore(preview, form.querySelector('button'));
        }
    });
}

form.addEventListener('submit', function () {
    let oldPreview = document.getElementById('file-preview');
    if (oldPreview) oldPreview.remove();
    
    let oldJsonPreview = document.getElementById('json-preview');
    if (oldJsonPreview) oldJsonPreview.remove();
});

function cleanNodeType(nodeType) {
    if (!nodeType) return 'Unknown';
    
    let cleanType = nodeType
        .replace(/^n8n-nodes-base\./, '')
        .replace(/^@n8n\//, '')
        .replace(/^n8n-/, '');

    cleanType = cleanType
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    
    const typeMap = {
        'Http Request': 'HTTP Request',
        'Http Webhook': 'HTTP Webhook',
        'If': 'IF',
        'Set': 'Set',
        'Code': 'Code',
        'Merge': 'Merge',
        'Wait': 'Wait',
        'Schedule Trigger': 'Schedule',
        'Manual Trigger': 'Manual',
        'Webhook': 'Webhook'
    };
    
    return typeMap[cleanType] || cleanType;
}

function enhanceNodeLabels(mermaidCode, workflowData) {
    if (!workflowData || !workflowData.nodes) return mermaidCode;

    const nodeMap = {};
    workflowData.nodes.forEach(node => {
        nodeMap[node.id] = {
            name: node.name || '',
            type: cleanNodeType(node.type),
            operation: node.parameters?.operation || '',
            event: node.parameters?.event || '',
        };
    });

    const enhancedCode = mermaidCode.replace(/([A-Za-z0-9_-]+)(?:\["([^"]*)"\])?/g, (match, nodeId, currentLabel) => {
        const nodeInfo = nodeMap[nodeId];
        if (!nodeInfo) return match;

        if (/-->|==>|<-|->/.test(match)) return match;

        let suffix = '';
        if (nodeInfo.operation && nodeInfo.event) {
            suffix = `${nodeInfo.operation}/${nodeInfo.event}`;
        } else if (nodeInfo.operation || nodeInfo.event) {
            suffix = nodeInfo.operation || nodeInfo.event;
        }

        let label = '';
        if (nodeInfo.name !== nodeInfo.type && nodeInfo.name !== nodeId) {
            label = `${nodeInfo.name} - ${nodeInfo.type}\\n${suffix}`;
        } else {
            label = `${nodeInfo.type}\\n${suffix}`;
        }

        return `${nodeId}["${label}"]`;
    });

    return enhancedCode;
}

async function convertJsonToMermaid(workflowData) {
    const payload = {
        workflow_data: workflowData,
        params: {
            direction: 'LR',
            subgraph_direction: 'BT',
            show_credentials: false,
            show_key_parameters: true,
            subgraph_display_mode: 'subgraph'
        }
    };

    try {
        const res = await fetch('https://api-n8nmermaid.janwillemaltink.com/v2/mermaid/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error('API error: ' + JSON.stringify(data));
        }

        let code = data.mermaid_code || (data.diagrams && data.diagrams.main);
        if (!code) {
            throw new Error('No Mermaid code returned.');
        }

        code = code
            .replace(/([^\s@]+)@\{[^}]*label:\s*"([^"]+)"[^}]*\}/g, '$1["$2"]')
            .replace(/([^\s@]+)@\{[^}]*\}/g, '$1')
            .replace(/%%.*$/gm, '')
            .trim();

        code = enhanceNodeLabels(code, workflowData);

        return code;
    } catch (error) {
        throw error;
    }
}


async function appendMessage(role, text, imageUrl, forceJsonData, forceMermaidCode, detectedJsonBlocks = [], fileInfo = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-message ' + (role === 'user' ? 'user' : 'ai');

    // Xử lý text với Mermaid code blocks
    const parts = [];
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;
    let processedText = text;

    // Loại bỏ JSON blocks khỏi text để tránh hiển thị trùng lặp
    if (detectedJsonBlocks.length > 0) {
        let textOffset = 0;
        detectedJsonBlocks.forEach(block => {
            const adjustedStart = block.startIndex - textOffset;
            const adjustedEnd = block.endIndex - textOffset;
            processedText = processedText.slice(0, adjustedStart) + processedText.slice(adjustedEnd);
            textOffset += (adjustedEnd - adjustedStart);
        });
    }

    // Xử lý Mermaid blocks
    let lastIndex = 0;
    let match;
    while ((match = mermaidRegex.exec(processedText)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: 'text',
                content: processedText.slice(lastIndex, match.index)
            });
        }

        parts.push({
            type: 'mermaid',
            content: match[1]
        });

        lastIndex = mermaidRegex.lastIndex;
    }

    if (lastIndex < processedText.length) {
        parts.push({
            type: 'text',
            content: processedText.slice(lastIndex)
        });
    }

    // Render text parts
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

    // Hiển thị detected JSON blocks
    for (const jsonBlock of detectedJsonBlocks) {
        // Hiển thị JSON
        const jsonDiv = document.createElement('div');
        jsonDiv.className = 'json-display';
       jsonDiv.innerHTML = `
    <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-top: 10px; position: relative;">
        <div style="font-weight: bold; color: #495057; margin-bottom: 8px;">
            📄 File Json N8N có thể copy:
            <button onclick="copyJsonBlock(this)" 
                    style="float: right; padding: 2px 6px; font-size: 12px; cursor: pointer;">
                Copy
            </button>
        </div>
        <pre style="background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto; max-height: 200px;">${JSON.stringify(jsonBlock.parsed, null, 2)}</pre>
    </div>
`;
        msgDiv.appendChild(jsonDiv);

        // Hiển thị Mermaid 
        if (jsonBlock.mermaidCode) {
            const mermaidDiv = document.createElement('div');
            mermaidDiv.className = 'mermaid-display';
            mermaidDiv.innerHTML = `
                <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin-top: 10px;">
                    <div style="font-weight: bold; color: #856404; margin-bottom: 8px;">📄 Workflow của bạn sẽ nhìn như này</div>
                    <div class="mermaid">${jsonBlock.mermaidCode}</div>
                </div>
            `;
            msgDiv.appendChild(mermaidDiv);
        } else {
            // Hiển thị lỗi nếu không convert được
            const errorDiv = document.createElement('div');
            errorDiv.innerHTML = `
                <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 6px; padding: 12px; margin-top: 10px;">
                    <div style="color: #721c24;">❌ Không thể chuyển đổi sang Mermaid</div>
                </div>
            `;
            msgDiv.appendChild(errorDiv);
        }
    }

    // Hiển thị JSON data bắn lên
    if (forceJsonData) {
        const jsonDiv = document.createElement('div');
        jsonDiv.className = 'json-display';
        jsonDiv.innerHTML = `
            <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-top: 10px;">
                <div style="font-weight: bold; color: #495057; margin-bottom: 8px;">📄 JSON Workflow:</div>
                <pre style="background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto; max-height: 200px;">${JSON.stringify(forceJsonData, null, 2)}</pre>
            </div>
        `;
        msgDiv.appendChild(jsonDiv);
    }

    // Hiển thị Mermaid diagram bắn lên
    if (forceMermaidCode) {
        const mermaidDiv = document.createElement('div');
        mermaidDiv.className = 'mermaid-display';
        mermaidDiv.innerHTML = `
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin-top: 10px;">
                <div style="font-weight: bold; color: #856404; margin-bottom: 8px;">📄 Mermaid Diagram:</div>
                <div class="mermaid">${forceMermaidCode}</div>
            </div>
        `;
        msgDiv.appendChild(mermaidDiv);
    }

    //HIển thị ảnh
    if (fileInfo) {
        if (fileInfo.type === 'image' && fileInfo.base64Data) {
            // 👉 Hiển thị ảnh từ base64 đã lưu
            const img = document.createElement('img');
            img.src = fileInfo.base64Data;
            img.style.maxWidth = '300px';
            img.style.borderRadius = '8px';
            img.style.marginTop = '10px';
            msgDiv.appendChild(img);
        } else if (fileInfo.type === 'document') {
            //Hiển thị file document với thông tin từ metadata
            const fileIcon = document.createElement('div');
            fileIcon.innerHTML = `
                <img src="https://cdn-icons-png.flaticon.com/512/2258/2258853.png" 
                alt="file icon" style="width: 16px; height: 16px; vertical-align: middle; margin-right: 4px;"> 
                ${fileInfo.name})
            `;
            fileIcon.style.cssText = `
                background: #e3f2fd;
                color: #1976d2;
                padding: 8px 12px;
                border-radius: 6px;
                margin-top: 10px;
                font-size: 14px;
                border: 1px solid #bbdefb;
                display: inline-block;
            `;
            msgDiv.appendChild(fileIcon);
        }
    }

    chatBox.appendChild(msgDiv);
    chatBox.scrollTop = chatBox.scrollHeight;

    // Kích hoạt mermaid sau khi render
    setTimeout(() => {
        mermaid.run();
    }, 0);
}

form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const prompt = promptInput.value.trim();
    if (!prompt && !(jsonInput && jsonInput.files[0]) && !(imageInput.files && imageInput.files[0])) return;

    //Hiển thị file lên khung chat
    let userFileInfo = null;
    if (imageInput.files && imageInput.files[0]) {
        if (imageInput.files[0].type.startsWith('image/')) {
            // Tạo fileInfo cho ảnh
            userFileInfo = {
                type: 'image',
                name: imageInput.files[0].name,
                size: imageInput.files[0].size,
                base64Data: URL.createObjectURL(imageInput.files[0])
            };
        } else {
            // Tạo fileInfo cho document
            userFileInfo = {
                type: 'document',
                name: imageInput.files[0].name,
                size: imageInput.files[0].size,
                mimetype: imageInput.files[0].type
            };
        }
    }

    // Xử lý JSON file upload
    let uploadJsonData = null;
    let uploadMermaidCode = null;
    if (jsonInput && jsonInput.files && jsonInput.files[0]) {
        try {
            const fileContent = await readFileAsText(jsonInput.files[0]);
            uploadJsonData = JSON.parse(fileContent);
            
            // Hiển thị tin nhắn user với JSON
            await appendMessage('user', prompt || 'Uploaded JSON workflow', null, uploadJsonData, null, [], null);
            
            // Hiển thị loading message
            await appendMessage('ai', 'Đang chuyển đổi JSON thành Mermaid diagram...');
            
            // Convert to Mermaid
            try {
                uploadMermaidCode = await convertJsonToMermaid(uploadJsonData);
                
                // Xóa loading message
                chatBox.removeChild(chatBox.lastChild);
                
                // Hiển thị kết quả
                await appendMessage('ai', '✅ Chuyển đổi thành công! Dưới đây là JSON workflow và Mermaid diagram tương ứng:', null, uploadJsonData, uploadMermaidCode);
                
            } catch (mermaidError) {
                // Xóa loading message
                chatBox.removeChild(chatBox.lastChild);
                await appendMessage('ai', `❌ Lỗi khi chuyển đổi sang Mermaid: ${mermaidError.message}`, null, uploadJsonData);
            }
            
        } catch (parseError) {
            await appendMessage('user', prompt || 'Uploaded file', null, null, null, [], userFileInfo);
            await appendMessage('ai', `❌ Lỗi khi đọc file JSON: ${parseError.message}`);
        }
    } else {
        // xử lý tin nhắn bình thường
        await appendMessage('user', prompt, null, null, null, [], userFileInfo);
        
        const formData = new FormData(form);
        formData.append('sessionId', sessionId);
        
        await appendMessage('ai', 'Đang trả lời...');

        try {
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            chatBox.removeChild(chatBox.lastChild);

            if (data.reply) {
                // Nếu có json
                await appendMessage('ai', data.reply, null, null, null, data.metadata?.detectedJsonBlocks || []);
            } else {
                await appendMessage('ai', 'AI không phản hồi.');
            }
        } catch (err) {
            chatBox.removeChild(chatBox.lastChild);
            await appendMessage('ai', '⚠️ Lỗi khi gửi yêu cầu.');
            console.error(err);
        }
    }

    // Reset form
    promptInput.value = '';
    imageInput.value = '';
    if (jsonInput) jsonInput.value = '';
});

// Helper function để đọc file
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không thể đọc file'));
        reader.readAsText(file);
    });
}

// Hàm copy JSON block
function copyJsonBlock(button) {
    const pre = button.closest('.json-display').querySelector('pre');
    const text = pre.innerText;
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = "✅ Đã copy!";
        setTimeout(() => button.textContent = "Copy", 1500);
    }).catch(err => {
        window.alert("Lỗi khi copy: " + err);
    });
}


// Nhấn Enter để gửi
promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
    }
});