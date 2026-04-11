// IPL 2026 Season Schedule — March 28 to May 24 (League Stage)
// This schedule is used by the extension to compute upcoming fixtures and team density.
// The extension will also dynamically fetch/update this via Gemini for latest accuracy.

export const IPL_2026_SCHEDULE = [
  // Match 1–10 (March 28 – April 5)
  { match: 1,  date: "2026-03-28", team1: "RCB", team2: "SRH", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "19:30" },
  { match: 2,  date: "2026-03-29", team1: "MI",  team2: "KKR", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 3,  date: "2026-03-30", team1: "RR",  team2: "CSK", venue: "ACA-VDCA Stadium, Guwahati", time: "15:30" },
  { match: 4,  date: "2026-03-30", team1: "DC",  team2: "LSG", venue: "Arun Jaitley Stadium, Delhi", time: "19:30" },
  { match: 5,  date: "2026-03-31", team1: "PBKS", team2: "GT",  venue: "MYS Cricket Stadium, New Chandigarh", time: "19:30" },
  { match: 6,  date: "2026-04-01", team1: "LSG", team2: "DC",  venue: "Ekana Cricket Stadium, Lucknow", time: "19:30" },
  { match: 7,  date: "2026-04-02", team1: "KKR", team2: "SRH", venue: "Eden Gardens, Kolkata", time: "19:30" },
  { match: 8,  date: "2026-04-03", team1: "CSK", team2: "PBKS", venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 9,  date: "2026-04-04", team1: "DC",  team2: "MI",  venue: "Arun Jaitley Stadium, Delhi", time: "15:30" },
  { match: 10, date: "2026-04-04", team1: "GT",  team2: "RR",  venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },

  // Match 11–20 (April 5 – April 12)
  { match: 11, date: "2026-04-05", team1: "SRH", team2: "LSG", venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "15:30" },
  { match: 12, date: "2026-04-05", team1: "RCB", team2: "CSK", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "19:30" },
  { match: 13, date: "2026-04-06", team1: "KKR", team2: "PBKS", venue: "Eden Gardens, Kolkata", time: "15:30" },
  { match: 14, date: "2026-04-06", team1: "MI",  team2: "GT",  venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  // Match 11–20 (Exact from screenshot context)
  { match: 15, date: "2026-04-09", team1: "RR",  team2: "SRH", venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 16, date: "2026-04-10", team1: "LSG", team2: "RCB", venue: "Ekana Cricket Stadium, Lucknow", time: "19:30" },
  { match: 17, date: "2026-04-10", team1: "PBKS", team2: "MI", venue: "MYS Cricket Stadium, New Chandigarh", time: "19:30" },
  { match: 18, date: "2026-04-11", team1: "CSK", team2: "DC",  venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 19, date: "2026-04-12", team1: "LSG", team2: "GT",  venue: "Ekana Cricket Stadium, Lucknow", time: "15:30" },
  { match: 20, date: "2026-04-12", team1: "MI",  team2: "RCB", venue: "Wankhede Stadium, Mumbai", time: "19:30" },

  // Match 21–30
  { match: 21, date: "2026-04-13", team1: "SRH", team2: "RR",  venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "19:30" },
  { match: 22, date: "2026-04-14", team1: "CSK", team2: "KKR", venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 23, date: "2026-04-15", team1: "RCB", team2: "LSG", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "19:30" },
  { match: 24, date: "2026-04-16", team1: "MI",  team2: "PBKS", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 25, date: "2026-04-17", team1: "GT",  team2: "KKR", venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },
  { match: 26, date: "2026-04-18", team1: "RCB", team2: "DC",  venue: "M. Chinnaswamy Stadium, Bengaluru", time: "15:30" },
  { match: 27, date: "2026-04-18", team1: "RR",  team2: "LSG", venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 28, date: "2026-04-19", team1: "SRH", team2: "KKR", venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "15:30" },
  { match: 29, date: "2026-04-19", team1: "CSK", team2: "GT",  venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 30, date: "2026-04-20", team1: "MI",  team2: "DC",  venue: "Wankhede Stadium, Mumbai", time: "15:30" },

  // Match 31–40 (April 19 – April 26)
  { match: 31, date: "2026-04-20", team1: "PBKS", team2: "RCB", venue: "MYS Cricket Stadium, New Chandigarh", time: "19:30" },
  { match: 32, date: "2026-04-20", team1: "GT",  team2: "SRH", venue: "Narendra Modi Stadium, Ahmedabad", time: "15:30" },
  { match: 33, date: "2026-04-20", team1: "RR",  team2: "KKR", venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 34, date: "2026-04-21", team1: "LSG", team2: "CSK", venue: "Ekana Cricket Stadium, Lucknow", time: "19:30" },
  { match: 35, date: "2026-04-22", team1: "DC",  team2: "RR",  venue: "Arun Jaitley Stadium, Delhi", time: "19:30" },
  { match: 36, date: "2026-04-23", team1: "PBKS", team2: "SRH", venue: "HPCA Stadium, Dharamshala", time: "19:30" },
  { match: 37, date: "2026-04-24", team1: "MI",  team2: "LSG", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 38, date: "2026-04-25", team1: "RCB", team2: "KKR", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "15:30" },
  { match: 39, date: "2026-04-25", team1: "GT",  team2: "CSK", venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },
  { match: 40, date: "2026-04-26", team1: "DC",  team2: "SRH", venue: "Arun Jaitley Stadium, Delhi", time: "15:30" },

  // Match 41–50 (April 26 – May 3)
  { match: 41, date: "2026-04-26", team1: "RR",  team2: "PBKS", venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 42, date: "2026-04-27", team1: "KKR", team2: "MI",  venue: "Eden Gardens, Kolkata", time: "15:30" },
  { match: 43, date: "2026-04-27", team1: "LSG", team2: "GT",  venue: "Ekana Cricket Stadium, Lucknow", time: "19:30" },
  { match: 44, date: "2026-04-28", team1: "CSK", team2: "RCB", venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 45, date: "2026-04-29", team1: "SRH", team2: "RR",  venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "19:30" },
  { match: 46, date: "2026-04-30", team1: "PBKS", team2: "DC",  venue: "MYS Cricket Stadium, New Chandigarh", time: "19:30" },
  { match: 47, date: "2026-05-01", team1: "GT",  team2: "MI",  venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },
  { match: 48, date: "2026-05-02", team1: "RCB", team2: "LSG", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "15:30" },
  { match: 49, date: "2026-05-02", team1: "KKR", team2: "CSK", venue: "Eden Gardens, Kolkata", time: "19:30" },
  { match: 50, date: "2026-05-03", team1: "MI",  team2: "SRH", venue: "Wankhede Stadium, Mumbai", time: "15:30" },

  // Match 51–60 (May 3 – May 11)
  { match: 51, date: "2026-05-03", team1: "DC",  team2: "GT",  venue: "Arun Jaitley Stadium, Delhi", time: "19:30" },
  { match: 52, date: "2026-05-04", team1: "PBKS", team2: "KKR", venue: "HPCA Stadium, Dharamshala", time: "15:30" },
  { match: 53, date: "2026-05-04", team1: "RR",  team2: "RCB", venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 54, date: "2026-05-05", team1: "LSG", team2: "SRH", venue: "Ekana Cricket Stadium, Lucknow", time: "19:30" },
  { match: 55, date: "2026-05-06", team1: "CSK", team2: "RR",  venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 56, date: "2026-05-07", team1: "GT",  team2: "PBKS", venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },
  { match: 57, date: "2026-05-08", team1: "MI",  team2: "LSG", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 58, date: "2026-05-09", team1: "KKR", team2: "DC",  venue: "Eden Gardens, Kolkata", time: "15:30" },
  { match: 59, date: "2026-05-09", team1: "SRH", team2: "CSK", venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "19:30" },
  { match: 60, date: "2026-05-10", team1: "RCB", team2: "GT",  venue: "M. Chinnaswamy Stadium, Bengaluru", time: "15:30" },

  // Match 61–70 (May 10 – May 18)
  { match: 61, date: "2026-05-10", team1: "RR",  team2: "MI",  venue: "Sawai Mansingh Stadium, Jaipur", time: "19:30" },
  { match: 62, date: "2026-05-11", team1: "PBKS", team2: "LSG", venue: "MYS Cricket Stadium, New Chandigarh", time: "15:30" },
  { match: 63, date: "2026-05-11", team1: "DC",  team2: "KKR", venue: "Arun Jaitley Stadium, Delhi", time: "19:30" },
  { match: 64, date: "2026-05-12", team1: "GT",  team2: "RCB", venue: "Narendra Modi Stadium, Ahmedabad", time: "19:30" },
  { match: 65, date: "2026-05-13", team1: "CSK", team2: "SRH", venue: "MA Chidambaram Stadium, Chennai", time: "19:30" },
  { match: 66, date: "2026-05-14", team1: "MI",  team2: "PBKS", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 67, date: "2026-05-15", team1: "KKR", team2: "RR",  venue: "Eden Gardens, Kolkata", time: "19:30" },
  { match: 68, date: "2026-05-16", team1: "LSG", team2: "RCB", venue: "Ekana Cricket Stadium, Lucknow", time: "15:30" },
  { match: 69, date: "2026-05-16", team1: "DC",  team2: "CSK", venue: "Arun Jaitley Stadium, Delhi", time: "19:30" },
  { match: 70, date: "2026-05-17", team1: "SRH", team2: "GT",  venue: "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad", time: "19:30" },

  // Match 71–74 (remaining league games)
  { match: 71, date: "2026-05-18", team1: "RR",  team2: "DC",  venue: "Sawai Mansingh Stadium, Jaipur", time: "15:30" },
  { match: 72, date: "2026-05-18", team1: "MI",  team2: "KKR", venue: "Wankhede Stadium, Mumbai", time: "19:30" },
  { match: 73, date: "2026-05-19", team1: "PBKS", team2: "CSK", venue: "HPCA Stadium, Dharamshala", time: "19:30" },
  { match: 74, date: "2026-05-20", team1: "RCB", team2: "LSG", venue: "M. Chinnaswamy Stadium, Bengaluru", time: "19:30" },
];

// Team abbreviation to full name mapping
export const TEAM_NAMES = {
  CSK: "Chennai Super Kings",
  MI: "Mumbai Indians",
  RCB: "Royal Challengers Bengaluru",
  KKR: "Kolkata Knight Riders",
  DC: "Delhi Capitals",
  SRH: "Sunrisers Hyderabad",
  RR: "Rajasthan Royals",
  PBKS: "Punjab Kings",
  GT: "Gujarat Titans",
  LSG: "Lucknow Super Giants",
};

// Venue characteristics for AI context
export const VENUE_PROFILES = {
  "M. Chinnaswamy Stadium, Bengaluru": { type: "batting", pace: "medium", spin: "low", avg_score: 185, dew_factor: "high", notes: "Small ground, high-scoring, great for batters and fast bowlers with death bowling skills" },
  "Wankhede Stadium, Mumbai": { type: "batting", pace: "high", spin: "low", avg_score: 180, dew_factor: "high", notes: "Pace-friendly, good bounce, suits fast bowlers in powerplay and batters later" },
  "MA Chidambaram Stadium, Chennai": { type: "spin", pace: "low", spin: "high", avg_score: 160, dew_factor: "medium", notes: "Slow and turning pitch, spinners dominate, anchor batters valuable" },
  "Eden Gardens, Kolkata": { type: "balanced", pace: "medium", spin: "medium", avg_score: 170, dew_factor: "high", notes: "Even contest, dew plays a role in 2nd innings, decent for all" },
  "Arun Jaitley Stadium, Delhi": { type: "batting", pace: "medium", spin: "medium", avg_score: 175, dew_factor: "high", notes: "Good batting surface, bit of help for spinners in middle overs" },
  "Rajiv Gandhi Intl. Cricket Stadium, Hyderabad": { type: "batting", pace: "high", spin: "low", avg_score: 185, dew_factor: "medium", notes: "Flat batting wicket with good pace and bounce" },
  "Sawai Mansingh Stadium, Jaipur": { type: "spin", pace: "low", spin: "high", avg_score: 165, dew_factor: "low", notes: "Slow surface, spinners and wrist-spin dominate, lower scoring" },
  "Narendra Modi Stadium, Ahmedabad": { type: "balanced", pace: "medium", spin: "medium", avg_score: 170, dew_factor: "medium", notes: "Vast outfield, big ground, needs power hitters, good for bowlers" },
  "Ekana Cricket Stadium, Lucknow": { type: "batting", pace: "medium", spin: "medium", avg_score: 173, dew_factor: "medium", notes: "Good batting surface, some assistance for pace in morning" },
  "MYS Cricket Stadium, New Chandigarh": { type: "pace", pace: "high", spin: "low", avg_score: 168, dew_factor: "high", notes: "Green top at times, seam movement, suits fast bowlers" },
  "HPCA Stadium, Dharamshala": { type: "batting", pace: "medium", spin: "low", avg_score: 178, dew_factor: "low", notes: "Beautiful ground, ball carries well, good for stroke players" },
  "ACA-VDCA Stadium, Guwahati": { type: "balanced", pace: "medium", spin: "medium", avg_score: 170, dew_factor: "medium", notes: "Relatively new venue, balanced surface" },
};

/**
 * Get upcoming matches from today onwards
 * @param {number} count - Number of upcoming matches to return
 * @returns {Array} - Array of upcoming match objects
 */
export function getUpcomingMatches(count = 10) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return IPL_2026_SCHEDULE
    .filter(m => new Date(m.date) >= today)
    .slice(0, count);
}

