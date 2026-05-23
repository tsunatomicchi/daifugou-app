const app = document.getElementById('app');

const CPU_PLAYERS = ['CPU1', 'CPU2', 'CPU3'];
const TURN_ORDER = ['あなた', ...CPU_PLAYERS];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const state = {
  route: 'top',
  game: createNewGameState(),
  soundEnabled: true,
  audioReady: false,
  audioCtx: null,
};

function createDeck() {
  const deck = [];
  for (const rank of RANKS) for (const suit of SUITS) deck.push({ rank, suit, code: `${rank}${suit}` });
  deck.push({ rank: 'JOKER', suit: '🃏', code: 'JOKER' });
  return deck;
}
const shuffle = (cards) => cards.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((a) => a[1]);
const rankValue = (rank, rev) => rank === 'JOKER' ? 999 : (rev ? (RANKS.length - 1 - RANKS.indexOf(rank)) : RANKS.indexOf(rank));
const compareCards = (a, b, rev) => rankValue(a.rank, rev) - rankValue(b.rank, rev) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
const sortHand = (hand, rev) => hand.sort((a, b) => compareCards(a, b, rev));
const isRedSuit = (suit) => suit === '♥' || suit === '♦';

function createNewGameState(previousHands = null) {
  const dealtHands = previousHands || (() => {
    const shuffled = shuffle(createDeck());
    return [0, 1, 2, 3].map((i) => shuffled.slice(i * 13, (i + 1) * 13));
  })();
  const players = TURN_ORDER.map((name, i) => ({ name, isCpu: i > 0, finished: false, hand: sortHand(dealtHands[i], false), lastAction: '待機中', lastPlayedCards: [] }));
  return { players, table: [], tableType: null, tableOwner: '-', currentTurnIndex: 0, selectedCards: [], message: 'あなたの番です', isRevolution: false, lockSuit: null, stairLock: null, cpuLogs: [], passCount: 0, ranking: [], winnerBanner: false, exchangePhase: false, exchangeDone: false, exchangeSelection: [], pendingHandsForNextGame: null };
}

const getActivePlayer = () => state.game.players[state.game.currentTurnIndex];
const getPlayerByName = (name) => state.game.players.find((p) => p.name === name);
const handOfYou = () => getPlayerByName('あなた').hand;
const isPlayerTurn = () => getActivePlayer().name === 'あなた' && !state.game.exchangePhase;

function classifyPlay(cards) {
  if (!cards.length) return { valid: false, reason: 'カードを選んでください' };
  if (cards.some((c) => c.rank === 'JOKER')) {
    const nonJoker = cards.filter((c) => c.rank !== 'JOKER');
    if (nonJoker.length && !nonJoker.every((c) => c.rank === nonJoker[0].rank)) return { valid: false, reason: '同じ数字のカードを選んでください' };
    return { valid: true, type: 'set', strength: rankValue(nonJoker[0]?.rank || 'JOKER', state.game.isRevolution), size: cards.length, suit: null };
  }
  const sorted = [...cards].sort((a, b) => compareCards(a, b, false));
  const sameRank = sorted.every((c) => c.rank === sorted[0].rank);
  if (sameRank) return { valid: true, type: 'set', strength: rankValue(sorted[0].rank, state.game.isRevolution), size: cards.length, suit: sorted[0].suit };
  if (cards.length >= 3) {
    const sameSuit = sorted.every((c) => c.suit === sorted[0].suit);
    if (!sameSuit) return { valid: false, reason: '階段は同じスートでそろえてください' };
    for (let i = 1; i < sorted.length; i += 1) {
      if (RANKS.indexOf(sorted[i].rank) !== RANKS.indexOf(sorted[i - 1].rank) + 1) return { valid: false, reason: '階段は同じスートで連続した数字を選んでください' };
    }
    return { valid: true, type: 'stair', strength: rankValue(sorted[sorted.length - 1].rank, state.game.isRevolution), size: cards.length, suit: sorted[0].suit, sorted };
  }
  return { valid: false, reason: '同じ数字のカードを選んでください' };
}

function canPlayCards(cards) {
  const game = state.game;
  const play = classifyPlay(cards);
  if (!play.valid) return { ok: false, reason: play.reason };
  if (!game.table.length) return { ok: true, play };
  if (play.type !== game.tableType) return { ok: false, reason: game.tableType === 'stair' ? '階段縛り中です。同じスート・同じ枚数の連続カードを出してください' : '場と同じ種類の出し方にしてください' };
  if (cards.length !== game.table.length) return { ok: false, reason: '場と同じ枚数のカードを出してください' };
  if (play.type === 'stair') {
    if (!game.stairLock || play.suit !== game.stairLock.suit || play.size !== game.stairLock.count) return { ok: false, reason: '階段縛り中です。同じスート・同じ枚数の連続カードを出してください' };
  }
  if (game.lockSuit && play.type === 'set' && !cards.every((c) => c.rank === 'JOKER' || c.suit === game.lockSuit)) return { ok: false, reason: '縛り中です。同じスートのカードを出してください' };
  const tableTop = classifyPlay(game.table);
  if (play.strength <= tableTop.strength) return { ok: false, reason: '場のカードより強いカードを出してください' };
  return { ok: true, play };
}

