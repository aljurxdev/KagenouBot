/* tic-toc-toe game cmd by Jacob arken */


import AuroraBetaStyler from "@aurora/styler";

type Cell = "x" | "o" | "";
type Difficulty = "easy" | "normal" | "hard";

interface Game {
  db: any;
  usersData: any;
  bet: number;
  escrowId: string | null;
  board: Cell[];
  player: "x" | "o";
  bot: "x" | "o";
  owner: string;
  threadID: string;
  difficulty: Difficulty;
  lastMsgID: string | null;
  timer: any;
}

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];
const NUMS = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"];
const MARK: Record<string, string> = { x: "❌", o: "⭕" };
const RANDOM_CHANCE: Record<Difficulty, number> = { easy: 0.6, normal: 0.25, hard: 0 };
const IDLE_MS = 5 * 60 * 1000;
const MIN_BET = 10;
const MAX_BET = 1000000;
const PAYOUT: Record<Difficulty, number> = { easy: 0.5, normal: 1, hard: 2 };
const COL_USERS = "users";
const COL_ESCROW = "ttt_escrow";
const games = new Map<string, Game>();

function fmt(n: number): string { return Math.floor(Number(n) || 0).toLocaleString("en-US"); }

async function loadUser(db: any, usersData: any, uid: string): Promise<any> {
  let data: any = (usersData && typeof usersData.get === "function" ? usersData.get(uid) : null) || {};
  if (db) {
    const doc = await db.db(COL_USERS).findOne({ userId: uid });
    if (doc && doc.data) data = doc.data;
  }
  data.balance = Number(data.balance) || 0;
  return data;
}

async function saveUser(db: any, usersData: any, uid: string, data: any): Promise<void> {
  if (usersData && typeof usersData.set === "function") usersData.set(uid, data);
  if (db) await db.db(COL_USERS).updateOne({ userId: uid }, { $set: { userId: uid, data } }, { upsert: true });
}

async function payUser(db: any, usersData: any, uid: string, amount: number): Promise<number> {
  const u = await loadUser(db, usersData, uid);
  u.balance += Math.floor(amount);
  await saveUser(db, usersData, uid, u);
  return u.balance;
}

async function closeEscrow(game: Game, status: string): Promise<void> {
  if (game.db && game.escrowId) await game.db.db(COL_ESCROW).updateOne({ id: game.escrowId }, { $set: { status } });
}

type Outcome = "win" | "lose" | "draw" | "forfeit";

async function settle(game: Game, outcome: Outcome): Promise<string> {
  if (!game.bet) return "";
  let line = "";
  if (outcome === "win") {
    const profit = Math.floor(game.bet * PAYOUT[game.difficulty]);
    const bal = await payUser(game.db, game.usersData, game.owner, game.bet + profit);
    line = `\n\n💰 You won ${fmt(profit)} coins!\n💸 Wallet: ${fmt(bal)} coins`;
  } else if (outcome === "draw") {
    const bal = await payUser(game.db, game.usersData, game.owner, game.bet);
    line = `\n\n🤝 Bet refunded: ${fmt(game.bet)} coins\n💸 Wallet: ${fmt(bal)} coins`;
  } else {
    const u = await loadUser(game.db, game.usersData, game.owner);
    line = `\n\n💸 You lost ${fmt(game.bet)} coins.\n💸 Wallet: ${fmt(u.balance)} coins`;
  }
  await closeEscrow(game, outcome);
  game.escrowId = null;
  return line;
}

function styled(header: string, symbol: string, body: string): string {
  return AuroraBetaStyler.styleOutput({
    headerText: header,
    headerSymbol: symbol,
    headerStyle: "bold",
    bodyText: body,
    bodyStyle: "sansSerif",
    footerText: "Developed by: Aljur Pogoy",
  });
}