/**
 * Get the next N matches for a specific team
 * @param {string} teamAbbr - Team abbreviation (e.g., "CSK")
 * @param {number} count - Number of matches
 * @returns {Array}
 */
export function getTeamUpcoming(teamAbbr, count = 5) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const team = teamAbbr.toUpperCase();

  return IPL_2026_SCHEDULE
    .filter(m => (m.team1 === team || m.team2 === team) && new Date(m.date) >= today)
    .slice(0, count);
}

/**
 * Compute "matches away" for each team — how many league matches
 * happen before this team plays next.
 * @returns {Object} - { CSK: 2, MI: 0, ... }
 */
export function getMatchGaps() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = IPL_2026_SCHEDULE.filter(m => new Date(m.date) >= today);
  const gaps = {};
  const teams = Object.keys(TEAM_NAMES);

  for (const team of teams) {
    const idx = upcoming.findIndex(m => m.team1 === team || m.team2 === team);
    gaps[team] = idx === -1 ? 999 : idx; // 999 means no more matches (season over)
  }

  return gaps;
}

/**
 * Get team fixture density — how many matches in the next N days
 * @param {number} days - Lookahead window in days
 * @returns {Object} - { CSK: 3, MI: 2, ... }
 */
export function getTeamDensity(days = 14) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  const density = {};
  const teams = Object.keys(TEAM_NAMES);

  for (const team of teams) {
    density[team] = IPL_2026_SCHEDULE.filter(m => {
      const d = new Date(m.date);
      return (m.team1 === team || m.team2 === team) && d >= today && d <= cutoff;
    }).length;
  }

  return density;
}

