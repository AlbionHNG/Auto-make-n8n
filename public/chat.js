const form = document.getElementById('chatForm');
const chatBox = document.getElementById('chatBox');
const promptInput = document.getElementById('prompt');
const imageInput = document.getElementById('imageInput');
const jsonInput = document.getElementById('jsonInput');
const sessionSelector = document.getElementById('sessionSelector');
const currentSessionDisplay = document.getElementById('currentSessionDisplay');
const newSessionBtn = document.getElementById('newSessionBtn');
const renameSessionBtn = document.getElementById('renameSessionBtn');
const deleteSessionBtn = document.getElementById('deleteSessionBtn');
const newSessionModal = document.getElementById('newSessionModal');
const renameSessionModal = document.getElementById('renameSessionModal');
const newSessionNameInput = document.getElementById('newSessionName');
const renameSessionNameInput = document.getElementById('renameSessionName');
const workflowModal = document.getElementById('workflowModal');
const workflowName = document.getElementById('workflowName');
const workflowDescription = document.getElementById('workflowDescription');
// Lấy hoặc tạo sessionId

let sessions = [];
let currentSessionId = localStorage.getItem('chatSessionId');
console.log('Current Session ID from localStorage:', currentSessionId);
//Lấy danh sách session và cập nhật giao diện
async function loadSessions() {
    try {
        const UserID = await initUser();
        console.log('Loading sessions for UserID:', UserID);
        const res = await fetch(`/sessions/${UserID}`);
        const data = await res.json();
        //Nếu thành công thì nạp đống session có từ server vào danh sách hiện tại
        if (data.success) {
            sessions = data.sessions;// Ghi đè lên danh sách session hiện tại
            updateSessionSelector();//Gọi cái này để update chọn session

            // Tìm session trong mảng có sessionId khớp với currentSessionId
            const sessionExists = sessions.find(s => s.sessionId === currentSessionId);

            if (!currentSessionId || !sessionExists) {
                // Nếu chưa có session hoặc session không tồn tại
                if (sessions.length > 0) {
                    // Gán cái session hiện tại là cái đầu tiên lấy đc trong db
                    currentSessionId = sessions[0].sessionId;
                    localStorage.setItem('chatSessionId', currentSessionId);
                } else {
                    // Tạo session mới nếu chưa có session nào
                    await createNewSession('Chat đầu tiên', false);
                    return;
                }
            }

            updateCurrentSessionDisplay();//Load lại thông tin session hiện tại lên display
            updateSessionSelector(); // Update lại thanh chọn session
        }
    } catch (err) {
        console.error('Lỗi khi load sessions:', err);
        // Nếu lỗi, tạo session mặc định
        currentSessionDisplay.textContent = 'Không thể tải session';
    }
}

// Update chọn session/tạo danh sách session dropdown
function updateSessionSelector() {
    // Reset lại dropdown với option là mặc định
    sessionSelector.innerHTML = '<option value="">Chọn đoạn chat...</option>';
    //duyệt từng session một
    sessions.forEach(session => {
        const option = document.createElement('option');
        option.value = session.sessionId;
        option.textContent = `${session.sessionName}`;
        //So sánh xem sessionId nào trùng với sessionId hiện tại thì chọn nó
        if (session.sessionId === currentSessionId) {
            option.selected = true;
        }
        //Chọn cái thằng trùng rồi thêm vào selector
        sessionSelector.appendChild(option);
    });
}

// Hàm update thông tin session hiện tại lên display
function updateCurrentSessionDisplay() {
    const currentSession = sessions.find(s => s.sessionId === currentSessionId);// Tìm session trong mảng có sessionId khớp với currentSessionId
    if (currentSession) {//nếu có tòn tại
        currentSessionDisplay.textContent = `${currentSession.sessionName} - Số tin nhắn(${currentSession.messageCount})`;//Hiện thị lên display
    } else {
        currentSessionDisplay.textContent = 'Loading...';//còn lỗi thì đang load
    }
}

