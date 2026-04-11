/**
 * IPL Fantasy Advisor — Background Service Worker
 *
 * Orchestrates:
 * 1. Content script communication (trigger DOM scraping)
 * 2. Gemini API calls for AI analysis
 * 3. Schedule data enrichment
 * 4. Side panel lifecycle
 */

import {
  buildScheduleContext,
  getUpcomingMatches,
  getMatchGaps,
  getTeamDensity,
  getTeamUpcoming,
  TEAM_NAMES,
  VENUE_PROFILES,
} from "./schedule.js";

// ============ SIDE PANEL SETUP ============

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});

// Enable side panel on fantasy.iplt20.com tabs
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ============ GEMINI API ============

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

async function getApiKey() {
  const result = await chrome.storage.local.get("gemini_api_key");
  return result.gemini_api_key || null;
}

async function callGemini(prompt, conversationHistory = []) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_NOT_SET");
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  // Build contents array with conversation history
  const contents = [];

  // Add conversation history
  for (const msg of conversationHistory) {
    contents.push({
      role: msg.role, // "user" or "model"
      parts: [{ text: msg.text }],
    });
  }

  // Add current prompt
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  const body = {
    contents,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
    tools: [
      {
        googleSearch: {}
      }
    ],
    systemInstruction: {
      parts: [{
        text: buildSystemPrompt(),
      }],
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;
    throw new Error(`Gemini API error: ${errorMsg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Empty response from Gemini");
  }

  return text;
}

function buildSystemPrompt() {
  return `You are an expert IPL Fantasy Cricket advisor for the TATA IPL Season Long Fantasy 2026 on fantasy.iplt20.com.

CRITICAL RULES — READ CAREFULLY:
1. IPL 2026 had a MEGA AUCTION. Player-team assignments have CHANGED from previous seasons. You MUST trust the team shown on the fantasy page (e.g., "SRH plays after 3 matches" means that player plays for SRH in IPL 2026). Do NOT use your pre-training knowledge to "correct" team assignments.
2. The "plays after X matches" info from the page is the GROUND TRUTH for scheduling. Use this instead of any other schedule data.
3. Only recommend removing players who are CONFIRMED in the user's current squad (shown with ❌ on the transfer page/listed under Confirmed 11 Players).
4. Only recommend adding players who are CURRENTLY playing in IPL 2026.
5. Search the web dynamically! You are connected to Google Search. You must use it to find out real-world pitch conditions, recent IPL 2026 form, and live details about the venues. Do NOT say "Without specific venue information..." — literally just search it using Google!

FANTASY LEAGUE RULES & ADVANCED STRATEGY:
- Squad of 11 players, total value ≤ 100 credits
- **Transfer Economy (CRITICAL)**: You only have 120 transfers for 74 matches (roughly 1.6 transfers per match). DO NOT recommend 3-4 transfers in a single match unless absolutely essential. Aim for 1-2 tactical transfers maximum. You do NOT need to remove every single player on a long break all at once; removing one or two is enough to save transfers for future matches.
- DO NOT recommend "IN" players who play in the next match but then have a huge gap immediately after. Prioritize "IN" players from teams that play MULTIPLE times in quick succession. Try to target teams playing 3 matches in the next 10-12 days.
- **Tactical Matchups**: Look at specific matchups using Search (e.g., how a batter plays against left-arm pace or right-arm spin). Value players whose skills align with the opposition's weaknesses.

FORMAT AND TONE RULES (CRITICAL):
1. **Be Concise**: Do not write overly verbose match previews. Cricket fans already know the basics. Say "Match 18: CSK vs DC at Chepauk. The pitch is historically spin-friendly but balanced recently." Avoid long repetitive paragraphs.
2. **Hide Internal Monologue**: Do NOT show your internal reasoning, mistakes, or chain-of-thought in the final answer (e.g., do not say "Wait, let me check my search results again..."). Only present the FINAL, polished conclusions and recommendations.

TRANSFER OPTIMIZATION:
- RESOURCE OPTIMIZATION: Every transfer must maximize value. A player from a team that plays AGAIN soon after costs just 1 transfer but covers multiple matches.
- FIXTURE DENSITY: If SRH plays in match N and again in match N+2, bringing in SRH players is more efficient than a team that plays once then not for 5 matches.
- SCHEDULE AWARENESS: Players whose team "plays after 4+ matches" are candidates for removal — they waste squad spots.
- CREDIT MANAGEMENT: Credits left is tight. Can't overshoot 100 credit budget.
- BALANCED: Not too aggressive (wasting transfers), not too conservative (missing points).

FORMAT: Use markdown with emojis:
- 🔴 OUT (remove) / 🟢 IN (add) / 💰 credit impact / ⚡ confidence (🔴 Essential / 🟡 Recommended / 🟢 Optional)
- 🏏 cricket reasoning / 📅 schedule reasoning / 👑 captain/VC picks

Be specific with player names, credit costs, and concrete cricket reasoning (form, venue, matchup). No vague advice.`;
}

// ============ ANALYSIS ENGINE ============

async function analyzeSquad(squadData) {
  // Build the analysis prompt using the squadSummary from the content script
  let prompt = `ANALYZE MY IPL FANTASY SQUAD AND RECOMMEND TRANSFERS\n\n`;

  // Use the squadSummary built by the content script (contains all tab texts)
  if (squadData.squadSummary) {
    prompt += squadData.squadSummary + "\n";
  } else {
    // Fallback: build from available data
    if (squadData.meta) {
      prompt += `=== SQUAD META ===\n`;
      prompt += `Next Match: ${squadData.meta.deadlineMatch ?? "unknown"}\n`;
      prompt += `Credits Left: ${squadData.meta.creditsLeft ?? "unknown"}\n`;
      prompt += `Transfers: ${squadData.meta.transfersUsed ?? "?"}/${squadData.meta.transfersMax ?? "?"} used (${squadData.meta.transfersRemaining ?? "?"} remaining)\n`;
      prompt += `Overseas: ${squadData.meta.overseasCount ?? "?"}/4\n`;
      prompt += `Players: ${squadData.meta.playersCount ?? "?"}\n\n`;
    }

    // Squad player texts (per role)
    if (squadData.squadPlayerTexts && squadData.squadPlayerTexts.length > 0) {
      prompt += `=== SELECTED SQUAD PLAYERS (from transfer page) ===\n`;
      for (const line of squadData.squadPlayerTexts) {
        prompt += `${line}\n`;
      }
      prompt += "\n";
    }

    // Raw tab texts
    if (squadData.rawTabTexts) {
      for (const [role, text] of Object.entries(squadData.rawTabTexts)) {
        if (text) {
          prompt += `=== ${role} TAB TEXT ===\n${text.substring(0, 1500)}\n\n`;
        }
      }
    }
  }

  // Add supplementary schedule context (marked as approximate)
  const scheduleContext = buildScheduleContext();
  prompt += `\n=== SUPPLEMENTARY SCHEDULE DATA (approximate, use "plays after X matches" from page as primary source) ===\n${scheduleContext}\n`;

  prompt += `\n=== TODAY'S DATE: ${new Date().toISOString().split("T")[0]} ===\n`;

  prompt += `\n=== TASK ===
Analyze the squad data above. The players listed under "[Confirmed 11 Players]" are my current exact 11-man squad.

IMPORTANT: 
- The NEXT MATCH is exactly: "${squadData.meta?.deadlineMatch ?? "Unknown"}". Ignore ANY schedule context that contradicts this. You MUST center your Match Preview and captaincy choices around ${squadData.meta?.deadlineMatch ?? "this upcoming match"}.
- Trust the team assignments from the page based on the "plays after N matches" string. Do NOT correct them based on older IPL seasons.

Please provide:
1. 🏟️ **Match Preview** — The upcoming match(es), venue, pitch analysis, key battles
2. 🔄 **Transfer Recommendations** — 2-4 transfers with detailed justification:
   - WHO to remove (must be in my squad) and WHY
   - WHO to bring in and WHY (current IPL 2026 form, venue suitability, opposition, fixture density ahead)
   - Credit impact and remaining budget
   - How many transfers this costs
3. 👑 **Captain & Vice-Captain** — Best picks for the next match
4. 📊 **Squad Health Score** (1-10) with reasoning
5. ⚠️ **Watch List** — Players to monitor for future gameweeks

Keep your response concise but structured. Do not exceed 500 words. Stick strictly to the available facts in the scraped text.
`;


  const response = await callGemini(prompt);
  return response;
}

async function handleFollowUp(question, squadData, conversationHistory) {
  const scheduleContext = buildScheduleContext();

  // Add schedule context to the follow-up
  let enrichedQuestion = question;
  if (!conversationHistory.some(m => m.text.includes("UPCOMING IPL 2026 MATCHES"))) {
    enrichedQuestion += `\n\n(Context: ${scheduleContext})`;
  }

  if (squadData) {
    enrichedQuestion += `\n\n(Current squad data is from the previous analysis. Credits left: ${squadData.meta?.creditsLeft ?? "?"}, Transfers remaining: ${squadData.meta?.transfersRemaining ?? "?"})`;
  }

  const response = await callGemini(enrichedQuestion, conversationHistory);
  return response;
}

// ============ MESSAGE HANDLER ============

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log("[IPL Fantasy Advisor] Background received:", request.type);

  if (request.type === "SAVE_API_KEY") {
    chrome.storage.local.set({ gemini_api_key: request.key }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.type === "GET_API_KEY") {
    getApiKey().then(key => {
      sendResponse({ success: true, key });
    });
    return true;
  }

  if (request.type === "ANALYZE_SQUAD") {
    handleAnalysis(request.tabId, sendResponse);
    return true;
  }

  if (request.type === "ANALYZE_WITH_DATA") {
    analyzeSquad(request.squadData)
      .then(result => sendResponse({ success: true, analysis: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "FOLLOW_UP") {
    handleFollowUp(request.question, request.squadData, request.history)
      .then(result => sendResponse({ success: true, response: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "GET_SCHEDULE") {
    const scheduleData = {
      upcoming: getUpcomingMatches(12),
      gaps: getMatchGaps(),
      density: getTeamDensity(14),
      context: buildScheduleContext(),
    };
    sendResponse({ success: true, data: scheduleData });
    return true;
  }

  if (request.type === "PING") {
    sendResponse({ success: true });
    return true;
  }
});

async function handleAnalysis(tabId, sendResponse) {
  try {
    // Step 1: Inject content script if needed and scrape
    let squadData;

    try {
      // Try to communicate with existing content script
      const response = await chrome.tabs.sendMessage(tabId, { action: "scrapeAllTabs" });
      squadData = response.data;
    } catch (e) {
      console.log("[IPL Fantasy Advisor] Content script not ready, injecting...");

      // Inject content script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"],
      });

      // Wait a bit for injection
      await new Promise(r => setTimeout(r, 500));

      // Try scraping again
      const response = await chrome.tabs.sendMessage(tabId, { action: "scrapeAllTabs" });
      squadData = response.data;
    }

    if (!squadData) {
      throw new Error("Failed to scrape squad data from the page");
    }

    // Step 2: Analyze with Gemini
    const analysis = await analyzeSquad(squadData);

    sendResponse({
      success: true,
      squadData,
      analysis,
    });

  } catch (error) {
    console.error("[IPL Fantasy Advisor] Analysis error:", error);
    sendResponse({
      success: false,
      error: error.message,
    });
  }
}