/**
 * Build a comprehensive schedule context string for Gemini prompt
 * @returns {string}
 */
export function buildScheduleContext() {
  const upcoming = getUpcomingMatches(12);
  const gaps = getMatchGaps();
  const density = getTeamDensity(14);

  let context = "=== UPCOMING IPL 2026 MATCHES (next 12) ===\n";
  for (const m of upcoming) {
    const venueShort = m.venue.split(",")[0];
    context += `Match ${m.match}: ${m.date} | ${m.team1} vs ${m.team2} | ${venueShort} | ${m.time} IST\n`;
  }

  context += "\n=== TEAM MATCH GAPS (matches until next game, 0 = playing today/next) ===\n";
  const sortedGaps = Object.entries(gaps).sort((a, b) => a[1] - b[1]);
  for (const [team, gap] of sortedGaps) {
    const status = gap === 0 ? "🟢 PLAYING NEXT" : gap <= 2 ? "🟡 Playing soon" : "🔴 Long wait";
    context += `${team}: ${gap} matches away ${status}\n`;
  }

  context += "\n=== TEAM FIXTURE DENSITY (matches in next 14 days) ===\n";
  const sortedDensity = Object.entries(density).sort((a, b) => b[1] - a[1]);
  for (const [team, count] of sortedDensity) {
    context += `${team}: ${count} matches in 14 days ${count >= 4 ? "🔥 DENSE" : count >= 3 ? "✅ Good" : "⚠️ Sparse"}\n`;
  }

  // Add venue profiles for upcoming matches
  context += "\n=== VENUE INSIGHTS FOR UPCOMING MATCHES ===\n";
  const upcomingVenues = [...new Set(upcoming.map(m => m.venue))];
  for (const venue of upcomingVenues) {
    const profile = VENUE_PROFILES[venue];
    if (profile) {
      context += `${venue}: ${profile.notes} | Avg Score: ${profile.avg_score} | Type: ${profile.type}\n`;
    }
  }

  return context;
}
