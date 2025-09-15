document.getElementById("workflowForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const statusDiv = document.getElementById("status");
    const resultDiv = document.getElementById("result");
    const submitBtn = document.getElementById("submitBtn");

    // Clear previous results
    statusDiv.className = "";
    statusDiv.textContent = "";
    resultDiv.textContent = "";

    // Get form values
    const apiKey = document.getElementById("apiKey").value.trim();
    const baseUrl = document.getElementById("baseUrl").value.trim();
    const fileInput = document.getElementById("workflowFile");

    if (!fileInput.files[0]) {
        statusDiv.className = "error";
        statusDiv.textContent = "Vui lòng chọn file JSON";
        return;
    }

    const file = fileInput.files[0];

    // Validate file type
    if (!file.name.endsWith('.json')) {
        statusDiv.className = "error";
        statusDiv.textContent = "Vui lòng chọn file có định dạng .json";
        return;
    }

    try {
        submitBtn.disabled = true;
        statusDiv.className = "loading";
        statusDiv.textContent = "Đang đọc file...";

        // Read file content
        const fileContent = await readFileAsText(file);
        let workflowData;

        try {
            workflowData = JSON.parse(fileContent);
        } catch (parseError) {
            throw new Error("File JSON không hợp lệ: " + parseError.message);
        }

        statusDiv.textContent = "Đang gửi workflow lên n8n...";

        // Debug: Log workflow data structure
        console.log("Workflow data keys:", Object.keys(workflowData));
        console.log("Workflow data sample:", {
            name: workflowData.name,
            active: workflowData.active,
            nodes: workflowData.nodes?.length,
            connections: Object.keys(workflowData.connections || {}).length
        });

        // Gửi yêu cầu tới proxy để tạo workflow
        const response = await fetch("/api/n8n/workflows", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                apiKey: apiKey,
                baseUrl: baseUrl,
                workflowData: workflowData
            })
        });

        const responseData = await response.json();

        if (responseData.success) {
            statusDiv.className = "success";
            statusDiv.textContent = "Workflow đã được tạo thành công!";
            resultDiv.textContent = JSON.stringify(responseData.data, null, 2);
        } else {
            throw new Error(responseData.error || `API Error ${response.status}`);
        }

    } catch (error) {
        statusDiv.className = "error";

        if (error.message.includes('503')) {
            statusDiv.textContent = "Lỗi 503: n8n service không khả dụng. Kiểm tra:\n- n8n server có đang chạy không?\n- URL có đúng không?\n- API key có hợp lệ không?";
        } else if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
            statusDiv.textContent = "Lỗi kết nối: Không thể kết nối đến n8n server. Kiểm tra URL và đảm bảo n8n đang chạy.";
        } else {
            statusDiv.textContent = "Lỗi: " + error.message;
        }

        console.error("Upload error:", error);
    } finally {
        submitBtn.disabled = false;
    }
});

// Helper function to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error("Không thể đọc file"));
        reader.readAsText(file);
    });
}

// Test connection function
async function testConnection() {
    const apiKey = document.getElementById("apiKey").value.trim();
    const baseUrl = document.getElementById("baseUrl").value.trim();

    if (!apiKey || !baseUrl) {
        alert("Vui lòng nhập API key và Base URL");
        return;
    }
    //Gửi yêu cầu tới proxy để kiểm tra kết nối
    try {
        const response = await fetch("/api/n8n/test", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                apiKey: apiKey,
                baseUrl: baseUrl
            })
        });

        const result = await response.json();

        if (result.success) {
            alert(`Kết nối thành công! Tìm thấy ${result.workflowCount} workflows.`);
        } else {
            alert(`Lỗi kết nối: ${result.error}`);
        }
    } catch (error) {
        alert("Lỗi kết nối: " + error.message);
    }
}