// tạo session mới
async function createNewSession(sessionName = null, showAlert = true) {
    const userId = await initUser();
    try {
        const res = await fetch(`/sessions/${userId}/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                sessionName: sessionName//Gửi cái Name = null :v
            })
        });
        //Đợi api gửi data
        const data = await res.json();
        //Nếu ok
        if (data.success) {
            // Gán id hiện tại là ai mới từ data
            currentSessionId = data.sessionId;
            localStorage.setItem('chatSessionId', currentSessionId);//Lưu id vào local

            // Tải lại danh sách session từ server và cập nhật giao diện
            await loadSessions();

            // Xóa sạch nội dung khung chat trên UI
            clearChatBox();

            if (showAlert) {
                alert('Tạo session mới thành công!');
            }
        } else {
            alert('Lỗi: ' + data.error);
        }
    } catch (err) {
        console.error('Lỗi khi tạo session:', err);
        if (showAlert) {
            alert('Không thể tạo session mới');
        }
    }
}

// Đổi tên
async function renameSession(sessionId, newName) {
    try {
        const res = await fetch(`/sessions/${sessionId}/rename`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                newName: newName //Gửi tên mới nhập(này lấy từ cái hàm bên dưới)
            })
        });

        const data = await res.json();

        if (data.success) {
            // Reload sessions để cập nhập lại display và selector
            await loadSessions();
            alert('Đổi tên session thành công!');
        } else {
            alert('Lỗi: ' + data.error);
        }
    } catch (err) {
        console.error('Lỗi khi đổi tên session:', err);
        alert('Không thể đổi tên session');
    }
}

// Delete session
async function deleteSession(sessionId) {
    if (!confirm('Bạn có chắc muốn xóa session này? Tất cả tin nhắn sẽ bị mất!')) {
        return;
    }

    try {
        const res = await fetch(`/sessions/${sessionId}`, {
            method: 'DELETE'
        });

        const data = await res.json();

        if (data.success) {
            // Nếu xóa session hiện tại, chuyển sang session khác hoặc tạo mới
            if (sessionId === currentSessionId) {
                const remainingSessions = sessions.filter(s => s.sessionId !== sessionId);
                if (remainingSessions.length > 0) {
                    await switchToSession(remainingSessions[0].sessionId);
                    await loadSessions();
                    updateSessionSelector(sessionId);
                } else {
                    await createNewSession('Chat mới', false);
                }
            } else {
                await loadSessions();
                updateSessionSelector;
            }

            alert('Xóa session thành công!');
        } else {
            alert('Lỗi: ' + data.error);
        }
    } catch (err) {
        console.error('Lỗi khi xóa session:', err);
        alert('Không thể xóa session');
    }
}

// Hàm đổi session
async function switchToSession(sessionId) {
    if (sessionId === currentSessionId) {//Kiểm tra session
        return;//Nếu trùng thì về ko chạy tiếp
    }
    else {
        currentSessionId = sessionId;//ko trùng thì gán lại cái hiện tại
        localStorage.setItem('chatSessionId', sessionId);//Gán luôn vào local

        // Xóa hết khung chat r đợi load
        clearChatBox();
        //Display session mới
        updateCurrentSessionDisplay();
        // Đợi thằng ở dưới load xong r đổi
        await loadChatHistory(sessionId);
    }
}

//Hàm load lịch sử
async function loadChatHistory(sessionId) {//sessionid lấy từ thg ở trên
    try {
        const res = await fetch(`/history?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.messages && Array.isArray(data.messages)) {
            for (const msg of data.messages) {
                if (typeof msg.content === 'string') {
                    appendMessage(
                        msg.role,
                        msg.content,//gửi bình thường
                        null,
                        msg.metadata?.forceJsonData || null,
                        msg.metadata?.forceMermaidCode || null,
                        msg.metadata?.detectedJsonBlocks || [],
                        msg.metadata?.fileInfo || null
                    );
                } else if (Array.isArray(msg.content)) {
                    const textPart = msg.content.find(p => p.type === 'text')?.text || '';
                    appendMessage(
                        msg.role,
                        textPart,//có file
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
}

// Hàm xóa toàn bộ khung chat
function clearChatBox() {
    chatBox.innerHTML = '';
}

// Hiển thị khung chọn lựa
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}
//Ẩn khunng
function hideModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Đổi session
sessionSelector.addEventListener('change', function () {
    if (this.value && this.value !== currentSessionId) {//this.value trỏ tới phần tử DOM gán event ở đây là cái dropdown
        switchToSession(this.value);// this.value = sessionId từ dropdown
    }
});
//Popup cái khung tạo đoạn chat mới
newSessionBtn.addEventListener('click', function () {
    newSessionNameInput.value = ''; // Clear input
    showModal('newSessionModal');//Gọi hàm để hiển thị display = block
});
//Vẫn như trên nhưng là đổi tên
renameSessionBtn.addEventListener('click', function () {
    if (!currentSessionId) {
        alert('Chưa có session nào được chọn');
        return;
    }
    const currentSession = sessions.find(s => s.sessionId === currentSessionId);//Kiểm tra sessionId có tồn tại ko
    if (currentSession) {
        renameSessionNameInput.value = currentSession.sessionName;//Hiện thị tên session hiện tại
        showModal('renameSessionModal');//Bật khung chọn
    }
});
//Như trên nhưng là xóa
deleteSessionBtn.addEventListener('click', function () {
    if (!currentSessionId) {
        alert('Chưa có session nào được chọn');
        return;
    }

    deleteSession(currentSessionId);//Gọi hàm để xóa
});

// Xử lý hiển thị khung tạo mới
document.getElementById('confirmNewSession').addEventListener('click', async function () {
    const sessionName = newSessionNameInput.value.trim();
    hideModal('newSessionModal');
    await createNewSession(sessionName || null, true);
});
//Xử lý hiển thị khung đổi tên
document.getElementById('confirmRename').addEventListener('click', async function () {
    const newName = renameSessionNameInput.value.trim();
    if (!newName) {
        alert('Tên session không được để trống');
        return;
    }

    hideModal('renameSessionModal');
    await renameSession(currentSessionId, newName);
});

// Modal close handlers
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function () {
        const modalId = this.getAttribute('data-modal');
        if (modalId) {
            hideModal(modalId);
        }
    });
});
//Đóng khung chọn khi nhấn cancel
document.querySelectorAll('.modal-btn.secondary').forEach(cancelBtn => {
    cancelBtn.addEventListener('click', function () {
        const modalId = this.getAttribute('data-modal');
        if (modalId) {
            hideModal(modalId);
        }
    });
});

// Ẩn khung chọn của bất cứ đứa nào khi click xong
window.addEventListener('click', function (event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = 'none';
    }
});

