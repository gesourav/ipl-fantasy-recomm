/**
 * IPL Fantasy Advisor — Content Script (v4)
 * 
 * STRATEGY: 
 * 1. Read the tab headers to find exact squad counts (e.g. "WK (2)" means 2 WKs are selected).
 * 2. Click each role tab (WK/BAT/AR/BOWL).
 * 3. Use TreeWalker to reliably locate every player card containing "pts".
 * 4. Since selected players are ALWAYS pinned to the top of the list on the IPL Fantasy UI, 
 *    we simply take the first N player cards (where N is the count from the tab).
 */

(function () {
  "use strict";

  if (window.__IPL_FANTASY_ADVISOR_INJECTED__) return;
  window.__IPL_FANTASY_ADVISOR_INJECTED__ = true;

  console.log("[IPL FA] Content script v4 loaded");

  async function scrapeFullSquad() {
    console.log("[IPL FA] Starting full squad scrape...");

    const result = {
      meta: scrapeMetaInfo(),
      squadByRole: {},
      scrapedAt: new Date().toISOString(),
    };

    // 1. Find tabs and the number of selected players for each
    const tabs = findRoleTabsAndCounts();
    console.log("[IPL FA] Found tabs and counts:", tabs);

    if (tabs.length === 0) {
      throw new Error("Could not find the role tabs (WK, BAT, AR, BOWL). Ensure you are on the Transfer page.");
    }

    // 2. Click through each tab (re-querying to avoid React detached DOM node issues)
    const rolesToScrape = ["WK", "BAT", "AR", "BOWL"];
    for (const role of rolesToScrape) {
      // Find the tab freshly
      const currentTabs = findRoleTabsAndCounts();
      const tab = currentTabs.find(t => t.role === role);
      
      if (!tab) {
        console.warn(`[IPL FA] Could not find tab: ${role}`);
        continue;
      }

      // Click the tab element to reveal its players
      tab.element.click();
      await sleep(1500); // Wait for React to re-render the list completely

      // Extract all player cards currently visible in the DOM
      const allPlayerCards = scrapeAllPlayerCards();
      
      // 3. The first N players in the DOM are the selected ones!
      const selectedPlayers = allPlayerCards.slice(0, tab.count);
      result.squadByRole[tab.role] = selectedPlayers;
      
      console.log(`[IPL FA] ${tab.role}: required ${tab.count}, found ${allPlayerCards.length}, sliced top ${selectedPlayers.length}`);
    }

    result.squadSummary = buildSquadSummary(result);
    console.log("[IPL FA] Scrape complete:", result);
    return result;
  }

  function scrapeMetaInfo() {
    const meta = {};
    const text = document.body.innerText.substring(0, 1000);

    const playersMatch = text.match(/Players\s*[\n\r\s]*(\d+\s*\/\s*\d+)/i);
    if (playersMatch) meta.playersCount = playersMatch[1];

    const overseasMatch = text.match(/Overseas\s*[\n\r\s]*(\d+)/i);
    if (overseasMatch) meta.overseasCount = parseInt(overseasMatch[1]);

    const transferMatch = text.match(/Transfers?\s*(?:in\s*)?(?:Use)?\s*[\n\r\s]*(\d+)\s*\/\s*(\d+)/i);
    if (transferMatch) {
      meta.transfersUsed = parseInt(transferMatch[1]);
      meta.transfersMax = parseInt(transferMatch[2]);
      meta.transfersRemaining = meta.transfersMax - meta.transfersUsed;
    }

    const creditsMatch = text.match(/Credits?\s*(?:Left)?\s*[\n\r\s]*(\d+\.?\d*)/i);
    if (creditsMatch) meta.creditsLeft = parseFloat(creditsMatch[1]);

    const vsMatch = text.match(/([A-Z]{2,4})\s+vs\s+([A-Z]{2,4})/i);
    if (vsMatch) meta.deadlineMatch = `${vsMatch[1].toUpperCase()} vs ${vsMatch[2].toUpperCase()}`;

    return meta;
  }

  function findRoleTabsAndCounts() {
    const tabsMap = {};
    const allElements = document.querySelectorAll("*");

    for (const el of allElements) {
      // Tabs normally don't have deep nesting
      if (el.children.length > 4) continue;
      
      // It's safer to use the combined text content and collapse any inner whitespaces
      const text = el.textContent.replace(/\s+/g, " ").trim().toUpperCase();
      
      // Match "WK (2)", "BAT (3)", "AR (3)", "BOWL (3)"
      const match = text.match(/^(WK|BAT|AR|BOWL)\s*\((\d+)\)$/);
      if (match) {
        const role = match[1];
        const count = parseInt(match[2], 10);
        
        // Find the closest clickable parent (like LI or BUTTON or something with cursor: pointer)
        let clickable = el;
        let depth = 0;
        while (clickable && clickable !== document.body && depth < 5) {
          const style = window.getComputedStyle(clickable);
          if (style.cursor === "pointer" || clickable.tagName === "LI" || clickable.tagName === "BUTTON") {
             break;
          }
          clickable = clickable.parentElement;
          depth++;
        }
        if (!clickable || clickable === document.body) clickable = el;

        if (!tabsMap[role]) {
          tabsMap[role] = { element: clickable, role, count, area: clickable.getBoundingClientRect().width * clickable.getBoundingClientRect().height };
        } else {
          const area = clickable.getBoundingClientRect().width * clickable.getBoundingClientRect().height;
          if (area > tabsMap[role].area) {
             tabsMap[role] = { element: clickable, role, count, area };
          }
        }
      }
    }

    return Object.values(tabsMap);
  }

  function scrapeAllPlayerCards() {
    const allEls = document.querySelectorAll("*");
    const processedNodes = new Set();
    const candidateNodes = [];
    
    // Step 1: Find innermost elements that contain both 'pts' and '%'
    for (const el of allEls) {
      const text = el.textContent || "";
      const rect = el.getBoundingClientRect();
      
      // Is it a candidate?
      // Player cards are typically 30px to 250px tall, and visible (rect.top > 0)
      if (text.includes("pts") && text.includes("%") && rect.height >= 30 && rect.height < 250 && rect.top > 0) {
        
        let hasValidChild = false;
        for (const child of el.children) {
          const cText = child.textContent || "";
          const cRect = child.getBoundingClientRect();
          if (cText.includes("pts") && cText.includes("%") && cRect.height >= 30) {
            hasValidChild = true;
            break;
          }
        }
        
        // If no child has BOTH, this is the innermost flex container for the card
        if (!hasValidChild && !processedNodes.has(el)) {
           processedNodes.add(el);
           candidateNodes.push(el);
        }
      }
    }
    
    // Step 2: Sort candidates visually from top to bottom
    // This perfectly matches the UI, putting selected players first
    candidateNodes.sort((a,b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    
    // Step 3: Extract clean text
    const playerCards = [];
    for (const el of candidateNodes) {
       // use innerText which preserves visual newlines, replace them with pipes
       let cleanText = "";
       if (el.innerText) {
          cleanText = el.innerText.replace(/\n+/g, " | ").trim();
       } else {
          cleanText = el.textContent.replace(/\s+/g, " ").trim();
       }
       if (cleanText.length > 5) {
          playerCards.push(cleanText);
       }
    }
    
    return playerCards;
  }

  function buildSquadSummary(result) {
    let summary = `=== EXACT SQUAD CAPTURED ===\n\n`;

    // Add Meta
    const m = result.meta;
    summary += `[Current Budget & Transfers]\n`;
    summary += `Deadline: ${m.deadlineMatch || "unknown"}\n`;
    summary += `Credits Left: ${m.creditsLeft ?? "unknown"}\n`;
    summary += `Transfers Remaining: ${m.transfersRemaining ?? "unknown"} of ${m.transfersMax ?? "160"}\n`;
    summary += `Overseas Used: ${m.overseasCount ?? "unknown"}/4\n\n`;

    // Add Squad line by line
    summary += `[Confirmed 11 Players]\n`;
    let totalFound = 0;
    for (const role of ["WK", "BAT", "AR", "BOWL"]) {
      const players = result.squadByRole[role] || [];
      for (const p of players) {
        summary += `Role: ${role} | ${p}\n`;
        totalFound++;
      }
    }
    
    if (totalFound === 0) {
      summary += "ERROR: Could not find any players. Please make sure the Transfer page is loaded completely.\n";
    }

    return summary;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Listen for messages from background.js
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "scrapeAllTabs" || request.action === "scrapeSquad") {
      scrapeFullSquad()
        .then(data => sendResponse({ success: true, data }))
        .catch(err => {
          console.error("[IPL FA] Scrape error:", err);
          sendResponse({ success: false, error: err.message });
        });
      return true;
    }

    if (request.action === "getPageText") {
      sendResponse({ success: true, text: document.body.innerText.substring(0, 5000) });
      return true;
    }

    if (request.action === "ping") {
      sendResponse({ success: true, status: "alive" });
      return true;
    }
  });

})();
