let testName = "";
    let totalQuestions = 0;
    let currentQ = 0;
    let questions = [];

    function startCreating() {
      testName = document.getElementById("testName").value.trim();
      totalQuestions = parseInt(document.getElementById("numQuestions").value);

      if (!testName || !totalQuestions) {
        alert("Nhập đầy đủ tên và số câu hỏi!");
        return;
      }

      document.getElementById("createTest").classList.add("hidden");
      document.getElementById("questionForm").classList.remove("hidden");
      showQuestionForm();
    }

    function showQuestionForm() {
      document.getElementById("qTitle").innerText = 
        `Câu hỏi ${currentQ + 1}/${totalQuestions}`;
      document.getElementById("qText").value = "";
      document.getElementById("optA").value = "";
      document.getElementById("optB").value = "";
      document.getElementById("optC").value = "";
      document.getElementById("optD").value = "";
      document.getElementById("correctOpt").value = "0";
    }

    function saveQuestion() {
      const q = {
        id: currentQ + 1,
        question: document.getElementById("qText").value,
        options: [
          document.getElementById("optA").value,
          document.getElementById("optB").value,
          document.getElementById("optC").value,
          document.getElementById("optD").value,
        ],
        answer: parseInt(document.getElementById("correctOpt").value)
      };

      questions.push(q);
      currentQ++;

      if (currentQ < totalQuestions) {
        showQuestionForm();
      } else {
        document.getElementById("questionForm").classList.add("hidden");
        loadQuiz();
      }
    }

    function loadQuiz() {
      document.getElementById("quizArea").classList.remove("hidden");
      document.getElementById("quizTitle").innerText = "Bài kiểm tra: " + testName;

      const quizBox = document.getElementById("quizBox");
      quizBox.innerHTML = "";

      questions.forEach((q, index) => {
        const qDiv = document.createElement("div");
        qDiv.className = "question";
        qDiv.innerHTML = `
          <p><b>Câu ${index + 1}:</b> ${q.question}</p>
          ${q.options.map((opt, i) => `
            <label>
              <input type="radio" name="q${q.id}" value="${i}"> 
              ${String.fromCharCode(65 + i)}. ${opt}
            </label><br>
          `).join("")}
        `;
        quizBox.appendChild(qDiv);
      });
    }

    function submitQuiz() {
      let score = 0;
      questions.forEach(q => {
        const selected = document.querySelector(`input[name="q${q.id}"]:checked`);
        if (selected && parseInt(selected.value) === q.answer) {
          score++;
        }
      });
      alert(`Kết quả: ${score}/${questions.length} điểm`);
    }