const cardsToText = (cards) => cards.map((c) => (c.rank === 'JOKER' ? 'ジョーカー' : `${c.rank}${c.suit}`)).join(' ');
function addCpuLog(text) { state.game.cpuLogs.unshift(text); state.game.cpuLogs = state.game.cpuLogs.slice(0, 16); }
function findNextActiveIndex(fromIndex) { let idx = fromIndex; do idx = (idx + 1) % 4; while (state.game.players[idx].finished); return idx; }
function advanceTurn() { if (state.game.ranking.length < 4) state.game.currentTurnIndex = findNextActiveIndex(state.game.currentTurnIndex); }

function clearTable(msg = '全員がパスしたため、場を流しました') {
  const g = state.game;
  g.table = []; g.tableType = null; g.tableOwner = '-'; g.passCount = 0; g.lockSuit = null; g.stairLock = null; g.message = msg;
}

function handleFinish(player) {
  const g = state.game;
  if (!player.finished && player.hand.length === 0) {
    player.finished = true; g.ranking.push(player.name); g.message = player.name === 'あなた' ? 'あなたの上がりです！' : `${player.name}が上がりました！`; playSound('win');
  }
  if (g.ranking.length === 3) { const last = g.players.find((p) => !p.finished); if (last) { last.finished = true; g.ranking.push(last.name); } }
  if (g.ranking.length === 4) { g.exchangePhase = true; g.message = '順位確定。カード交換フェーズです。'; }
}

function applySpecialRules(cards, actorName, playType) {
  const g = state.game;
  if (cards.length === 4 && playType === 'set') { g.isRevolution = !g.isRevolution; addCpuLog(`${actorName}：${g.isRevolution ? '革命！' : '革命返し！'}`); }
  if (cards.some((c) => c.rank === '8')) { clearTable('8切り！場を流しました'); g.currentTurnIndex = TURN_ORDER.indexOf(actorName); }
}

function placeCards(player, cards, playInfo) {
  const g = state.game; const prev = g.table;
  g.table = playInfo.sorted || cards; g.tableType = playInfo.type; g.tableOwner = player.name; g.passCount = 0;
  if (playInfo.type === 'stair') { g.stairLock = { suit: playInfo.suit, count: playInfo.size }; g.lockSuit = null; }
  else if (prev.length && g.tableType === 'set' && prev.every((c) => c.suit === prev[0].suit) && cards.every((c) => c.rank === 'JOKER' || c.suit === prev[0].suit)) g.lockSuit = prev[0].suit;
  else g.lockSuit = null;
  player.lastPlayedCards = [...g.table]; player.lastAction = `出した: ${cardsToText(g.table)}`;
  playSound('play'); applySpecialRules(g.table, player.name, playInfo.type);
}

function processAfterAction(player) { handleFinish(player); if (state.game.ranking.length < 4) advanceTurn(); }

function playSelectedCards() {
  const g = state.game; if (!isPlayerTurn()) return;
  const cards = g.selectedCards.map((i) => handOfYou()[i]).filter(Boolean); const valid = canPlayCards(cards);
  if (!valid.ok) { g.message = valid.reason; playSound('error'); render(); return; }
  const removeSet = new Set(g.selectedCards); const you = getPlayerByName('あなた'); you.hand = you.hand.filter((_, i) => !removeSet.has(i)); g.selectedCards = [];
  placeCards(you, cards, valid.play); g.message = `あなた：${cardsToText(cards)} を出しました${valid.play.type === 'stair' ? '（階段）' : ''}`; addCpuLog(g.message); processAfterAction(you);
  if (getActivePlayer().isCpu && !g.exchangePhase) processCpuTurns(); render();
}

function handlePass(player) {
  const g = state.game; g.passCount += 1; player.lastAction = 'PASS'; player.lastPlayedCards = [];
  addCpuLog(`${player.name}：PASS`); const alive = g.players.filter((p) => !p.finished).length;
  if (g.passCount >= alive - 1 && g.table.length) { const leader = g.tableOwner; clearTable('全員がパスしたため、場を流しました'); g.currentTurnIndex = TURN_ORDER.indexOf(leader); return; }
  advanceTurn();
}
const passTurn = () => { if (!isPlayerTurn()) return; handlePass(getActivePlayer()); if (getActivePlayer().isCpu && !state.game.exchangePhase) processCpuTurns(); render(); };

