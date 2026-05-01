const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1RwFROiK310Zm4VkIeILuQOhj34fyUcFP1d2tkkdwC8o/export?format=csv&gid=1326892";


function getSortIcon(currentKey, key, state) {
  if (state.key !== key) {
    return `<i class="fa-solid fa-sort"></i>`; // no sort
  }

  if (state.dir === 1) {
    return `<i class="fa-solid fa-sort-up"></i>`; // ASC
  }

  return `<i class="fa-solid fa-sort-down"></i>`; // DESC
}

// Mobile detection and touch handling
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 768;
}







let raw = [];
let players = {};
let games = new Set();

let activeGame = null;
let activePlayer = null;
let showActiveOnly = false;

let detailSort = {
  key: null,
  dir: 1
}

let sortState = {
  key: null,
  dir: 1
};


let playerDetailRows = [];
let gameDetailRows = [];


function sortDetail(rows, key, playerHistory = null) {
  if (!key) return rows;

  return [...rows].sort((a, b) => {
    let A, B;

    if (key === "streak" && playerHistory) {
      const indexA = rows.indexOf(a);
      const indexB = rows.indexOf(b);
      A = getDetailSortValue(a, key, playerHistory, indexA);
      B = getDetailSortValue(b, key, playerHistory, indexB);
    } else {
      A = a[key];
      B = b[key];
    }

    if (typeof A === "string") {
      return A.localeCompare(B) * detailSort.dir;
    }

    return (A - B) * detailSort.dir;
  });
}


window.sortDetailTable = function (key, rows, renderFn) {
  if (detailSort.key !== key) {
    detailSort.key = key;
    detailSort.dir = 1;
  } else if (detailSort.dir === 1) {
    detailSort.dir = -1;
  } else {
    detailSort.key = null;
    detailSort.dir = 1;
  }

  renderFn();
};



/* -------------------------
   FORMAT
--------------------------*/
function fmt(v) {
  const num = Number(v) || 0;
  const abs = Math.abs(num).toFixed(2);

  return num < 0 ? `-$${abs}` : `$${abs}`;
}

function money(v) {
  if (v === "-" || v == null || v === "") return 0;
  return parseFloat(String(v).replace(/[^0-9.-]/g, "")) || 0;
}

/* -------------------------
   STREAK (NOW WITH SORT VALUE)
--------------------------*/
function calcStreaks(history) {
  // If no history (only future games), return no streak
  if (!history || history.length === 0) {
    return {
      type: null,
      max: 0,
      value: 0
    };
  }

  let streak = 0;
  let type = null;

  for (let v of history) {
    const t = v > 0 ? "W" : v < 0 ? "L" : "N";
    
    // If neutral ($0), reset the streak
    if (t === "N") {
      streak = 0;
      type = null;
      continue;
    }

    if (t === type) {
      streak++;
    } else {
      type = t;
      streak = 1;
    }
  }

  return {
    type,
    max: streak,
    value: type === "W" ? streak : type === "L" ? -streak : 0
  };
}

/* -------------------------
   BUILD DATA
--------------------------*/
function build(data) {
  players = {};
  games = new Set();

  data.forEach(r => {
    const game = r["Game No."];
    const player = r.Player;
    const isFuture = r.Future && r.Future.toLowerCase() === "yes";

    const buy = money(r["Buy In"]);
    const pay = money(r["Pay Out"]);
    const win = pay - buy;

    games.add(game);

    // ALWAYS ensure player exists FIRST
    if (!players[player]) {
      players[player] = {
        name: player,
        total: 0,
        gamesPlayed: 0,
        history: [],
        perGame: {},
        lifetimeBuy: 0
      };
    }

    // Include all games in perGame for display purposes
    players[player].perGame[game] = { buy, pay, win, isFuture };

    // Only update totals and history for non-future games
    if (!isFuture) {
      players[player].total += win;
      players[player].gamesPlayed++;
      players[player].history.push(win);
      players[player].lifetimeBuy += buy;
    }
  });
}

/* -------------------------
   SORT HELPERS (FIXED)
--------------------------*/
function getSortValue(p, key) {
  if (!key) return null;

  if (key === "streak") return calcStreaks(p.history).value;
  if (key === "name") return p.name;
  return p[key];
}

