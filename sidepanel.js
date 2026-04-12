/**
 * IPL Fantasy Advisor — Side Panel UI Logic
 *
 * Handles:
 * - API key setup & validation
 * - Triggering squad analysis
 * - Rendering Gemini responses (markdown → HTML)
 * - Follow-up chat conversation
 * - Settings modal
 */

(function () {
  "use strict";

  // ============ STATE ============
  let state = {
    apiKey: null,
    squadData: null,
    analysisResult: null,
    conversationHistory: [],
    isLoading: false,
  };

  // ============ DOM ELEMENTS ============
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    setupSection: $("#setupSection"),
    mainSection: $("#mainSection"),
    apiKeyInput: $("#apiKeyInput"),
    saveApiKey: $("#saveApiKey"),
    toggleKeyVisibility: $("#toggleKeyVisibility"),
    settingsBtn: $("#settingsBtn"),
    settingsModal: $("#settingsModal"),
    closeModal: $("#closeModal"),
    modalApiKey: $("#modalApiKey"),
    modalToggleKey: $("#modalToggleKey"),
    modalSaveKey: $("#modalSaveKey"),
    analyzeBtn: $("#analyzeBtn"),
    dumpBtn: $("#dumpBtn"),
    loadingState: $("#loadingState"),
    loadingTitle: $("#loadingTitle"),
    loadingSubtitle: $("#loadingSubtitle"),
    squadSummary: $("#squadSummary"),
    statCredits: $("#statCredits"),
    statTransfers: $("#statTransfers"),
    statOverseas: $("#statOverseas"),
    statNextMatch: $("#statNextMatch"),
    resultsSection: $("#resultsSection"),
    analysisContent: $("#analysisContent"),
    chatSection: $("#chatSection"),
    chatMessages: $("#chatMessages"),
    chatInput: $("#chatInput"),
    chatSendBtn: $("#chatSendBtn"),
    step1: $("#step1"),
    step2: $("#step2"),
    step3: $("#step3"),
  };

  // ============ INITIALIZATION ============
  async function init() {
    // Check if API key is already saved
    chrome.runtime.sendMessage({ type: "GET_API_KEY" }, (response) => {
      if (response?.success && response.key) {
        state.apiKey = response.key;
        showMain();
      } else {
        showSetup();
      }
    });

    bindEvents();
  }

  function bindEvents() {
    // Setup
    els.saveApiKey.addEventListener("click", handleSaveApiKey);
    els.apiKeyInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSaveApiKey();
    });
    els.toggleKeyVisibility.addEventListener("click", () => togglePasswordVisibility(els.apiKeyInput));

    // Settings modal
    els.settingsBtn.addEventListener("click", openSettings);
    els.closeModal.addEventListener("click", closeSettings);
    els.modalToggleKey.addEventListener("click", () => togglePasswordVisibility(els.modalApiKey));
    els.modalSaveKey.addEventListener("click", handleModalSaveKey);
    $(".modal-backdrop")?.addEventListener("click", closeSettings);

    // Analysis
    els.analyzeBtn.addEventListener("click", handleAnalyze);
    els.dumpBtn.addEventListener("click", handleDump);

    // Chat
    els.chatSendBtn.addEventListener("click", handleChatSend);
    els.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleChatSend();
      }
    });

    // Auto-resize chat input
    els.chatInput.addEventListener("input", () => {
      els.chatInput.style.height = "auto";
      els.chatInput.style.height = Math.min(els.chatInput.scrollHeight, 120) + "px";
    });
  }

  // ============ API KEY ============
  function handleSaveApiKey() {
    const key = els.apiKeyInput.value.trim();
    if (!key) {
      showToast("Please enter an API key", "error");
      return;
    }

    if (!key.startsWith("AIza")) {
      showToast("Invalid API key format — should start with AIza", "error");
      return;
    }

    chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key }, (response) => {
      if (response?.success) {
        state.apiKey = key;
        showToast("API key saved! ✨", "success");
        showMain();
      } else {
        showToast("Failed to save API key", "error");
      }
    });
  }

  function handleModalSaveKey() {
    const key = els.modalApiKey.value.trim();
    if (!key) {
      showToast("Please enter an API key", "error");
      return;
    }

    chrome.runtime.sendMessage({ type: "SAVE_API_KEY", key }, (response) => {
      if (response?.success) {
        state.apiKey = key;
        showToast("API key updated! ✨", "success");
        closeSettings();
      }
    });
  }

  function togglePasswordVisibility(input) {
    input.type = input.type === "password" ? "text" : "password";
  }

  // ============ VIEWS ============
  function showSetup() {
    els.setupSection.classList.remove("hidden");
    els.mainSection.classList.add("hidden");
  }

  function showMain() {
    els.setupSection.classList.add("hidden");
    els.mainSection.classList.remove("hidden");
  }

  function openSettings() {
    els.settingsModal.classList.remove("hidden");
    if (state.apiKey) {
      els.modalApiKey.value = state.apiKey;
    }
  }

  function closeSettings() {
    els.settingsModal.classList.add("hidden");
  }

  // ============ ANALYSIS ============
  async function handleAnalyze() {
    if (state.isLoading) return;
    state.isLoading = true;

    // Reset UI
    els.analyzeBtn.classList.add("hidden");
    els.dumpBtn?.classList.add("hidden");
    $(".action-hint")?.classList.add("hidden");
    els.loadingState.classList.remove("hidden");
    els.resultsSection.classList.add("hidden");
    els.chatSection.classList.add("hidden");
    els.squadSummary.classList.add("hidden");

    // Reset steps
    setStepState(1, "active");
    setStepState(2, "pending");
    setStepState(3, "pending");
    updateLoading("Scraping your squad...", "Reading player data from the transfer page");

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url?.includes("fantasy.iplt20.com")) {
        throw new Error("Please navigate to fantasy.iplt20.com/classic/transferteam first");
      }

      // Step 1: Scrape squad data
      let squadData;
      try {
        const scrapeResponse = await sendTabMessage(tab.id, { action: "scrapeAllTabs" });
        squadData = scrapeResponse.data;
      } catch (e) {
        // Try injecting content script first
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
          await sleep(600);
          const scrapeResponse = await sendTabMessage(tab.id, { action: "scrapeAllTabs" });
          squadData = scrapeResponse.data;
        } catch (e2) {
          // Last resort: just get the page text
          try {
            const textResponse = await sendTabMessage(tab.id, { action: "getPageText" });
            squadData = {
              meta: {},
              squad: [],
              pageText: textResponse.text,
              scrapedAt: new Date().toISOString(),
            };
          } catch (e3) {
            throw new Error("Cannot access the fantasy page. Please make sure you're on the transfer team page and refresh it.");
          }
        }
      }

      state.squadData = squadData;
      setStepState(1, "done");

      // Update squad summary bar
      if (squadData.meta) {
        updateSquadSummary(squadData.meta);
      }

      // Step 2: Analyzing fixtures
      setStepState(2, "active");
      updateLoading("Analyzing fixtures & venues...", "Computing match gaps and fixture density");
      await sleep(500);
      setStepState(2, "done");

      // Step 3: Gemini AI Analysis
      setStepState(3, "active");
      updateLoading("Generating AI recommendations...", "Gemini is analyzing your squad strategy");

      const analysisResponse = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          { type: "ANALYZE_WITH_DATA", squadData },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.success) {
              resolve(response.analysis);
            } else {
              reject(new Error(response?.error || "Analysis failed"));
            }
          }
        );
      });

      setStepState(3, "done");
      state.analysisResult = analysisResponse;

      // Store in conversation history
      state.conversationHistory = [
        { role: "user", text: "Analyze my squad and recommend transfers" },
        { role: "model", text: analysisResponse },
      ];

      // Render results
      await sleep(400);
      renderAnalysis(analysisResponse);

    } catch (error) {
      console.error("[IPL Fantasy Advisor] Analysis error:", error);
      renderError(error.message);
    } finally {
      state.isLoading = false;
      els.loadingState.classList.add("hidden");
      els.analyzeBtn.classList.remove("hidden");
      els.dumpBtn?.classList.remove("hidden");
      $(".action-hint")?.classList.remove("hidden");
    }
  }

  async function handleDump() {
    if (state.isLoading) return;
    state.isLoading = true;

    // Reset UI
    els.analyzeBtn.classList.add("hidden");
    els.dumpBtn?.classList.add("hidden");
    $(".action-hint")?.classList.add("hidden");
    els.loadingState.classList.remove("hidden");
    els.resultsSection.classList.add("hidden");
    els.chatSection.classList.add("hidden");
    els.squadSummary.classList.add("hidden");

    // Reset steps
    setStepState(1, "active");
    setStepState(2, "pending");
    setStepState(3, "pending");
    updateLoading("Scraping your squad...", "Reading player data for backup");

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url?.includes("fantasy.iplt20.com")) {
        throw new Error("Please navigate to fantasy.iplt20.com/classic/transferteam first");
      }

      // Step 1: Scrape squad data
      let squadData;
      try {
        const scrapeResponse = await sendTabMessage(tab.id, { action: "scrapeAllTabs" });
        squadData = scrapeResponse.data;
      } catch (e) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
          });
          await sleep(600);
          const scrapeResponse = await sendTabMessage(tab.id, { action: "scrapeAllTabs" });
          squadData = scrapeResponse.data;
        } catch (e2) {
          try {
            const textResponse = await sendTabMessage(tab.id, { action: "getPageText" });
            squadData = { meta: {}, squad: [], pageText: textResponse.text, scrapedAt: new Date().toISOString() };
          } catch (e3) {
            throw new Error("Cannot access the fantasy page. Please refresh the transfer team page.");
          }
        }
      }

      setStepState(1, "done");
      if (squadData.meta) updateSquadSummary(squadData.meta);

      // Step 2: Saving to logger
      setStepState(2, "active");
      updateLoading("Saving tracking data...", "Sending to local python logger on port 5050");
      
      await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: "DUMP_DATA", squadData }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (response?.success) {
            resolve();
          } else {
            reject(new Error(response?.error || "Local logger isn't running on port 5050"));
          }
        });
      });

      setStepState(2, "done");
      setStepState(3, "done");
      
      // Briefly show success
      updateLoading("Success!", "Data dumped cleanly to your project folder.");
      await sleep(1500);

    } catch (error) {
      console.error("[IPL Fantasy Advisor] Dump error:", error);
      renderError(error.message);
      els.resultsSection.classList.remove("hidden");
    } finally {
      state.isLoading = false;
      els.loadingState.classList.add("hidden");
      els.analyzeBtn.classList.remove("hidden");
      els.dumpBtn?.classList.remove("hidden");
      $(".action-hint")?.classList.remove("hidden");
    }
  }

  // ============ CHAT ============
  async function handleChatSend() {
    const question = els.chatInput.value.trim();
    if (!question || state.isLoading) return;

    state.isLoading = true;
    els.chatInput.value = "";
    els.chatInput.style.height = "auto";
    els.chatSendBtn.disabled = true;

    // Add user message
    addChatMessage(question, "user");

    // Add loading indicator
    const loadingEl = addChatLoading();

    try {
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(
          {
            type: "FOLLOW_UP",
            question,
            squadData: state.squadData,
            history: state.conversationHistory,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else if (response?.success) {
              resolve(response.response);
            } else {
              reject(new Error(response?.error || "Follow-up failed"));
            }
          }
        );
      });

      // Update conversation history
      state.conversationHistory.push(
        { role: "user", text: question },
        { role: "model", text: response }
      );

      // Remove loading, add response
      loadingEl.remove();
      addChatMessage(response, "ai");

    } catch (error) {
      loadingEl.remove();
      addChatMessage(`Error: ${error.message}`, "ai");
    } finally {
      state.isLoading = false;
      els.chatSendBtn.disabled = false;
    }
  }

  function addChatMessage(text, sender) {
    const msgEl = document.createElement("div");
    msgEl.className = `chat-msg ${sender}`;

    if (sender === "user") {
      msgEl.textContent = text;
    } else {
      const content = document.createElement("div");
      content.className = "analysis-content";
      content.innerHTML = renderMarkdown(text);
      msgEl.appendChild(content);
    }

    els.chatMessages.appendChild(msgEl);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    return msgEl;
  }

  function addChatLoading() {
    const loadingEl = document.createElement("div");
    loadingEl.className = "chat-msg ai";
    loadingEl.innerHTML = `
      <div class="chat-msg-loading">
        <div class="dot"></div>
        <div class="dot"></div>
        <div class="dot"></div>
      </div>
    `;
    els.chatMessages.appendChild(loadingEl);
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    return loadingEl;
  }

  // ============ RENDERING ============
  function renderAnalysis(text) {
    els.analysisContent.innerHTML = renderMarkdown(text);
    els.resultsSection.classList.remove("hidden");
    els.chatSection.classList.remove("hidden");

    // Smooth scroll to results
    els.resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderError(message) {
    let friendlyMessage = message;

    if (message.includes("GEMINI_API_KEY_NOT_SET")) {
      friendlyMessage = "API key not configured. Click the ⚙️ settings icon to add your Gemini API key.";
    } else if (message.includes("fantasy.iplt20.com")) {
      friendlyMessage = message;
    } else if (message.includes("401") || message.includes("403")) {
      friendlyMessage = "Invalid API key. Please check your Gemini API key in settings.";
    } else if (message.includes("429")) {
      friendlyMessage = "Rate limit exceeded. Please wait a moment and try again.";
    }

    els.analysisContent.innerHTML = `
      <div class="error-message">
        <strong>⚠️ Analysis Failed</strong>
        <p>${escapeHtml(friendlyMessage)}</p>
        <p style="margin-top: 8px; font-size: 11px;">If the issue persists, try refreshing the fantasy page and clicking Analyze again.</p>
      </div>
    `;
    els.resultsSection.classList.remove("hidden");
  }

  function updateSquadSummary(meta) {
    els.squadSummary.classList.remove("hidden");
    els.statCredits.textContent = meta.creditsLeft ?? "—";
    els.statTransfers.textContent = meta.transfersRemaining ?? meta.transfersMax ?? "—";
    els.statOverseas.textContent = meta.overseasCount != null ? `${meta.overseasCount}/4` : "—";
    els.statNextMatch.textContent = meta.deadlineMatch ?? "—";
  }

  function updateLoading(title, subtitle) {
    els.loadingTitle.textContent = title;
    els.loadingSubtitle.textContent = subtitle;
  }

  function setStepState(stepNum, state) {
    const stepEl = els[`step${stepNum}`];
    if (!stepEl) return;
    const indicator = stepEl.querySelector(".step-indicator");
    if (!indicator) return;

    indicator.classList.remove("active", "done");
    if (state === "active") indicator.classList.add("active");
    if (state === "done") indicator.classList.add("done");
  }

  // ============ MARKDOWN RENDERER ============
  function renderMarkdown(text) {
    if (!text) return "";

    let html = escapeHtml(text);

    // Code blocks (triple backtick)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre><code class="language-${lang}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Headers
    html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
    html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");

    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Horizontal rules
    html = html.replace(/^---$/gm, "<hr>");

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, "<blockquote>$1</blockquote>");

    // Tables
    html = renderTables(html);

    // Unordered lists
    html = html.replace(/^(\s*)[*\-] (.+)$/gm, (match, indent, content) => {
      return `<li>${content}</li>`;
    });

    // Wrap consecutive <li> elements in <ul>
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");

    // Line breaks — convert double newlines to paragraphs
    html = html
      .split("\n\n")
      .map(block => {
        block = block.trim();
        if (!block) return "";
        if (block.startsWith("<h") || block.startsWith("<ul") || block.startsWith("<ol") ||
            block.startsWith("<pre") || block.startsWith("<blockquote") || block.startsWith("<hr") ||
            block.startsWith("<table") || block.startsWith("<div")) {
          return block;
        }
        return `<p>${block.replace(/\n/g, "<br>")}</p>`;
      })
      .join("\n");

    return html;
  }

  function renderTables(html) {
    // Match markdown tables
    const tableRegex = /(\|.+\|\n\|[-|\s:]+\|\n(?:\|.+\|\n?)+)/g;

    return html.replace(tableRegex, (match) => {
      const lines = match.trim().split("\n");
      if (lines.length < 3) return match;

      const headers = lines[0].split("|").filter(c => c.trim()).map(c => c.trim());
      const rows = lines.slice(2).map(line => line.split("|").filter(c => c.trim()).map(c => c.trim()));

      let table = "<table><thead><tr>";
      for (const h of headers) {
        table += `<th>${h}</th>`;
      }
      table += "</tr></thead><tbody>";

      for (const row of rows) {
        table += "<tr>";
        for (const cell of row) {
          table += `<td>${cell}</td>`;
        }
        table += "</tr>";
      }
      table += "</tbody></table>";
      return table;
    });
  }

  // ============ HELPERS ============
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || "Message failed"));
        }
      });
    });
  }

  function showToast(message, type = "success") {
    // Remove existing toast
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ============ START ============
  init();
})();