// Nhấn enter để confirm tạo mới
newSessionNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('confirmNewSession').click();
    }
});
//Như trên nhưng là confim đổi tên
renameSessionNameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
        document.getElementById('confirmRename').click();
    }
});

// Load lại cái cây
window.addEventListener('DOMContentLoaded', async () => {
    await loadSessions();

    // Nếu có thì tải toàn bộ lịch sử cho cái session
    if (currentSessionId) {
        await loadChatHistory(currentSessionId);
    }
});
// Preview trên thanh chat
imageInput.addEventListener('change', function () {
    let oldPreview = document.getElementById('file-preview');//preview file được chọn
    if (oldPreview) oldPreview.remove();//chọn file mới thì xóa đi file cũ
    //Preview file là ảnh
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
            //Preview file là document
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
        }
    }
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
//xử lý khi nhấn submit gửi file
form.addEventListener('submit', function () {
    let oldPreview = document.getElementById('file-preview');
    if (oldPreview) oldPreview.remove();//Xóa file trên khung chat đi sau khi gửi

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
    const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g;//Lọc mermaid xuất hiện trong chat
    let processedText = text;

    // Loại bỏ JSON blocks khỏi text để tránh hiển thị trùng lặp
    if (detectedJsonBlocks.length > 0) {//kiểm tra có json ko
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
            msgDiv.appendChild(p);//hiển thị text
        } else if (part.type === 'mermaid') {
            const div = document.createElement('div');
            div.className = 'mermaid';
            div.textContent = part.content;
            msgDiv.appendChild(div);//hiểm thị mermaid code
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
            📄 File Json N8N:
            <button onclick="copyJsonBlock(this)" 
                    style="float: right; padding: 2px 6px; font-size: 12px; cursor: pointer;">
                Copy
            </button>
            <button onclick="dowloadJsonBlock(this)"
                    style="float: right; padding: 2px 6px; font-size: 12px; cursor: pointer;">
                Download
            </button>
             <button onclick="uploadJsonBlock(this)"
                    style="float: right; padding: 2px 6px; font-size: 12px; cursor: pointer;">
                Upload to n8n
            </button>
        </div>
        <pre style="background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto; max-height: 200px;">
        ${JSON.stringify(jsonBlock.parsed, null, 2)}</pre>
    </div>`;
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

    // // Hiển thị JSON data bắn lên
    // if (forceJsonData) {
    //     const jsonDiv = document.createElement('div');
    //     jsonDiv.className = 'json-display';
    //     jsonDiv.innerHTML = `
    //         <div style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 12px; margin-top: 10px;">
    //             <div style="font-weight: bold; color: #495057; margin-bottom: 8px;">📄 JSON Workflow:</div>
    //             <pre style="background: #fff; border: 1px solid #dee2e6; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto; max-height: 200px;">${JSON.stringify(forceJsonData, null, 2)}</pre>
    //         </div>
    //     `;
    //     msgDiv.appendChild(jsonDiv);
    // }

    // // Hiển thị Mermaid diagram bắn lên
    // if (forceMermaidCode) {
    //     const mermaidDiv = document.createElement('div');
    //     mermaidDiv.className = 'mermaid-display';
    //     mermaidDiv.innerHTML = `
    //         <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 12px; margin-top: 10px;">
    //             <div style="font-weight: bold; color: #856404; margin-bottom: 8px;">📄 Mermaid Diagram:</div>
    //             <div class="mermaid">${forceMermaidCode}</div>
    //         </div>
    //     `;
    //     msgDiv.appendChild(mermaidDiv);
    // }

    //HIển thị ảnh
    if (fileInfo) {
        if (fileInfo.type === 'image' && fileInfo.base64Data) {
            // Hiển thị ảnh từ base64 đã lưu
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

// Thay thế phần form 
form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const prompt = promptInput.value.trim();
    if (!prompt && !(jsonInput && jsonInput.files[0]) && !(imageInput.files && imageInput.files[0])) return;

    if (!currentSessionId) {
        alert('Chưa có session nào được chọn');
        return;
    }

    // Hiển thị file lên khung chat
    let userFileInfo = null;
    if (imageInput.files && imageInput.files[0]) {
        if (imageInput.files[0].type.startsWith('image/')) {//Nếu file là ảnh
            userFileInfo = {
                type: 'image',
                name: imageInput.files[0].name,
                size: imageInput.files[0].size,
                base64Data: URL.createObjectURL(imageInput.files[0])
            };
        } else {//Không phải ảnh thì nó sẽ là document
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
        // Xử lý tin nhắn bình thường
        await appendMessage('user', prompt, null, null, null, [], userFileInfo);

        const formData = new FormData(form);
        formData.append('sessionId', currentSessionId); // Thêm sessionId

        await appendMessage('ai', 'Đang trả lời...');
        //Gửi tin nhắn tới server
        try {
            const response = await fetch('/chat', {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            chatBox.removeChild(chatBox.lastChild);
            //Nhận data ai tạo
            if (data.reply) {
                await appendMessage('ai', data.reply, null, null, null, data.metadata?.detectedJsonBlocks || []);

                // Cập nhật session sau khi có tin nhắn mới
                await loadSessions();
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

// Hàm đọc file dưới dạng text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Không thể đọc file'));
        reader.readAsText(file);
    });
}
//Hàm hỗ trợ copy
function copyJsonBlock(button) {
    const pre = button.closest('.json-display').querySelector('pre');
    const text = pre.innerText;
    navigator.clipboard.writeText(text).then(() => {
        button.textContent = "Đã copy!";
        setTimeout(() => button.textContent = "Copy", 1500);
    }).catch(err => {
        window.alert("Lỗi khi copy: " + err);
    });
}

//Hàm hỗ trợ dowload
function dowloadJsonBlock(button) {
    // tìm block json-display
    const pre = button.closest('.json-display').querySelector('pre');
    const text = pre.innerText;

    try {
        // parse lại từ text để thành object JSON chuẩn
        const jsonObject = JSON.parse(text);

        // stringify lại cho đẹp
        const jsonString = JSON.stringify(jsonObject, null, 2);

        // tạo blob
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        let Name;
        const today = new Date().toString().split('T')[0];
        const currentSession = sessions.find(s => s.sessionId === currentSessionId);
        if (currentSession) {
            Name = currentSession.sessionName
        }
        // tạo link download
        const a = document.createElement('a');
        a.href = url;
        a.download = `${Name} ${today}.json`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        window.alert("❌ Lỗi khi download JSON: " + err.message);
    }
}

//Upload json lên n8n
async function uploadJsonBlock(button) {
    //lấy data workflow đã tạo
    const pre = button.closest('.json-display').querySelector('pre');
    const workflow = pre.innerText;
    //Hiển thị khung 
    showModal('workflowModal');
    //Tạo mô tả tự động
    const description = await fetch('api/description', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: workflow })
    });
    const descriptionData = await description.json(description);
    workflowDescription.value = descriptionData.result || '';
    let workflowData;
    try {
        workflowData = JSON.parse(workflow);
    } catch (err) {
        alert("❌ Lỗi: JSON không hợp lệ!");
        return;
    }

    showModal('workflowModal');

    const confirmBtn = document.getElementById('confirmWorkflowModal');

    // Gỡ listener cũ
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);

    newConfirmBtn.addEventListener('click', async () => {
        const userId = await initUser();
        const UserSetting = await fetch(`/api/user/${userId}/setting`);
        const userSettingsData = await UserSetting.json();
        const apiKey = userSettingsData.n8nApiKey;
        const baseUrl = userSettingsData.n8nBaseUrl;
        const currentSession = sessions.find(s => s.sessionId === currentSessionId);
        const session = currentSession.sessionName
        const name = document.getElementById('workflowName').value || 'Untitled Workflow';
        if (!session) return alert("⚠️ Vui lòng nhập tên workflow!");
        //Đăng lên n8n
        try {
            const UpLoadResponse = await fetch(`/api/n8n/workflows`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    baseUrl,
                    workflowData
                })
            });
            const UpLoadResult = await UpLoadResponse.json();
            if (UpLoadResponse.ok) {
                //Lưu lại workflow
                try {
                    const saveResponse = await fetch('/api/save-n8n-data', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            userID: userId,
                            n8nUrl: UpLoadResult.url,
                            n8ndata: UpLoadResult.data,
                            chatName: session,
                            workflowName: name,
                            description: workflowDescription.value,
                        })
                    });

                    const SaveResult = await saveResponse.json();
                    if (saveResponse.ok) {
                        alert(`✅ Workflow "${name}" đã được lưu thành công!`);
                    } else {
                        alert('❌ Lỗi khi lưu workflow: ' + (SaveResult.error || 'Unknown error'));
                    }
                } catch (error) {
                    alert('❌ Lỗi khi lưu workflow: ' + error.message);
                }
            } else {
                alert('❌ Lỗi khi upload workflow: ' + (UpLoadResult.error || 'Unknown error'));
            }
        } catch (error) {
            alert('❌ Lỗi khi upload workflow: ' + error.message);
        };


    });
}
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}
const token = getCookie('token');
console.log('Token from cookie:', token);
let userId = null;
async function initUser() {
    try {
        const res = await fetch(`/api/verify-token/${token}`);
        const data = await res.json();
        if (res.ok) {
            userId = data.userId;
            return userId;
        } else {
            console.error('Token verification failed:', data.error);
        }
    } catch (error) {
        response.status(500).json({ error: 'Internal server error' });
        console.error('Error verifying token:', error);
    }
}

// Nhấn Enter để gửi
promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit'));
    }
});