function allPossiblePlays(player) {
  const hand = [...player.hand].sort((a, b) => compareCards(a, b, false)); const out = [];
  hand.forEach((c) => out.push([c]));
  const groups = new Map(); hand.forEach((c) => { if (!groups.has(c.rank)) groups.set(c.rank, []); groups.get(c.rank).push(c); });
  groups.forEach((arr) => { for (let n = 2; n <= arr.length; n += 1) out.push(arr.slice(0, n)); });
  SUITS.forEach((suit) => {
    const suited = hand.filter((c) => c.suit === suit && c.rank !== 'JOKER').sort((a, b) => RANKS.indexOf(a.rank) - RANKS.indexOf(b.rank));
    for (let i = 0; i < suited.length; i += 1) {
      const run = [suited[i]];
      for (let j = i + 1; j < suited.length; j += 1) {
        if (RANKS.indexOf(suited[j].rank) === RANKS.indexOf(run[run.length - 1].rank) + 1) { run.push(suited[j]); if (run.length >= 3) out.push([...run]); }
        else break;
      }
    }
  });
  return out;
}
function findCpuPlayableCards(player) {
  const valids = allPossiblePlays(player).map((cards) => ({ cards, ok: canPlayCards(cards) })).filter((x) => x.ok.ok);
  valids.sort((a, b) => rankValue(classifyPlay(a.cards).sorted?.slice(-1)[0]?.rank || a.cards[0].rank, state.game.isRevolution) - rankValue(classifyPlay(b.cards).sorted?.slice(-1)[0]?.rank || b.cards[0].rank, state.game.isRevolution) || a.cards.length - b.cards.length);
  return valids[0]?.cards || [];
}

function processCpuTurns() {
  const g = state.game;
  while (getActivePlayer().isCpu && !g.exchangePhase && g.ranking.length < 4) {
    const cpu = getActivePlayer(); const play = findCpuPlayableCards(cpu);
    if (!play.length) { handlePass(cpu); continue; }
    play.forEach((card) => { const idx = cpu.hand.findIndex((h) => h.code === card.code); if (idx >= 0) cpu.hand.splice(idx, 1); });
    const info = classifyPlay(play); placeCards(cpu, play, info); const log = `${cpu.name}：${cardsToText(play)}${info.type === 'stair' ? ' の階段を出しました' : ' を出しました'}`; addCpuLog(log); g.message = log; processAfterAction(cpu);
  }
  const turnName = getActivePlayer().name;
  if (turnName === 'あなた') { g.message = 'あなたの番です'; playSound('turn'); }
  else if (!g.exchangePhase) g.message = `${turnName}の番です`;
}

function toggleCardSelection(index) {
  const g = state.game; if (!isPlayerTurn() && !g.exchangePhase) return;
  const target = g.exchangePhase ? g.exchangeSelection : g.selectedCards; const pos = target.indexOf(index); if (pos >= 0) target.splice(pos, 1); else target.push(index); render();
}

function removeCards(player, cards) { cards.forEach((card) => { const idx = player.hand.findIndex((h) => h.code === card.code); if (idx >= 0) player.hand.splice(idx, 1); }); }
function runExchange() { /* keep existing behavior simplified */ const g = state.game; if (!g.exchangePhase || g.exchangeDone) return; g.exchangeDone = true; g.message = '交換完了'; }
function startNextGame() { state.game = createNewGameState(state.game.pendingHandsForNextGame); render(); }
function resetGame() { state.game = createNewGameState(); render(); }

function initAudio() { if (!state.audioCtx) state.audioCtx = new (window.AudioContext || window.webkitAudioContext)(); state.audioReady = true; }
function beep(freq, dur, type = 'sine', vol = 0.04, delay = 0) {
  if (!state.soundEnabled || !state.audioReady || !state.audioCtx) return;
  const ctx = state.audioCtx; const o = ctx.createOscillator(); const g = ctx.createGain(); o.type = type; o.frequency.value = freq; g.gain.value = vol;
  o.connect(g).connect(ctx.destination); const t = ctx.currentTime + delay; o.start(t); o.stop(t + dur);
}
function playSound(type) {
  try {
    if (type === 'play') beep(520, 0.05, 'triangle', 0.03);
    if (type === 'error') beep(180, 0.12, 'square', 0.04);
    if (type === 'turn') { beep(880, 0.06, 'sine', 0.035); beep(1175, 0.08, 'sine', 0.035, 0.08); }
    if (type === 'win') { [520, 660, 780, 980].forEach((f, i) => beep(f, 0.09, 'triangle', 0.03, i * 0.07)); }
  } catch (_) { /* no-op */ }
}

