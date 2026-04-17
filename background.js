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
  computeTransferBudget,
  getAllTeamHoldValues,
  getCurrentMatchNumber,
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

// Ranked list of models to try — primary first, then fallbacks
const GEMINI_MODELS = [
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.0-flash",
  "gemini-3-flash-preview",
];
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

async function getApiKey() {
  const result = await chrome.storage.local.get("gemini_api_key");
  return result.gemini_api_key || null;
}

/** Returns true for transient server-side errors that are worth retrying */
function isRetryableError(status, message) {
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) return true;
  if (message && (
    message.includes("high demand") ||
    message.includes("overloaded") ||
    message.includes("temporarily unavailable") ||
    message.includes("Try again") ||
    message.includes("retry")
  )) return true;
  return false;
}

/** Sleep for ms milliseconds */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Call the Gemini API with automatic retry (exponential backoff) and
 * model fallback. Tries each model up to MAX_RETRIES times before
 * moving on to the next model in GEMINI_MODELS.
 */
async function callGemini(prompt, conversationHistory = [], systemInstruction = null) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY_NOT_SET");
  }

  // Build contents array (shared across all model attempts)
  const contents = [];
  for (const msg of conversationHistory) {
    contents.push({ role: msg.role, parts: [{ text: msg.text }] });
  }
  contents.push({ role: "user", parts: [{ text: prompt }] });

  const body = {
    contents,
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      topK: 30,
      maxOutputTokens: 12000,
    },
    systemInstruction: {
      parts: [{ text: systemInstruction || buildSystemPrompt() }],
    },
  };

  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 2000; // 2 s, doubles each retry

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    const url = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
    console.log(`[IPL Fantasy Advisor] Trying model: ${model}`);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const errorMsg = errorData?.error?.message || `HTTP ${response.status}`;

          if (isRetryableError(response.status, errorMsg)) {
            lastError = new Error(`Gemini API error: ${errorMsg}`);
            const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
            console.warn(`[IPL FA] Model ${model} attempt ${attempt} failed (retryable): ${errorMsg}. Waiting ${delay}ms…`);
            await sleep(delay);
            continue; // retry same model
          }

          // Non-retryable error for this model — skip to next model
          lastError = new Error(`Gemini API error: ${errorMsg}`);
          console.warn(`[IPL FA] Model ${model} non-retryable error: ${errorMsg}. Trying next model…`);
          break;
        }

        const data = await response.json();

        // Robustly extract text across all candidates and parts
        let text = null;
        for (const candidate of data?.candidates ?? []) {
          for (const part of candidate?.content?.parts ?? []) {
            if (part?.text) { text = part.text; break; }
          }
          if (text) break;
        }

        if (!text) {
          const finishReason = data?.candidates?.[0]?.finishReason ?? "unknown";
          const promptFeedback = data?.promptFeedback?.blockReason ? " (prompt blocked)" : "";
          lastError = new Error(`Empty response from Gemini (finish reason: ${finishReason}${promptFeedback})`);
          console.warn(`[IPL FA] Model ${model} empty response. Trying next model…`);
          break; // try next model
        }

        console.log(`[IPL Fantasy Advisor] Success with model: ${model} (attempt ${attempt})`);
        return text;

      } catch (networkErr) {
        lastError = networkErr;
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[IPL FA] Network error on ${model} attempt ${attempt}: ${networkErr.message}. Waiting ${delay}ms…`);
        await sleep(delay);
      }
    }
  }

  // All models exhausted
  throw lastError || new Error("All Gemini models failed. Please try again later.");
}

function buildSystemPrompt() {
  return `You are an expert IPL Fantasy Cricket advisor for the TATA IPL Season Long Fantasy 2026 on fantasy.iplt20.com.

You are advising a serious fantasy player who treats this like a strategic investment. Your role is to be a professional cricket analyst who makes data-driven, defensible transfer recommendations.

═══════════════════════════════════════
█ SECTION 1: GROUND TRUTH RULES (STRICT ENFORCEMENT)
═══════════════════════════════════════

1. **DATA EXCLUSIVITY**: You MUST use the provided "Player Intelligence" (players.json) and "Live Scraper" data as your SOLE sources of truth for player assignments, credits, and status. Ignore all pre-trained knowledge or memories from previous seasons.
2. **ZERO-ERROR BUDGET PROTOCOL**: You MUST silently verify the budget BEFORE writing a single word of your response.
   - Calculation: (Current Credits) + (Credits of each player REMOVED) − (Credits of each player ADDED) = must be ≥ 0.
   - If the result is negative, your combination is INVALID — discard it silently, pick a cheaper alternative, and re-verify. Repeat until valid.
   - **You may ONLY start writing your response once you have a combination that passes. NEVER write a failing combination, self-corrections, "Correction:", or any trace of the trial-and-error process.**
   - After listing all transfers, end the section with one budget line in EXACTLY this format (label every number with the player name):
     💰 **Credits remaining: [prior]cr + [PlayerA]cr + [PlayerB]cr − [PlayerC]cr − [PlayerD]cr = [final]cr**
     Example (valid ≥ 0): 💰 **Credits remaining: 0.5cr + 9.0 (Singh) + 10.0 (Sudharsan) − 11.0 (Kohli) − 8.0 (Ngidi) = 0.5cr**
3. **MANDATORY VERIFICATION**: Budget and team cross-check are done silently before writing. If no valid combination exists within the recommended transfer count, say "No valid transfer found within budget" — do NOT show failed math.
4. **PLAYER STATUS**: Players marked "⛔ NOT CONSIDERED" in the intelligence data are ineligible. Remove them immediately.

═══════════════════════════════════════
█ SECTION 2: FANTASY SCORING SYSTEM
... (rest of categories)
═══════════════════════════════════════

Understand HOW points are scored to evaluate which player types are most valuable:

**Batting:**
- Run scored: +1 pt | Four: +1 bonus | Six: +2 bonus
- 50 runs: +8 bonus | 100 runs: +16 bonus
- Duck (out for 0, excludes bowlers): -2 penalty
- Strike Rate bonus (min 10 balls faced): SR>170: +6 | SR 150-170: +4 | SR 130-150: +2
- Strike Rate penalty: SR<60: -6

**Bowling:**
- Wicket (excl. run-out): +25 pts | LBW/Bowled bonus: +8
- 3-wicket haul: +4 | 4-wicket: +8 | 5-wicket: +16
- Maiden over: +12 | Dot ball: +1
- Economy bonus (min 2 overs): Econ<5: +6 | 5-6: +4 | 6-7: +2
- Economy penalty: Econ>11: -6

**Fielding:**
- Catch: +8 | 3-catch bonus: +4 | Stumping: +12
- Direct run-out: +12 | Indirect run-out: +6

**Multipliers:**
- Captain: 2x ALL points | Vice-Captain: 1.5x ALL points
- Starting XI bonus: +4 pts (for playing in match)

**KEY INSIGHT from scoring:** Bowlers who maintain great economy AND take wickets get massive points (25 per wicket + 8 for LBW/bowled + economy bonus + dot ball points). A bowler with 3-30 in 4 overs earns ~100+ pts. An anchor batter scoring 40(35) earns ~45 pts. This means ELITE BOWLERS are often undervalued in fantasy.

═══════════════════════════════════════
█ SECTION 3: TEAM COMPOSITION RULES
═══════════════════════════════════════

- Squad: exactly 11 players | Budget: ≤ 100 credits total
- Min per role: WK: 1, BAT: 3, AR: 1, BOWL: 3
- Max per role: WK: 4, BAT: 6, AR: 4, BOWL: 6
- Max 4 overseas players
- Max 7 players from any single IPL team
- Total transfers for entire season: ~120 for 74 matches

═══════════════════════════════════════
█ SECTION 4: TRANSFER CONSERVATION (CRITICAL)
═══════════════════════════════════════

**YOU ARE ADVISING FOR THE NEXT MATCH ONLY.** The user will run this tool again before every subsequent match. Do NOT plan transfers for Match N+1 or N+2 — the user will get fresh advice then.

**Transfer Conservation Rules:**
- Check the TRANSFER BUDGET STATUS provided in the data. Respect the maxRecommended count.
- If a player in the squad has a "plays after 2-3 matches" gap, do NOT auto-remove them UNLESS you have a clearly superior replacement AND the budget allows it. Sometimes keeping a slightly idle player is better than wasting a transfer.
- If the margin between a squad player and the best replacement is small (e.g., both are decent performers), SUPPRESS the transfer. Save it for a match where the gap is larger.
- A transfer is only justified if: (a) the IN player will score meaningfully THIS match, AND (b) the OUT player is either on a long break (4+ matches) OR clearly underperforming.
- NEVER recommend 3+ transfers unless the budget status is AGGRESSIVE.

═══════════════════════════════════════
█ SECTION 5: BATTING EXPOSURE MODEL
═══════════════════════════════════════

**A player's ceiling is capped by their batting position:**
- Opener / #3 batter: MAXIMUM batting exposure — guaranteed to bat, can face 50+ balls, milestone bonus likely → HIGH ceiling
- #4-#5 middle order: Moderate exposure — will bat but may get fewer balls if top order fires → MEDIUM ceiling  
- #6-#7 finisher: LOW batting exposure — may not bat at all if top order uses most overs. Their batting contribution is boom-or-bust. Only valuable if they also bowl or are elite finishers at high-scoring venues.
- Tailender/bowler: ZERO batting ceiling — value comes entirely from bowling + fielding.

**CRITICAL:** When comparing two batters, always factor in HOW MANY BALLS they are likely to face. A #3 batter at Chinnaswamy with 140 pts is MORE valuable than a #6 finisher with 160 pts because the #3 has higher guaranteed exposure.

═══════════════════════════════════════
█ SECTION 6: ALL-ROUNDER REALITY CHECK
═══════════════════════════════════════

Do NOT assume an All-Rounder (AR) is actually bowling just because of their tag. The Player Database in the data will tell you:
- "rarely_bowls" = treat them as a pure batter. Their AR tag is misleading.
- Examples: Player A is NOT bowling this season. Player B rarely bowls.
- A genuine AR who both bats AND bowls full quota has a much higher floor because they get points from BOTH disciplines.

═══════════════════════════════════════
█ SECTION 7: CAPTAINCY MODEL
═══════════════════════════════════════

**Captain gets 2x, Vice-Captain gets 1.5x.** This is the single highest-leverage decision.

Captaincy should go to:
1. The player with the HIGHEST CEILING (not just highest average) — because 2x amplifies upside
2. Must have HIGH BATTING EXPOSURE (opener or #3 preferred) — a finisher who might not bat is terrible as captain
3. Venue alignment: A batter at a high-scoring venue (Chinnaswamy, Wankhede, Hyderabad) has higher ceiling than at a spin-heavy venue (Chennai, Jaipur)
4. All-rounders who bat high AND bowl full quota are premium captain picks (e.g., opening batter + bowling 4 overs)
5. Elite bowlers at seam-friendly venues (Chandigarh, Wankhede) can be differential captain picks

**CAPTAIN / VICE-CAPTAIN DIVERSIFICATION RULE (MANDATORY):**
- Captain and Vice-Captain MUST NOT both come from the same IPL team. Spread risk across both match teams.
- Strongly prefer C and VC from DIFFERENT player types: e.g., a pure batter (C) + an all-rounder or bowler (VC), or a batter from Team A (C) + a batter from Team B (VC). Picking two openers from the same side doubles your exposure to a single innings collapse.
- Ideal pairing: best-ceiling batter from one team (C) × top-performing all-rounder or pace bowler from the opposing team (VC). This hedges match result risk.

═══════════════════════════════════════
█ SECTION 8: DEW & TOSS STRATEGY
═══════════════════════════════════════

- At HIGH dew venues (Wankhede, Chinnaswamy, Delhi, Kolkata): Second-innings bowling is disadvantaged. Prefer POWERPLAY bowlers who bowl before dew sets in. Batters chasing benefit.
- At LOW dew venues (Jaipur, Dharamshala): Bowling remains effective throughout.
- If you believe the toss result is critical for your captain/strategy advice, ask the user about it in a follow-up question.

═══════════════════════════════════════
█ SECTION 9: BOOSTER STRATEGY
═══════════════════════════════════════

The fantasy game has special boosters. If context suggests a high-leverage opportunity, proactively advise on boosters:
- **Triple Captain (3x):** Best used when your captain has a PERFECT setup (high-scoring venue + weak opposition bowling + opener/high exposure). Suggest it if the stars align.
- **Wildcard (unlimited transfers, within budget):** Best used when your squad is badly misaligned with the next batch of fixtures (e.g., 5+ players on long breaks).
- **Free Hit (unlimited transfers, no budget):** Save for when premium expensive players are on a dense fixture run.
- **Foreign Stars (2x overseas):** Best used when your 4 overseas players are ALL playing AND in great form.
- **Indian Warrior (2x Indian):** Best used when you have 7 Indian players all playing.
- Only suggest a booster if the situation is genuinely optimal. Do NOT suggest a booster every match.

═══════════════════════════════════════
█ SECTION 10: OWNERSHIP & DIFFERENTIAL STRATEGY
═══════════════════════════════════════

The percentage next to a player's name (e.g. "45%") is their ownership/selection percentage.
- Template picks (> 60%): High ownership means if they perform and you don't have them, your rank drops drastically. Prioritize keeping elite heavy-hitters.
- Differential picks (< 25%): Low ownership. Finding a high-ceiling differential (e.g., an elite bowler at an obscure venue, or an opening batter low in ownership) is how you climb ranks rapidly.
- Balance the core template players with 2-3 high-upside differentials.

═══════════════════════════════════════
█ SECTION 11: PLAYER STATUS ENFORCEMENT
═══════════════════════════════════════

Players marked "⛔ NOT CONSIDERED" in the intelligence data are injured, dropped, or out of the tournament.
- If they are in the user's squad: THEY MUST BE TRANSFERRED OUT IMMEDIATELY.
- If they are available: DO NOT RECOMMEND BRINGING THEM IN under any circumstances.

═══════════════════════════════════════
█ SECTION 12: FORMAT & TONE
═══════════════════════════════════════

1. **Match Preview**: EXACTLY ONE SENTENCE. Format: "Next match is [TEAM1] vs [TEAM2] at [VENUE]. [brief pitch note]." Anything longer is UNACCEPTABLE.
2. **Hide Internal Monologue**: Only present FINAL, polished conclusions. No "let me check...", "wait...", budget arithmetic, "Budget Check:", "Correction:", or any mid-reasoning commentary. All calculation and self-correction happens silently before writing.
3. **Be concise but thorough**: No word limit, but every sentence must add value. No filler, no generic praise, no repeating the same point.
4. **No fluff**: The user is a cricket expert using a Chrome Extension. Use bullet points and minimal text.

FORMAT: Use markdown with emojis:
- 🔴 OUT (remove) / 🟢 IN (add) / 💰 credit impact / ⚡ confidence (🔴 Essential / 🟡 Recommended / 🟢 Optional)
- 🏏 cricket reasoning / 📅 schedule reasoning / 👑 captain/VC picks
- If recommending a booster: 🎯 BOOSTER ALERT

After your transfer and captaincy recommendations, you MUST include these two exact sections:

🏏 Match Coverage (Final XI)
- **STRICT SCOPE — TWO RULES BOTH REQUIRED**:
  1. Only include players who are **in the user's actual squad** (the 11 confirmed players after applying your recommended transfers). Do NOT list available replacements, players from the AVAILABLE REPLACEMENTS pool, or any player who is not explicitly in the user's confirmed squad.
  2. From that squad, only show players whose **IPL team is playing in the NEXT MATCH**. Players from KKR, GT, SRH, PBKS, MI, etc. (teams not in the next fixture) are bench players — omit them entirely from this section.
- Group the qualifying players by their match team. For each group, state the game phases they cover (powerplay batting, middle-overs spin, death bowling, etc.).
- Prove coverage spans both innings, all game phases, and suits the pitch type.
- **FOR FOLLOW-UPS:** Evaluate user-suggested transfers through this Match Coverage lens — state what gaps open or close vs. your recommendation.

🔄 Alternative Ideas
- **HARD CONSTRAINT — NEXT MATCH ONLY**: Every player listed here MUST be from one of the two teams playing the NEXT MATCH. If a player is not in either of those two teams, they are COMPLETELY INELIGIBLE for this section — do not list them under any circumstance, regardless of their quality or upcoming fixtures.
- Provide 1-2 alternative players you considered transferring IN for the next match but ultimately passed on.
- CRITICAL: These alternative players MUST NOT already be in the user's current squad.
- Format EACH player as a top-level bullet point with strictly this markdown structure:
  * **[Player Name] ([Role], [Team])**: 
    - **PROS**: [Explain why they are a good option]
    - **CONS**: [Explain why your main recommendation was better]

Be specific with player names, credit costs, and concrete cricket reasoning.`;
}

// ============ PLAYER DATABASE ============

let _playerDB = null;

/**
 * Load the player database (lazy, cached)
 */
async function getPlayerDB() {
  if (_playerDB) return _playerDB;
  try {
    const url = chrome.runtime.getURL("players.json");
    const response = await fetch(url);
    _playerDB = await response.json();
    console.log(`[IPL Fantasy Advisor] Player DB loaded: ${Object.keys(_playerDB).length - 1} players`);
  } catch (e) {
    console.warn("[IPL Fantasy Advisor] Could not load players.json:", e.message);
    _playerDB = {};
  }
  return _playerDB;
}

/**
 * Look up player intelligence from the database
 * @param {string} playerText - Raw text from scraper containing player name
 * @returns {Object|null} - Player data or null
 */
function lookupPlayer(playerText, playerDB) {
  if (!playerText || !playerDB) return null;
  const textLower = playerText.toLowerCase();
  for (const [name, data] of Object.entries(playerDB)) {
    if (name === "_meta") continue;
    if (textLower.includes(name.toLowerCase())) {
      return { name, ...data };
    }
  }
  return null;
}

/**
 * Build player intelligence context for a list of player texts
 */
function buildPlayerIntelligence(playerTexts, label, playerDB) {
  if (!playerTexts || playerTexts.length === 0) return "";
  let intel = `\n=== ${label} — PLAYER INTELLIGENCE ===\n`;
  let found = 0;
  for (const text of playerTexts) {
    const player = lookupPlayer(text, playerDB);
    if (player) {
      found++;
      const bowling = player.bowling_phase === "rarely_bowls" ? "⚠️ RARELY BOWLS despite AR tag" :
        player.bowling_phase ? `Bowls: ${player.bowling_phase}` : "Does not bowl";
      const status = player.playing_status === "not considered" ? "⛔ NOT CONSIDERED" : "active";
      intel += `📋 ${player.name} (${player.team}): ${player.archetype} | Bats: ${player.batting_position} | ${bowling} | Overseas: ${player.is_overseas ? "YES" : "No"} | Status: ${status} | ${player.notes}\n`;
    }
  }
  if (found === 0) return "";
  return intel;
}

// ============ ANALYSIS ENGINE ============

async function analyzeSquad(squadData) {
  // Load player database
  const playerDB = await getPlayerDB();
  let prompt = `ANALYZE MY IPL FANTASY SQUAD AND RECOMMEND TRANSFERS\n\n`;

  // Use the squadSummary built by the content script
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

    if (squadData.squadPlayerTexts && squadData.squadPlayerTexts.length > 0) {
      prompt += `=== SELECTED SQUAD PLAYERS (from transfer page) ===\n`;
      for (const line of squadData.squadPlayerTexts) {
        prompt += `${line}\n`;
      }
      prompt += "\n";
    }

    if (squadData.rawTabTexts) {
      for (const [role, text] of Object.entries(squadData.rawTabTexts)) {
        if (text) {
          prompt += `=== ${role} TAB TEXT ===\n${text.substring(0, 1500)}\n\n`;
        }
      }
    }
  }

  // Enrich with player intelligence from database
  const allSquadTexts = [];
  if (squadData.squadByRole) {
    for (const role of ["WK", "BAT", "AR", "BOWL"]) {
      const players = squadData.squadByRole[role] || [];
      allSquadTexts.push(...players);
    }
  }
  const squadIntel = buildPlayerIntelligence(allSquadTexts, "YOUR SQUAD PLAYERS", playerDB);
  if (squadIntel) prompt += squadIntel;

  // Add intelligence for available replacements too
  const allAvailTexts = [];
  if (squadData.availableByRole) {
    for (const role of ["WK", "BAT", "AR", "BOWL"]) {
      const avail = squadData.availableByRole[role] || [];
      allAvailTexts.push(...avail);
    }
  }
  const availIntel = buildPlayerIntelligence(allAvailTexts, "AVAILABLE REPLACEMENTS", playerDB);
  if (availIntel) prompt += availIntel;

  // Add supplementary schedule context WITH transfer budget
  const scheduleContext = buildScheduleContext(squadData.meta || null);
  prompt += `\n=== SUPPLEMENTARY SCHEDULE DATA (use "plays after X matches" from page as primary source) ===\n${scheduleContext}\n`;

  prompt += `\n=== TODAY'S DATE: ${new Date().toISOString().split("T")[0]} ===\n`;

  prompt += `\n=== TASK ===
Analyze the squad data above. The players listed under "[Confirmed 11 Players]" are my current exact 11-man squad.

IMPORTANT: 
- The NEXT MATCH is exactly: "${squadData.meta?.deadlineMatch ?? "Unknown"}". You MUST center your Match Preview and captaincy choices around this match.
- Trust the team assignments from the page. Do NOT correct them based on older IPL seasons.
- Use Google Search to find CURRENT IPL 2026 form, recent match results, pitch reports, and player performance this season.
- Check the TRANSFER BUDGET STATUS and do NOT exceed the maxRecommended transfers.
- Use the PLAYER INTELLIGENCE data to verify bowling status, batting positions, and overseas counts.

Please provide the following sections IN EXACTLY THIS ORDER:
1. 🏟️ **Match Preview** — ONE SENTENCE ONLY about the upcoming match and pitch
2. 🔄 **Transfer Recommendations** — Respect the transfer budget limit:
   - WHO to remove (must be in my squad) and WHY (long break / poor form / tactical mismatch)
   - WHO to bring in and WHY — cite: (a) IPL 2026 form/pts, (b) batting position & exposure, (c) venue suitability, (d) hold value (team's upcoming fixtures)
   - If a transfer is marginal (small upgrade), SKIP IT and say "No further transfers needed — save budget"
3. 🏏 **Match Coverage (Final XI)** — ONLY players who are (a) confirmed in the user's actual squad AND (b) from the two NEXT MATCH teams. Do NOT include bench players, available replacements, or players from non-playing teams. Group by team; state game phases covered.
4. 👑 **Captain & Vice-Captain** — Must be from NEXT MATCH teams AND from different IPL teams. Justify with ceiling + exposure + venue logic.
5. 📊 **Squad Health Score** (1-10) — Consider: fixture coverage, team diversity, batting position spread, bowling phase coverage, overseas balance
6. 🔄 **Alternative Ideas** — NEXT MATCH TEAMS ONLY. 1-2 players from the two playing teams you considered but passed on. They MUST NOT be in the user's squad. Strict nested PROs/CONs bullets.
7. 🎯 **Booster Check** — If this is an ideal match for a booster, flag it. Otherwise skip.
`;

  const response = await callGemini(prompt);
  return response;
}

async function handleFollowUp(question, squadData, conversationHistory) {
  const scheduleContext = buildScheduleContext(squadData?.meta || null);
  const playerDB = await getPlayerDB();

  let enrichedQuestion = question;
  if (!conversationHistory.some(m => m.text.includes("UPCOMING IPL 2026 MATCHES"))) {
    enrichedQuestion += `\n\n(Context: ${scheduleContext})`;
  }

  if (squadData) {
    enrichedQuestion += `\n\n(Current squad data is from the previous analysis. Credits left: ${squadData.meta?.creditsLeft ?? "?"}, Transfers remaining: ${squadData.meta?.transfersRemaining ?? "?"})`;
  }

  // Inject Player Intelligence for players mentioned in the follow-up question
  // This prevents the AI from hallucinating old team structures based on its foundational memory.
  let intel = `\n\n=== PLAYER INTELLIGENCE (Context for mentioned players) ===\n`;
  let found = false;
  const qLower = question.toLowerCase();

  for (const [name, data] of Object.entries(playerDB)) {
    if (name === "_meta") continue;

    // Check for full name or significant parts (>3 chars like 'Markram', 'Rabada')
    const nameLower = name.toLowerCase();
    const parts = nameLower.split(' ').filter(p => p.length > 3);

    let match = false;
    if (qLower.includes(nameLower)) {
      match = true;
    } else {
      for (const part of parts) {
        if (qLower.includes(part)) {
          match = true;
          break;
        }
      }
    }

    if (match) {
      found = true;
      const status = data.playing_status === "not considered" ? "⛔ NOT CONSIDERED" : "active";
      intel += `📋 ${name} (${data.team}): Status = ${status} | ${data.notes}\n`;
    }
  }

  if (found) {
    enrichedQuestion += intel;
  }

  // Include Available Replacements so the AI doesn't hallucinate players outside the current season
  const allAvailTexts = [];
  if (squadData?.availableByRole) {
    for (const role of ["WK", "BAT", "AR", "BOWL"]) {
      const avail = squadData.availableByRole[role] || [];
      allAvailTexts.push(...avail);
    }
  }
  const availIntel = buildPlayerIntelligence(allAvailTexts, "AVAILABLE REPLACEMENTS", playerDB);
  if (availIntel) enrichedQuestion += `\n\n${availIntel}`;

  const response = await callGemini(enrichedQuestion, conversationHistory, buildFollowUpSystemPrompt());
  return response;
}

function buildFollowUpSystemPrompt() {
  return `You are the IPL Fantasy Advisor. You are now in a follow-up conversation.

RULES:
1. Stick to the Player Intelligence database provided. Do NOT suggest retired or inactive players unless they are in the current squad data.
2. DO NOT use the "Match Preview", "Transfer Recommendations", etc. template from the original analysis.
3. Be conversational and concise. Answer the user's specific question directly.
4. **NEXT MATCH CONSTRAINT (HARD RULE):** Any player you suggest as an alternative or replacement MUST be from one of the TWO TEAMS playing the immediate NEXT MATCH. Do NOT suggest players from other IPL teams (e.g., if next match is RCB vs DC, do NOT suggest Jaiswal (RR), Klaasen (SRH), Head (SRH), Narine (KKR), etc.). Players from non-playing teams are irrelevant to the immediate decision regardless of their quality or future fixtures.
5. If the user asks for alternatives, provide 1-2 specific names only from the NEXT MATCH teams in the "AVAILABLE REPLACEMENTS" list provided in the context.
6. If you suggest a move, briefly explain: (a) credits impact, (b) what match coverage gap it opens or fills, (c) why it is better or worse than the current recommendation.
7. Use emojis where appropriate to keep it consistent with the brand.`;
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
    // Dump tracking data to local server in the project folder
    fetch("http://localhost:5050/dump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.squadData),
    })
      .then(() => console.log("[IPL FA] Successfully dumped tracking data to local logger."))
      .catch(() => console.warn("[IPL FA] Note: Local logger (local_logger.py) is not running. Tracking data not saved."));

    analyzeSquad(request.squadData)
      .then(result => sendResponse({ success: true, analysis: result }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (request.type === "DUMP_DATA") {
    fetch("http://localhost:5050/dump", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.squadData),
    })
      .then(() => sendResponse({ success: true }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
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

    // Dump tracking data to local server in the project folder
    try {
      await fetch("http://localhost:5050/dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(squadData),
      });
      console.log("[IPL FA] Successfully dumped tracking data to local logger.");
    } catch (e) {
      console.warn("[IPL FA] Note: Local logger (local_logger.py) is not running. Tracking data not saved locally.");
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