function getDetailSortValue(row, key, playerHistory, index) {
  if (!key) return null;

  if (key === "streak") {
    const historyUpToGame = playerHistory.slice(0, index + 1);
    return calcStreaks(historyUpToGame).value;
  }
  if (typeof row[key] === "string") return row[key];
  return row[key];
}

function sortRows(rows, key) {
  if (!key) return rows;

  return [...rows].sort((a, b) => {
    const A = getSortValue(a, key);
    const B = getSortValue(b, key);

    if (typeof A === "string") {
      return A.localeCompare(B) * sortState.dir;
    }

    return (A - B) * sortState.dir;
  });
}

/* -------------------------
   SORT CONTROL (FIXED: ASC → DESC → RESET)
--------------------------*/
window.sortMain = function (key) {
  if (sortState.key !== key) {
    sortState.key = key;
    sortState.dir = 1;
  } else if (sortState.dir === 1) {
    sortState.dir = -1;
  } else {
    sortState.key = null;
    sortState.dir = 1;
  }

  renderMain();
};

function moneyClass(v) {
  if (v > 0) return "win";
  if (v < 0) return "loss";
  return "neutral";
}

/* -------------------------
   STATISTICS HEADER
--------------------------*/
function renderStatsHeader() {
  const statsDiv = document.getElementById("statsHeader");

  // Calculate total games and total buy-ins
  const totalGames = games.size;
  let totalBuyIns = 0;

  Object.values(players).forEach(player => {
    totalBuyIns += player.lifetimeBuy;
  });

  statsDiv.innerHTML = `
    <div class="stat">
      Total Games:
      <span class="stat-value">${totalGames}</span>
    </div>
    <div class="stat">
      Total Buy-Ins:
      <span class="stat-value">${fmt(totalBuyIns)}</span>
    </div>
  `;
}

/* -------------------------
   ACTIVE/ALL TOGGLE
--------------------------*/
window.toggleActiveFilter = function() {
  showActiveOnly = !showActiveOnly;
  renderMain();
  renderActiveToggle();
};

function renderActiveToggle() {
  const activeToggle = document.getElementById('activeToggle');

  activeToggle.innerHTML = `
    <div class="active-toggle-container">
      <div class="toggle-label left">All Players</div>
      <div class="toggle-switch" onclick="toggleActiveFilter()">
        <div class="toggle-slider ${showActiveOnly ? 'active' : ''}"></div>
      </div>
      <div class="toggle-label right">Repeat Players</div>
    </div>
  `;
}