function render(board: Cell[]): string {
  const rows: string[] = [];
  for (let r = 0; r < 3; r++) {
    rows.push([0, 1, 2].map(c => { const i = r * 3 + c; return board[i] ? MARK[board[i]] : NUMS[i]; }).join(" "));
  }
  return rows.join("\n");
}

function winner(board: Cell[]): Cell {
  for (const [a, b, c] of LINES) if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
  return "";
}

function full(board: Cell[]): boolean { return board.every(c => c); }
function empties(board: Cell[]): number[] { return board.map((c, i) => (c ? -1 : i)).filter(i => i >= 0); }

function minimax(board: Cell[], turn: "x" | "o", me: "x" | "o"): number {
  const w = winner(board);
  if (w) return w === me ? 10 : -10;
  if (full(board)) return 0;
  const other = turn === "x" ? "o" : "x";
  let best = turn === me ? -Infinity : Infinity;
  for (const i of empties(board)) {
    board[i] = turn;
    const s = minimax(board, other, me);
    board[i] = "";
    best = turn === me ? Math.max(best, s) : Math.min(best, s);
  }
  return best;
}

function botMove(game: Game): number {
  const free = empties(game.board);
  if (Math.random() < RANDOM_CHANCE[game.difficulty]) return free[Math.floor(Math.random() * free.length)];
  const other = game.bot === "x" ? "o" : "x";
  let bestScore = -Infinity;
  let moves: number[] = [];
  for (const i of free) {
    game.board[i] = game.bot;
    const s = minimax(game.board, other, game.bot);
    game.board[i] = "";
    if (s > bestScore) { bestScore = s; moves = [i]; } else if (s === bestScore) moves.push(i);
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

function keyOf(threadID: string, owner: string): string { return `${threadID}:${owner}`; }

function clearGame(game: Game): void {
  if (game.lastMsgID) global.replyListeners.delete(game.lastMsgID);
  if (game.timer) clearTimeout(game.timer);
  games.delete(keyOf(game.threadID, game.owner));
}

function sendWithId(api: any, text: string, threadID: string, replyTo: string): Promise<string | null> {
  return new Promise(resolve => {
    api.sendMessage(text, threadID, (err: any, info: any) => resolve(info && info.messageID ? info.messageID : null), replyTo);
  });
}

async function postTurn(api: any, game: Game, header: string, intro: string, replyTo: string): Promise<void> {
  const betLine = game.bet ? `\n💰 Bet: ${fmt(game.bet)} coins | Win: +${fmt(Math.floor(game.bet * PAYOUT[game.difficulty]))}` : "";
  const body = `${intro}${betLine}\n\n${render(game.board)}\n\nYou are ${MARK[game.player]} (${game.player.toUpperCase()}). I am ${MARK[game.bot]} (${game.bot.toUpperCase()}).\nReply to this message with your move:\n${game.player} <1-9>   example: ${game.player} 6`;
  const id = await sendWithId(api, styled(header, "🎮", body), game.threadID, replyTo);
  if (game.lastMsgID) global.replyListeners.delete(game.lastMsgID);
  if (game.timer) clearTimeout(game.timer);
  if (!id) { games.delete(keyOf(game.threadID, game.owner)); return; }
  game.lastMsgID = id;
  global.registerEnkiduListener(id, async ({ api: a, event }: any) => { await onReply(a, event, game); });
  game.timer = setTimeout(async () => {
    if (games.get(keyOf(game.threadID, game.owner)) === game) {
      clearGame(game);
      const extra = await settle(game, "forfeit");
      api.sendMessage(styled("Tic Tac Toe", "⌛", `The game was closed because it was idle for 5 minutes.${game.bet ? " Your bet is forfeited." : ""}${extra}`), game.threadID);
    }
  }, IDLE_MS);
}

async function finish(api: any, game: Game, outcome: Outcome, symbol: string, text: string, replyTo: string): Promise<void> {
  clearGame(game);
  const extra = await settle(game, outcome);
  await api.sendMessage(styled("Tic Tac Toe", symbol, `${text}${extra}\n\n${render(game.board)}\n\nPlay again with /ttt x or /ttt o`), game.threadID, replyTo);
}

async function onReply(api: any, event: any, game: Game): Promise<void> {
  if (event.senderID.toString() !== game.owner) return;
  if (games.get(keyOf(game.threadID, game.owner)) !== game) return;
  const m = (event.body || "").trim().match(/^(?:([xo])\s*)?([1-9])$/i);
  if (!m) {
    await api.sendMessage(styled("Tic Tac Toe", "⚠️", `Reply with your move like: ${game.player} 6\nPick a number from 1 to 9.`), event.threadID, event.messageID);
    return;
  }
  if (m[1] && m[1].toLowerCase() !== game.player) {
    await api.sendMessage(styled("Tic Tac Toe", "⚠️", `You are ${game.player.toUpperCase()}. Reply with: ${game.player} <1-9>`), event.threadID, event.messageID);
    return;
  }
  const idx = parseInt(m[2]) - 1;
  if (game.board[idx]) {
    await api.sendMessage(styled("Tic Tac Toe", "⚠️", `Cell ${idx + 1} is already taken. Pick a free number.`), event.threadID, event.messageID);
    return;
  }
  game.board[idx] = game.player;
  if (winner(game.board) === game.player) { await finish(api, game, "win", "🏆", "You win! Nice game.", event.messageID); return; }
  if (full(game.board)) { await finish(api, game, "draw", "🤝", "It's a draw!", event.messageID); return; }
  const move = botMove(game);
  game.board[move] = game.bot;
  if (winner(game.board) === game.bot) { await finish(api, game, "lose", "💀", `I played ${game.bot.toUpperCase()} at ${move + 1} and won. Better luck next time!`, event.messageID); return; }
  if (full(game.board)) { await finish(api, game, "draw", "🤝", `I played ${game.bot.toUpperCase()} at ${move + 1}. It's a draw!`, event.messageID); return; }
  await postTurn(api, game, "Tic Tac Toe", `I played ${game.bot.toUpperCase()} at ${move + 1}. Your turn!`, event.messageID);
}

const USAGE = "/ttt <x|o> [easy|normal|hard] [bet <amount>]";

async function refundOrphans(db: any, usersData: any, owner: string): Promise<string> {
  if (!db) return "";
  const active = new Set<string>();
  games.forEach(g => { if (g.escrowId) active.add(g.escrowId); });
  const rows = await db.db(COL_ESCROW).find({ userId: owner, status: "active" }).limit(20).toArray();
  let total = 0;
  for (const r of rows) {
    if (active.has(r.id)) continue;
    await payUser(db, usersData, owner, r.bet);
    await db.db(COL_ESCROW).updateOne({ id: r.id }, { $set: { status: "refunded" } });
    total += r.bet;
  }
  return total ? `\n\n♻️ A game was lost (bot restarted). Refunded ${fmt(total)} coins.` : "";
}

const tttCommand = {
  name: "ttt",
  aliases: ["tictactoe"],
  description: "Play Tic Tac Toe against the bot and bet coins. Pick x or o, the bot moves first and you reply to its messages.",
  usage: USAGE,
  config: {
    name: "ttt",
    author: "Aljur Pogoy",
    aliases: ["tictactoe"],
    description: "Play Tic Tac Toe against the bot and bet coins. Pick x or o, the bot moves first and you reply to its messages.",
    usage: USAGE,
    version: "2.0.0",
    category: "Games 🎮",
  },

  async run(ctx: any) {
    const { api, event, args, db, usersData } = ctx;
    const { threadID, messageID, senderID } = event;
    const owner = senderID.toString();
    const a: string[] = (args || []).map((x: string) => x.toLowerCase());
    const pick = a[0] || "";
    const refunded = await refundOrphans(db, usersData, owner);

    if (pick === "stop" || pick === "quit") {
      const g = games.get(keyOf(threadID, owner));
      if (!g) { await api.sendMessage(styled("Tic Tac Toe", "⚠️", `You have no active game.${refunded}`), threadID, messageID); return; }
      clearGame(g);
      const extra = await settle(g, "forfeit");
      await api.sendMessage(styled("Tic Tac Toe", "🛑", `Your game was closed.${g.bet ? " Quitting forfeits your bet." : ""}${extra}`), threadID, messageID);
      return;
    }

    if (pick !== "x" && pick !== "o") {
      await api.sendMessage(styled("Tic Tac Toe", "🎮", `Pick your symbol to start:\n/ttt x\n/ttt o\n\nDifficulty: easy | normal | hard\nBet coins: /ttt x easy bet 6000\n\nPayouts when you win:\neasy +50% of your bet\nnormal +100%\nhard +200%\nDraw refunds your bet. Losing or quitting loses it.\nBets: ${fmt(MIN_BET)} to ${fmt(MAX_BET)} coins.\n\nQuit a game: /ttt stop\nThe bot always moves first. Reply to the bot's message with your move, like: x 6${refunded}`), threadID, messageID);
      return;
    }

    let difficulty: Difficulty = "normal";
    let betTok: string | null = null;
    for (let i = 1; i < a.length; i++) {
      if (a[i] === "easy" || a[i] === "normal" || a[i] === "hard") difficulty = a[i] as Difficulty;
      else if (a[i] === "bet") { betTok = a[i + 1] || ""; i++; }
    }

    let bet = 0;
    if (betTok !== null) {
      const u = await loadUser(db, usersData, owner);
      bet = betTok === "all" ? Math.min(MAX_BET, u.balance) : parseInt(betTok.replace(/,/g, ""), 10);
      if (isNaN(bet) || bet < MIN_BET) { await api.sendMessage(styled("Tic Tac Toe", "⚠️", `Usage: /ttt ${pick} ${difficulty} bet <amount>\nMinimum bet is ${fmt(MIN_BET)} coins.${refunded}`), threadID, messageID); return; }
      if (bet > MAX_BET) { await api.sendMessage(styled("Tic Tac Toe", "🛑", `Maximum bet is ${fmt(MAX_BET)} coins.`), threadID, messageID); return; }
      if (u.balance < bet) { await api.sendMessage(styled("Tic Tac Toe", "❌", `You only have ${fmt(u.balance)} coins. You cannot bet ${fmt(bet)}.${refunded}`), threadID, messageID); return; }
    }

    const old = games.get(keyOf(threadID, owner));
    let oldNote = "";
    if (old) { clearGame(old); const s = await settle(old, "forfeit"); oldNote = old.bet ? `\nYour previous game was replaced and its bet was forfeited.${s}` : ""; }

    let escrowId: string | null = null;
    if (bet) {
      const u = await loadUser(db, usersData, owner);
      if (u.balance < bet) { await api.sendMessage(styled("Tic Tac Toe", "❌", `You only have ${fmt(u.balance)} coins. You cannot bet ${fmt(bet)}.`), threadID, messageID); return; }
      u.balance -= bet;
      await saveUser(db, usersData, owner, u);
      escrowId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      if (db) await db.db(COL_ESCROW).insertOne({ id: escrowId, userId: owner, threadID, bet, status: "active", created: Date.now() });
    }

    const game: Game = {
      db, usersData, bet, escrowId,
      board: Array(9).fill("") as Cell[],
      player: pick,
      bot: pick === "x" ? "o" : "x",
      owner,
      threadID,
      difficulty,
      lastMsgID: null,
      timer: null,
    };
    games.set(keyOf(threadID, owner), game);
    const first = botMove(game);
    game.board[first] = game.bot;
    await postTurn(api, game, "Tic Tac Toe", `New game vs ${difficulty.toUpperCase()} bot! I moved first: ${game.bot.toUpperCase()} at ${first + 1}.${oldNote}${refunded}`, messageID);
  },
};

module.exports = tttCommand;
module.exports.default = tttCommand;