const templates = {
  top: `<section class="screen"><h2>トップ画面</h2><h3>つなサポ大富豪</h3><p>ようこそ！大富豪の試作版です。</p><div class="actions-row top-links"><button onclick="go('login')">ログインへ</button><button onclick="go('rooms')">ルーム一覧へ</button><button onclick="go('game')">ゲームへ</button></div></section>`,
  login: `<section class="screen"><h2>ログイン画面</h2><p><span class="badge">現時点では未使用</span> 将来Googleログイン予定。</p><input placeholder="ニックネーム"/></section>`,
  rooms: `<section class="screen"><h2>ルーム一覧（モック）</h2><p>オンライン対戦は未実装です。</p><button onclick="go('game')">ゲーム開始</button></section>`,
};
function renderCard(card, isButton, index, selected) { const cls = `playing-card${isButton ? ' card-button' : ''}${selected ? ' selected' : ''}`; const colorClass = card.rank === 'JOKER' ? 'joker' : isRedSuit(card.suit) ? 'red' : 'black'; const rank = card.rank === 'JOKER' ? 'JOKER' : card.rank; const suit = card.rank === 'JOKER' ? '🃏' : card.suit; const inner = `<span class="card-corner tl">${rank}<small>${suit}</small></span><span class="card-center">${rank}<small>${suit}</small></span><span class="card-corner br">${rank}<small>${suit}</small></span>`; return isButton ? `<button class="${cls} ${colorClass}" onclick="toggleCard(${index})">${inner}</button>` : `<div class="${cls} ${colorClass}">${inner}</div>`; }

function gameTemplate() {
  const g = state.game; const isYourTurn = isPlayerTurn();
  const tableCards = g.table.length ? g.table.map((c) => renderCard(c, false)).join('') : '<p class="empty-note">場札はありません</p>';
  const handCards = handOfYou().map((c, i) => renderCard(c, true, i, g.selectedCards.includes(i))).join('');
  return `<section class="screen ${isYourTurn ? 'your-turn' : ''}">
    <h2>ゲーム画面</h2>
    <div class="status-area"><p>現在のターン: <strong>${getActivePlayer().name}</strong></p><p>現在の状態: <strong>${g.isRevolution ? '革命中' : '通常'}</strong></p><p>縛り状態: <strong>${g.lockSuit || 'なし'}</strong></p><p>階段縛り: <strong>${g.stairLock ? `${g.stairLock.suit} ${g.stairLock.count}枚` : 'なし'}</strong></p><p>最後にカードを出した人: <strong>${g.tableOwner}</strong></p></div>
    <div class="card poker-table"><h3>場</h3><div class="cards-row">${tableCards}</div></div>
    <div class="card"><h3>CPUの状態と直近行動</h3>${CPU_PLAYERS.map((name) => { const p = getPlayerByName(name); return `<p>${name}: 残り${p.hand.length}枚 / ${p.lastAction}${p.lastPlayedCards.length ? `<span class='cpu-cards'>${p.lastPlayedCards.map((c) => renderCard(c, false)).join('')}</span>` : '<strong> PASS</strong>'}</p>`; }).join('')}<ul>${g.cpuLogs.map((log) => `<li>${log}</li>`).join('') || '<li>履歴なし</li>'}</ul></div>
    <div class="card"><h3>あなたの手札</h3><div class="cards-row hand-row">${handCards || '<p class="empty-note">手札なし</p>'}</div></div>
    <div class="card"><div class="actions-row"><button onclick="playCards()" ${!isYourTurn || g.exchangePhase ? 'disabled' : ''}>カードを出す</button><button class="btn-alt" onclick="pass()" ${!isYourTurn || g.exchangePhase ? 'disabled' : ''}>パス</button><button onclick="dealNew()">新しく配る</button><button class="btn-alt" onclick="toggleSound()">効果音 ${state.soundEnabled ? 'ON' : 'OFF'}</button></div></div>
    <div class="card"><h3>メッセージ</h3><p class="message-area">${g.message}</p>${g.winnerBanner ? '<p class="winner-banner">あなたの上がりです！</p>' : ''}</div>
    <div class="card"><h3>順位状況</h3><ol>${g.ranking.map((name, i) => `<li>${i + 1}位：${name}</li>`).join('') || '<li>まだ確定していません</li>'}</ol></div>
  </section>`;
}

window.go = (route) => { state.route = route; render(); };
window.toggleCard = toggleCardSelection; window.playCards = playSelectedCards; window.pass = passTurn; window.dealNew = resetGame; window.runExchangePhase = runExchange; window.nextGame = startNextGame;
window.toggleSound = () => { if (!state.audioReady) initAudio(); state.soundEnabled = !state.soundEnabled; render(); };
document.addEventListener('click', () => { if (!state.audioReady) initAudio(); }, { once: true });

function render() { app.innerHTML = state.route === 'game' ? gameTemplate() : (templates[state.route] || templates.top); }
render();
