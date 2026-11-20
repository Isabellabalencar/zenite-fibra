(function () {
  "use strict";

  var config = window.ZENITE_CONFIG || {};
  var chat = document.getElementById("chat");
  var messages = document.getElementById("chat-messages");
  var form = document.getElementById("chat-form");
  var input = document.getElementById("chat-input");
  var sendBtn = form.querySelector("button");
  var suggestions = document.getElementById("chat-suggestions");
  var greeted = false;
  var busy = false;

  // ID de sessão: o n8n usa para manter a memória da conversa
  var sessionId = (function () {
    var key = "zenite_session_id";
    try {
      var saved = localStorage.getItem(key);
      if (saved) return saved;
    } catch (e) { /* storage indisponível */ }
    var id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
      : "s-" + Date.now() + "-" + Math.random().toString(36).slice(2);
    try { localStorage.setItem(key, id); } catch (e) { /* ignora */ }
    return id;
  })();

  function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Markdown simples e seguro (o texto é escapado antes)
  function renderMarkdown(text) {
    var lines = escapeHtml(text.trim()).split(/\r?\n/);
    var html = "";
    var list = null;
    lines.forEach(function (raw) {
      var line = raw
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
      var ul = line.match(/^\s*[-*•]\s+(.*)/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)/);
      var type = ul ? "ul" : ol ? "ol" : null;
      if (type) {
        if (list !== type) { if (list) html += "</" + list + ">"; html += "<" + type + ">"; list = type; }
        html += "<li>" + (ul || ol)[1] + "</li>";
        return;
      }
      if (list) { html += "</" + list + ">"; list = null; }
      if (line.trim()) html += "<p>" + line + "</p>";
    });
    if (list) html += "</" + list + ">";
    return html;
  }

  function addMessage(text, who) {
    var el = document.createElement("div");
    el.className = "msg msg--" + who;
    if (who === "user") el.textContent = text;
    else el.innerHTML = renderMarkdown(text);
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "msg msg--bot typing";
    el.setAttribute("aria-label", "Digitando");
    el.innerHTML = "<i></i><i></i><i></i>";
    messages.appendChild(el);
    messages.scrollTop = messages.scrollHeight;
    return el;
  }

  // Aceita vários formatos de resposta do n8n
  function extractAnswer(data) {
    if (data == null) return "";
    if (typeof data === "string") return data;
    if (Array.isArray(data)) return extractAnswer(data[0]);
    return data.resposta || data.output || data.text || data.message || "";
  }

  function openChat(question) {
    chat.hidden = false;
    document.body.classList.add("chat-open");
    if (!greeted) {
      greeted = true;
      addMessage("Olá! Eu sou a **Lia**, assistente virtual da Zênite Fibra. 👋\nPosso ajudar com planos, instalação, problemas de conexão, faturas e muito mais. Como posso ajudar?", "bot");
    }
    if (question) send(question);
    else setTimeout(function () { input.focus(); }, 50);
  }

  function closeChat() {
    chat.hidden = true;
    document.body.classList.remove("chat-open");
  }

  function setBusy(value) {
    busy = value;
    sendBtn.disabled = value;
    input.disabled = value;
  }

  function send(text) {
    text = (text || "").trim();
    if (!text || busy) return;
    suggestions.hidden = true;
    addMessage(text, "user");
    input.value = "";

    if (!config.webhookUrl) {
      addMessage("O chat ainda não está conectado ao n8n. Configure a URL do webhook no arquivo assets/js/config.js.", "error");
      return;
    }

    setBusy(true);
    var typing = showTyping();
    var controller = window.AbortController ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, config.timeoutMs || 60000) : null;

    fetch(config.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: sessionId, mensagem: text }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        var type = res.headers.get("content-type") || "";
        return type.indexOf("application/json") !== -1 ? res.json() : res.text();
      })
      .then(function (data) {
        var answer = extractAnswer(data);
        typing.remove();
        addMessage(answer || "Desculpe, não consegui gerar uma resposta agora. Pode tentar de novo?", "bot");
      })
      .catch(function (err) {
        typing.remove();
        var msg = err && err.name === "AbortError"
          ? "A resposta demorou mais que o esperado. Tente novamente em instantes."
          : "Não consegui falar com o servidor de suporte agora. Tente novamente em instantes.";
        addMessage(msg, "error");
        if (window.console) console.error("[Zênite chat]", err);
      })
      .finally(function () {
        if (timer) clearTimeout(timer);
        setBusy(false);
        input.focus();
      });
  }

  document.querySelectorAll("[data-open-chat]").forEach(function (btn) {
    btn.addEventListener("click", function () { openChat(btn.getAttribute("data-question")); });
  });
  document.querySelector("[data-close-chat]").addEventListener("click", closeChat);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !chat.hidden) closeChat(); });

  form.addEventListener("submit", function (e) { e.preventDefault(); send(input.value); });
  suggestions.addEventListener("click", function (e) {
    if (e.target.tagName === "BUTTON") send(e.target.textContent);
  });
})();