/* -------------------------
   MAIN TABLE
--------------------------*/
function renderMain() {
  const table = document.getElementById("mainTable");

  let rows = Object.values(players);

  // Filter active players if needed
  if (showActiveOnly) {
    rows = rows.filter(player => player.gamesPlayed > 1);
  }

  // default ordering = winnings desc
  if (!sortState.key) {
    rows.sort((a, b) => b.total - a.total);
  } else {
    rows = sortRows(rows, sortState.key);
  }

  // Mobile-optimized header rendering
  const isMobile = isMobileDevice();
  const headerHTML = isMobile ? `
    <thead>
      <tr>
        <th>Rank</th>
        <th onclick="sortMain('name')" style="touch-action: manipulation;">
          Player ${getSortIcon(sortState.key, 'name', sortState)}
        </th>
        <th onclick="sortMain('total')" style="touch-action: manipulation;">
          Winnings ${getSortIcon(sortState.key, 'total', sortState)}
        </th>
        <th onclick="sortMain('gamesPlayed')" style="touch-action: manipulation;">
          Games ${getSortIcon(sortState.key, 'gamesPlayed', sortState)}
        </th>
      </tr>
    </thead>
  ` : `
    <thead>
      <tr>
        <th>Rank</th>
        <th onclick="sortMain('name')">
          Player Name ${getSortIcon(sortState.key, 'name', sortState)}
        </th>
        <th onclick="sortMain('total')">
          Total Winnings ${getSortIcon(sortState.key, 'total', sortState)}
        </th>
        <th onclick="sortMain('lifetimeBuy')">
          Lifetime Buy-In ${getSortIcon(sortState.key, 'lifetimeBuy', sortState)}
        </th>
        <th onclick="sortMain('gamesPlayed')">
          Games Played ${getSortIcon(sortState.key, 'gamesPlayed', sortState)}
        </th>
        <th onclick="sortMain('streak')">
          Streak ${getSortIcon(sortState.key, 'streak', sortState)}
        </th>
      </tr>
    </thead>
  `;

  table.innerHTML = headerHTML;

  const tbody = document.createElement("tbody");

  rows.forEach((p, i) => {
    const s = calcStreaks(p.history);
    const isWin = s.type === "W";
    const isLoss = s.type === "L";

    const icon = isWin
      ? `<i class="fa-solid fa-fire streak-icon hot"></i>`
      : isLoss
      ? `<i class="fa-solid fa-snowflake streak-icon cold"></i>`
      : `<i class="fa-solid fa-minus"></i>`;

    const cls = isWin
      ? `streak-win-${Math.min(s.max,5)}`
      : isLoss
      ? `streak-loss-${Math.min(s.max,5)}`
      : `streak-neutral`;

    // Calculate true rank based on winnings and current filter (1-based)
    let rankingPlayers = Object.values(players);
    if (showActiveOnly) {
      rankingPlayers = rankingPlayers.filter(player => player.gamesPlayed > 1);
    }
    rankingPlayers.sort((a, b) => b.total - a.total);
    const trueRank = rankingPlayers.findIndex(player => player.name === p.name) + 1;

    // Check if player is inactive (for styling)
    const isInactive = p.gamesPlayed <= 1;
    const rowClass = isInactive && !showActiveOnly ? 'inactive-player' : '';

    const tr = document.createElement("tr");

    // Mobile-optimized row rendering - check for recent activity and future-only status
    let streakArrow = '';
    
    // Check if player has only future games (no real history)
    if (p.history.length === 0) {
      streakArrow = '<i class="fa-solid fa-minus mobile-streak-inactive"></i>';
    } else {
      // Check for recent activity in last 2 non-future games
      const nonFutureGames = [...games].filter(gameNum => {
        const gameData = raw.filter(r => r["Game No."] == gameNum);
        return !gameData.every(r => r.Future && r.Future.toLowerCase() === "yes");
      }).sort((a, b) => b - a);
      
      const lastTwoNonFutureGames = nonFutureGames.slice(0, 2);
      const hasPlayedRecentTwoGames = lastTwoNonFutureGames.some(gameNum => p.perGame[gameNum] && !p.perGame[gameNum].isFuture);
      
      if (!hasPlayedRecentTwoGames && nonFutureGames.length >= 2) {
        streakArrow = '<span class="mobile-streak-inactive">💤</span>';
      } else {
        streakArrow = s.type === 'W' ? '<i class="fa-solid fa-arrow-up mobile-streak-hot"></i>' : s.type === 'L' ? '<i class="fa-solid fa-arrow-down mobile-streak-cold"></i>' : '';
      }
    }

    const rowHTML = isMobile ? `
      <td>${trueRank === 1 ? '<i class="fa-solid fa-trophy" style="color: #ffd25a;"></i>' : trueRank}</td>

      <td class="name-cell">
        <div class="player-btn ${activePlayer===p.name?'active':''}"
             onclick="togglePlayer('${p.name}')"
             style="touch-action: manipulation;">
          <i class="fa-solid fa-chart-line"></i>
        </div>
        ${streakArrow ? `<span class="mobile-streak-spacer">${streakArrow}</span>` : ''}
        <span class="player-name">${p.name}</span>
      </td>

      <td class="${moneyClass(p.total)}">
        ${fmt(p.total)}
      </td>
      <td>${p.gamesPlayed}</td>
    ` : `
      <td>${trueRank === 1 ? '<i class="fa-solid fa-trophy" style="color: #ffd25a;"></i>' : trueRank}</td>

      <td class="name-cell">
        <div class="player-btn ${activePlayer===p.name?'active':''}"
             onclick="togglePlayer('${p.name}')">
          <i class="fa-solid fa-chart-line"></i>
        </div>
        <span class="player-name">${p.name}</span>
      </td>

      <td class="${moneyClass(p.total)}">
        ${fmt(p.total)}
      </td>
      <td>${fmt(p.lifetimeBuy)}</td>
      <td>${p.gamesPlayed}</td>

      <td class="streak-cell ${cls}">
        <span class="streak-icon-wrap">${icon}</span>
        <span class="streak-text">
          ${s.type ? `${s.type}${s.max}` : ""}
        </span>
      </td>
    `;

    if (rowClass) {
      tr.className = rowClass;
    }

    tr.innerHTML = rowHTML;

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
}

function toggleGame(game) {
  if (activeGame === game) {
    activeGame = null;
    hideDetailsPanel();
  } else {
    activeGame = game;
    activePlayer = null;
    showGame(game);
  }

  renderMain();
  renderGames();
}


function togglePlayer(name) {
  if (activePlayer === name) {
    activePlayer = null;
    hideDetailsPanel();
  } else {
    activePlayer = name;
    activeGame = null;
    showPlayer(name);
  }

  renderMain();
  renderGames();
}

/* -------------------------
   MODAL FUNCTIONS
--------------------------*/
function hideDetailsPanel() {
  const panel = document.getElementById("detailsPanel");
  if (isMobileDevice()) {
    panel.style.display = "none";
    panel.innerHTML = "";
    document.body.style.overflow = "auto";
  } else {
    panel.innerHTML = "";
  }
}

function showDetailsPanel(content) {
  const panel = document.getElementById("detailsPanel");
  if (isMobileDevice()) {
    panel.innerHTML = `
      <div class="modal-content">
        <button class="close-btn" onclick="hideDetailsPanel()">×</button>
        ${content}
      </div>
    `;
    panel.style.display = "block";
    document.body.style.overflow = "hidden";
  } else {
    panel.innerHTML = content;
  }
}

/* -------------------------
   GAME BUTTONS
--------------------------*/
function renderGames() {
  const div = document.getElementById("gameButtons");
  div.innerHTML = "";

  [...games].sort((a, b) => a - b).forEach(g => {
    const btn = document.createElement("button");

    btn.className = "game-btn" + (activeGame === g ? " active" : "");
    btn.textContent = "Game " + g;

    // Add mobile-specific attributes
    if (isMobileDevice()) {
      btn.style.touchAction = 'manipulation';
    }

    btn.onclick = () => toggleGame(g);

    div.appendChild(btn);
  });
}


window.renderPlayerSorted = function (key) {
  if (detailSort.key !== key) {
    detailSort.key = key;
    detailSort.dir = 1;
  } else {
    detailSort.dir *= -1;
  }

  const active = activePlayer;
  if (active) renderPlayerTable(active);
};

/* -------------------------
   PLAYER BREAKDOWN
--------------------------*/
function renderPlayerTable(name) {
  const p = players[name];

  const rows = sortDetail(playerDetailRows, detailSort.key, p.history);

  const isMobile = isMobileDevice();
  const headerText = isMobile ? `<span class="breakdown-primary">${name.toUpperCase()}</span><br><span class="breakdown-subtitle">Player Stats</span>` : `${name.toUpperCase()} - Player Stats`;

  const streak = calcStreaks(p.history);
  const streakText = streak.type === "W" ? `W${streak.max}` : streak.type === "L" ? `L${streak.max}` : "No streak";

  const winningsClass = p.total > 0 ? 'win' : p.total < 0 ? 'loss' : 'neutral';

  const streakIcon = streak.type === "W" ? '<i class="fa-solid fa-fire streak-icon hot"></i>' : streak.type === "L" ? '<i class="fa-solid fa-snowflake streak-icon cold"></i>' : '<i class="fa-solid fa-minus"></i>';
  const streakColorClass = streak.type === "W" ? 'streak-hot' : streak.type === "L" ? 'streak-cold' : 'streak-neutral';

  const content = `
    <h2>${headerText}</h2>

    <div class="player-stats-bar">
      <div class="stat">
        <span class="stat-name">Games Played</span><span class="stat-colon">:</span><span class="stat-value">${p.gamesPlayed}</span>
      </div>
      <div class="stat">
        <span class="stat-name">Streak</span><span class="stat-colon">:</span><span class="stat-value ${streakColorClass}">${streakIcon} ${streakText}</span>
      </div>
      <div class="stat">
        <span class="stat-name">Lifetime Buy-In</span><span class="stat-colon">:</span><span class="stat-value buy">${fmt(p.lifetimeBuy)}</span>
      </div>
      <div class="stat">
        <span class="stat-name">Winnings</span><span class="stat-colon">:</span><span class="stat-value ${winningsClass}">${fmt(p.total)}</span>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th onclick="renderPlayerSorted('game')">
              Game ${getSortIcon(detailSort.key, 'game', detailSort)}
            </th>
            <th onclick="renderPlayerSorted('buy')">
              ${isMobile ? 'In' : 'Buy In'} ${getSortIcon(detailSort.key, 'buy', detailSort)}
            </th>
            <th onclick="renderPlayerSorted('pay')">
              ${isMobile ? 'Out' : 'Payout'} ${getSortIcon(detailSort.key, 'pay', detailSort)}
            </th>
            <th onclick="renderPlayerSorted('win')">
              Winnings ${getSortIcon(detailSort.key, 'win', detailSort)}
            </th>
            <th onclick="renderPlayerSorted('streak')">
              Streak ${getSortIcon(detailSort.key, 'streak', detailSort)}
            </th>
          </tr>
        </thead>

        <tbody>
          ${rows.map((r, index) => {
            let streakIcon, streakClass, streakText;
            
            if (r.isFuture) {
              // Future games show no streak
              streakIcon = `<i class="fa-solid fa-clock"></i>`;
              streakClass = 'streak-future';
              streakText = 'TBD';
            } else {
              // Calculate streak up to this game (excluding future games)
              const nonFutureHistory = p.history; // Already filtered in build()
              const gameIndex = nonFutureHistory.indexOf(r.win);
              const historyUpToGame = gameIndex >= 0 ? nonFutureHistory.slice(0, gameIndex + 1) : [];
              const gameStreak = calcStreaks(historyUpToGame);
              const isWin = gameStreak.type === "W";
              streakIcon = isWin 
                ? `<i class="fa-solid fa-fire streak-icon hot"></i>` 
                : `<i class="fa-solid fa-snowflake streak-icon cold"></i>`;
              streakClass = isWin 
                ? `streak-win-${Math.min(gameStreak.max, 5)}` 
                : `streak-loss-${Math.min(gameStreak.max, 5)}`;
              streakText = gameStreak.type ? `${gameStreak.type}${gameStreak.max}` : "-";
            }
            
            return `
              <tr ${r.isFuture ? 'class="future-game"' : ''}>
                <td>${r.game}</td>
                <td class="buy">${fmt(r.buy)}</td>
                <td class="pay">${fmt(r.pay)}</td>
                <td class="${r.win >= 0 ? 'win' : 'loss'}">${fmt(r.win)}</td>
                <td class="streak-cell ${streakClass}">
                  <span class="streak-icon-wrap">${streakIcon}</span>
                  <span class="streak-text">${streakText}</span>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;

  showDetailsPanel(content);
}


function showPlayer(name) {
  const p = players[name];

  // If player has no real history (future-only), show simple message
  if (p.history.length === 0) {
    const isMobile = isMobileDevice();
    const headerText = isMobile ? `<span class="breakdown-primary">${name.toUpperCase()}</span><br><span class="breakdown-subtitle">Player Stats</span>` : `${name.toUpperCase()} - Player Stats`;
    
    const content = `
      <h2>${headerText}</h2>
      <div style="text-align: center; padding: 40px 20px; color: #888888; font-size: 18px; opacity: 0.7;">
        <i class="fa-solid fa-clock" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
        No games played yet
      </div>
    `;
    
    showDetailsPanel(content);
    return;
  }
  
  // Only show non-future games for players with real history
  playerDetailRows = Object.entries(p.perGame)
    .filter(([g, v]) => !v.isFuture)
    .map(([g, v]) => ({
      game: g,
      buy: v.buy,
      pay: v.pay,
      win: v.win,
      isFuture: false,
      streak: 0 // Will be calculated in render
    }));

  // Auto-sort by game DESC on initial display
  detailSort.key = 'game';
  detailSort.dir = -1;

  renderPlayerTable(name);
}


window.renderGameSorted = function (key) {
  if (detailSort.key !== key) {
    detailSort.key = key;
    detailSort.dir = 1;
  } else {
    detailSort.dir *= -1;
  }

  const active = activeGame;
  if (active) renderGameTable(active);
};

/* -------------------------
   GAME BREAKDOWN
--------------------------*/
function renderGameTable(game) {
  const rows = sortDetail(gameDetailRows, detailSort.key);

  const isMobile = isMobileDevice();
  const headerText = isMobile ? `<span class="breakdown-primary">GAME ${game}</span><br><span class="breakdown-subtitle">Game Stats</span>` : `GAME ${game} - Game Stats`;

  // Calculate game stats
  const totalPlayers = gameDetailRows.length;
  const totalBuyIn = gameDetailRows.reduce((sum, row) => sum + row.buy, 0);
  
  // Check raw data directly for future game detection
  const rawGameData = raw.filter(r => r["Game No."] == game);
  const isFutureGame = rawGameData.length > 0 && rawGameData.every(r => r.Future && r.Future.toLowerCase() === "yes");
  const winner = isFutureGame ? { player: "TBD" } : gameDetailRows.reduce((prev, current) => (current.win > prev.win) ? current : prev);

  const content = `
    <h2>${headerText}</h2>

    <div class="player-stats-bar">
      <div class="stat">
        <span class="stat-name">Players</span><span class="stat-colon">:</span><span class="stat-value">${totalPlayers}</span>
      </div>
      <div class="stat">
        <span class="stat-name">Pot</span><span class="stat-colon">:</span><span class="stat-value buy">${fmt(totalBuyIn)}</span>
      </div>
      <div class="stat">
        <span class="stat-name">Chip Leader</span><span class="stat-colon">:</span><span class="stat-value ${isFutureGame ? '' : 'win'}">${winner.player}</span>
      </div>
    </div>

    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th onclick="renderGameSorted('player')">
              Player ${getSortIcon(detailSort.key, 'player', detailSort)}
            </th>
            <th onclick="renderGameSorted('buy')">
              ${isMobile ? 'In' : 'Buy In'} ${getSortIcon(detailSort.key, 'buy', detailSort)}
            </th>
            <th onclick="renderGameSorted('pay')">
              ${isMobile ? 'Out' : 'Payout'} ${getSortIcon(detailSort.key, 'pay', detailSort)}
            </th>
            <th onclick="renderGameSorted('win')">
              Winnings ${getSortIcon(detailSort.key, 'win', detailSort)}
            </th>
          </tr>
        </thead>

        <tbody>
          ${rows.map(r => `
            <tr>
              <td>${r.player}</td>
              <td class="buy">${fmt(r.buy)}</td>
              <td class="pay">${fmt(r.pay)}</td>
              <td class="${r.win >= 0 ? 'win' : 'loss'}">${fmt(r.win)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  showDetailsPanel(content);
}

function showGame(game) {
  gameDetailRows = raw
    .filter(r => r["Game No."] == game)
    .map(r => ({
      player: r.Player,
      buy: money(r["Buy In"]),
      pay: money(r["Pay Out"]),
      win: money(r["Pay Out"]) - money(r["Buy In"]),
      isFuture: r.Future && r.Future.toLowerCase() === "yes"
    }));

  // Auto-sort by winnings DESC on initial display
  detailSort.key = 'win';
  detailSort.dir = -1;

  renderGameTable(game);
}

/* -------------------------
   LOAD
--------------------------*/
Papa.parse(SHEET_URL, {
  download: true,
  header: true,
  skipEmptyLines: true,
  complete: res => {
    raw = res.data;
    build(raw);
    renderStatsHeader();
    renderMain();
    renderGames();
    renderActiveToggle();

  }
});
