const app = document.getElementById('app');

const cpuPlayers = ['CPU1', 'CPU2', 'CPU3'];
const turnOrder = ['あなた', ...cpuPlayers];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const state = {
  route: 'top',
  game: createNewGameState(),
};

function createDeck(includeJoker = true) {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  if (includeJoker) deck.push({ rank: 'JOKER', suit: '🃏', code: 'ジョーカー' });
  return deck;
}

function shuffle(cards) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function rankValue(rank, isRevolution) {
  if (rank === 'JOKER') return 100;
  const idx = RANKS.indexOf(rank);
  return isRevolution ? RANKS.length - idx : idx;
}

function compareCards(a, b, isRevolution) {
  return rankValue(a.rank, isRevolution) - rankValue(b.rank, isRevolution);
}

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

function createNewGameState() {
  const shuffled = shuffle(createDeck(true));
  const hands = [0, 1, 2, 3].map((i) => shuffled.slice(i * 13, (i + 1) * 13));
  return {
    players: turnOrder.map((name, i) => ({ name, isCpu: i > 0, hand: hands[i], finished: false })),
    table: [],
    tableOwner: '-',
    selectedCards: [],
    message: 'カードを選んでください',
    currentTurnIndex: 0,
    isRevolution: false,
    lockSuit: null,
    cpuLogs: [],
    passCount: 0,
    ranking: [],
    winnerShown: false,
    exchangePhase: false,
    exchangeDone: false,
    exchangeSelection: [],
  };
}

function getActivePlayer() { return state.game.players[state.game.currentTurnIndex]; }
function playerHand() { return state.game.players[0].hand; }

function isValidSet(cards) {
  if (!cards.length) return false;
  const nonJoker = cards.filter((c) => c.rank !== 'JOKER');
  return nonJoker.every((c) => c.rank === nonJoker[0]?.rank);
}

function getBaseRank(cards) {
  const nonJoker = cards.filter((c) => c.rank !== 'JOKER');
  return nonJoker[0]?.rank || 'JOKER';
}

function satisfyLock(cards, lockSuit) {
  if (!lockSuit) return true;
  return cards.every((c) => c.rank === 'JOKER' || c.suit === lockSuit);
}

function canPlayCards(cards) {
  const game = state.game;
  if (!isValidSet(cards)) return { ok: false, reason: '同じ数字のカードを選んでください' };
  if (!satisfyLock(cards, game.lockSuit)) return { ok: false, reason: '縛り中です。同じスートのカードを出してください' };
  if (!game.table.length) return { ok: true };
  if (cards.length !== game.table.length) return { ok: false, reason: '場と同じ枚数のカードを出してください' };

  const tableRank = getBaseRank(game.table);
  const selectedRank = getBaseRank(cards);
  if (tableRank !== 'JOKER' && selectedRank !== 'JOKER') {
    if (rankValue(selectedRank, game.isRevolution) <= rankValue(tableRank, game.isRevolution)) {
      return { ok: false, reason: '場のカードより強いカードを出してください' };
    }
  }
  if (game.table.length >= 2) {
    const tr = getBaseRank(game.table);
    const sr = getBaseRank(cards);
    if (tr !== 'JOKER' && sr !== 'JOKER' && sr === tr) return { ok: false, reason: '場のカードより強いカードを出してください' };
  }
  return { ok: true };
}

function addCpuLog(text) {
  state.game.cpuLogs.unshift(text);
  state.game.cpuLogs = state.game.cpuLogs.slice(0, 5);
}

function advanceTurn() {
  const game = state.game;
  if (game.ranking.length === 4) return;
  let next = game.currentTurnIndex;
  do {
    next = (next + 1) % 4;
  } while (game.players[next].finished);
  game.currentTurnIndex = next;
}

function clearTable(withMessage = true) {
  state.game.table = [];
  state.game.tableOwner = '-';
  state.game.lockSuit = null;
  state.game.passCount = 0;
  if (withMessage) state.game.message = '場を流しました';
}

function handleWin(player) {
  const game = state.game;
  if (!player.finished && player.hand.length === 0) {
    player.finished = true;
    game.ranking.push(player.name);
    if (player.name === 'あなた' && !game.winnerShown) {
      game.winnerShown = true;
      game.message = 'あなたの上がりです！';
    }
  }
  if (game.ranking.length === 3) {
    const last = game.players.find((p) => !p.finished);
    if (last) { last.finished = true; game.ranking.push(last.name); }
  }
}

function applySpecialRules(cards) {
  const game = state.game;
  const hasEight = cards.some((c) => c.rank === '8');
  const isRev = cards.length === 4 && isValidSet(cards);
  if (isRev) {
    game.isRevolution = !game.isRevolution;
    game.message = game.isRevolution ? '革命！' : '革命返し！';
  }
  if (hasEight) {
    game.message = `${game.message} 8切り！`;
    clearTable(false);
  }
}

function updateLock(cards) {
  const game = state.game;
  if (!game.table.length) return;
  const prev = game.table[0];
  const curr = cards[0];
  if (prev && curr && prev.suit === curr.suit && prev.rank !== 'JOKER' && curr.rank !== 'JOKER') game.lockSuit = curr.suit;
}

function placeCards(player, cards) {
  const game = state.game;
  updateLock(cards);
  game.table = cards;
  game.tableOwner = player.name;
  game.passCount = 0;
  applySpecialRules(cards);
}

function playSelectedCards() {
  const game = state.game;
  if (game.exchangePhase) return;
  if (getActivePlayer().name !== 'あなた') return;
  if (!game.selectedCards.length) { game.message = 'カードを選んでください'; render(); return; }
  const hand = playerHand();
  const cards = game.selectedCards.map((i) => hand[i]).filter(Boolean);
  const valid = canPlayCards(cards);
  if (!valid.ok) { game.message = valid.reason; render(); return; }
  const set = new Set(game.selectedCards);
  state.game.players[0].hand = hand.filter((_, i) => !set.has(i));
  game.selectedCards = [];
  placeCards(game.players[0], cards);
  handleWin(game.players[0]);
  if (game.ranking.length === 4) { game.message = '順位確定'; game.exchangePhase = true; render(); return; }
  advanceTurn();
  processCpuTurns();
  render();
}

function passTurn() {
  const game = state.game;
  if (game.exchangePhase) return;
  const player = getActivePlayer();
  game.passCount += 1;
  if (player.isCpu) addCpuLog(`${player.name} が パスしました`);
  else game.message = 'パスしました';
  advanceTurn();
  if (game.passCount >= game.players.filter((p) => !p.finished).length - 1) clearTable(true);
  if (getActivePlayer().isCpu) processCpuTurns();
  render();
}

function findCpuPlayableCards(player) {
  const hand = [...player.hand].sort((a, b) => compareCards(a, b, state.game.isRevolution));
  const tableLen = state.game.table.length || 1;
  const grouped = {};
  hand.forEach((c) => {
    const key = c.rank === 'JOKER' ? 'JOKER' : c.rank;
    grouped[key] = grouped[key] || [];
    grouped[key].push(c);
  });
  const candidates = [];
  Object.values(grouped).forEach((arr) => {
    if (arr.length >= tableLen) candidates.push(arr.slice(0, tableLen));
  });
  if (!state.game.table.length) return candidates.sort((a, b) => compareCards(a[0], b[0], state.game.isRevolution))[0] || [];
  const valid = candidates.filter((c) => canPlayCards(c).ok);
  valid.sort((a, b) => compareCards(a[0], b[0], state.game.isRevolution));
  return valid[0] || [];
}

function processCpuTurns() {
  const game = state.game;
  while (getActivePlayer().isCpu && game.ranking.length < 4 && !game.exchangePhase) {
    const player = getActivePlayer();
    const play = findCpuPlayableCards(player);
    if (!play.length) {
      game.passCount += 1;
      addCpuLog(`${player.name} が パスしました`);
      if (game.passCount >= game.players.filter((p) => !p.finished).length - 1) clearTable(true);
      advanceTurn();
      continue;
    }
    play.forEach((card) => {
      const idx = player.hand.findIndex((h) => h.code === card.code && h.suit === card.suit);
      if (idx >= 0) player.hand.splice(idx, 1);
    });
    placeCards(player, play);
    addCpuLog(`${player.name} が ${play.map((c) => (c.rank === 'JOKER' ? 'ジョーカー' : `${c.rank}${c.suit}`)).join(' ')} を出しました`);
    handleWin(player);
    if (game.ranking.length === 4) { game.message = '順位確定'; game.exchangePhase = true; break; }
    advanceTurn();
  }
}

function toggleCardSelection(index) {
  if (state.game.exchangePhase) {
    const pos = state.game.exchangeSelection.indexOf(index);
    if (pos >= 0) state.game.exchangeSelection.splice(pos, 1); else state.game.exchangeSelection.push(index);
    render();
    return;
  }
  const selectedIndex = state.game.selectedCards.indexOf(index);
  if (selectedIndex >= 0) state.game.selectedCards.splice(selectedIndex, 1);
  else state.game.selectedCards.push(index);
  state.game.message = state.game.selectedCards.length ? `${state.game.selectedCards.length}枚選択中` : 'カードを選んでください';
  render();
}

function runExchange() {
  const game = state.game;
  const ranking = game.ranking;
  if (ranking.length < 4) return;
  const byName = Object.fromEntries(game.players.map((p) => [p.name, p]));
  const first = byName[ranking[0]], second = byName[ranking[1]], third = byName[ranking[2]], fourth = byName[ranking[3]];

  const pickWeak = (player, n) => [...player.hand].sort((a, b) => compareCards(a, b, false)).slice(0, n);
  const pickStrong = (player, n) => [...player.hand].sort((a, b) => compareCards(b, a, false)).slice(0, n);

  const ex12 = first.name === 'あなた' ? game.exchangeSelection.map(i => first.hand[i]).filter(Boolean) : pickWeak(first, 2);
  if (first.name === 'あなた' && ex12.length !== 2) { game.message = '1位として2枚選択してください'; return; }
  const ex21 = second.name === 'あなた' ? game.exchangeSelection.map(i => second.hand[i]).filter(Boolean) : pickWeak(second, 1);
  if (second.name === 'あなた' && ex21.length !== 1) { game.message = '2位として1枚選択してください'; return; }

  const ex43 = pickStrong(fourth, 2);
  const ex34 = pickStrong(third, 1);

  function move(give, recv, cards) {
    cards.forEach((c) => {
      const idx = give.hand.findIndex((h) => h.code === c.code && h.suit === c.suit);
      if (idx >= 0) recv.hand.push(give.hand.splice(idx, 1)[0]);
    });
  }

  move(first, fourth, ex12); move(fourth, first, ex43);
  move(second, third, ex21); move(third, second, ex34);
  game.exchangeDone = true;
  game.message = '交換完了';
}

function resetGame() {
  state.game = createNewGameState();
  render();
}

function nextGameFromExchange() {
  state.game = createNewGameState();
  render();
}

const templates = { top: `...`, login: `...`, rooms: `...` };
templates.top = `<section class="screen"><h2>トップ画面</h2><h3>つなサポ大富豪</h3><p>ようこそ！大富豪の試作版です。</p><div class="actions-row top-links"><button onclick="go('login')">ログインへ</button><button onclick="go('rooms')">ルーム一覧へ</button><button onclick="go('game')">ゲームへ</button></div></section>`;
templates.login = `<section class="screen"><h2>ログイン画面</h2><p><span class="badge">現時点では未使用</span> 将来Googleログイン予定。</p><input placeholder="ニックネーム"/></section>`;
templates.rooms = `<section class="screen"><h2>ルーム一覧（モック）</h2><p>オンライン対戦は未実装です。</p><button onclick="go('game')">ゲーム開始</button></section>`;

function renderCard(card, isButton, index, selected) {
  const cls = `playing-card${isButton ? ' card-button' : ''}${selected ? ' selected' : ''}`;
  const colorClass = card.rank === 'JOKER' ? 'joker' : isRedSuit(card.suit) ? 'red' : 'black';
  const rankLabel = card.rank === 'JOKER' ? 'JOKER' : card.rank;
  const suitLabel = card.rank === 'JOKER' ? '🃏' : card.suit;
  const inner = `<span class="card-corner tl">${rankLabel}<small>${suitLabel}</small></span><span class="card-center">${rankLabel}<small>${suitLabel}</small></span><span class="card-corner br">${rankLabel}<small>${suitLabel}</small></span>`;
  return isButton ? `<button class="${cls} ${colorClass}" onclick="toggleCard(${index})">${inner}</button>` : `<div class="${cls} ${colorClass}">${inner}</div>`;
}

function gameTemplate() {
  const game = state.game;
  const tableCards = game.table.length ? game.table.map((card) => renderCard(card, false)).join('') : '<p class="empty-note">まだカードは出ていません</p>';
  const hand = playerHand();
  const handCards = hand.map((card, idx) => renderCard(card, true, idx, game.exchangePhase ? game.exchangeSelection.includes(idx) : game.selectedCards.includes(idx))).join('');
  const rankList = game.ranking.map((n, i) => `<li>${i + 1}位：${n}</li>`).join('');
  const cpuCounts = game.players.filter((p) => p.isCpu).map((p) => `<li>${p.name}：残り${p.hand.length}枚</li>`).join('');

  return `<section class="screen">
    <h2>ゲーム画面</h2>
    <p>現在のターン: <strong>${getActivePlayer().name}</strong></p>
    <p>現在の状態: <strong>${game.isRevolution ? '革命中' : '通常'}</strong></p>
    <p>縛り状態: <strong>${game.lockSuit || 'なし'}</strong></p>
    <p>直前に出した人: <strong>${game.tableOwner}</strong></p>
    ${game.winnerShown ? '<p class="winner-banner">あなたの上がりです！</p>' : ''}
    <div class="card"><h3>場に出ているカード</h3><div class="cards-row">${tableCards}</div></div>
    <div class="card"><h3>CPU履歴</h3><ul>${game.cpuLogs.map((l) => `<li>${l}</li>`).join('') || '<li>まだ行動はありません</li>'}</ul><h4>CPU残り手札</h4><ul>${cpuCounts}</ul></div>
    ${game.ranking.length === 4 ? `<div class="card"><h3>順位確定</h3><ol>${rankList}</ol></div>` : ''}
    ${game.exchangePhase ? `<div class="card"><h3>カード交換フェーズ</h3><p>1位↔4位は2枚、2位↔3位は1枚交換します。</p><p>${game.message}</p><button onclick="runExchangePhase()">交換を実行</button>${game.exchangeDone ? '<button onclick="startNextGame()">次のゲーム開始</button>' : ''}</div>` : ''}
    <div class="card"><h3>あなたの手札</h3><div class="cards-row hand-row">${handCards || '<p class="empty-note">手札がありません</p>'}</div>
      <div class="actions-row"><button onclick="playCards()">カードを出す</button><button class="btn-alt" onclick="pass()">パス</button><button class="btn-alt" onclick="clearField()">場を流す</button><button onclick="dealNew()">新しく配る</button></div>
      <p class="message-area">${game.message}</p></div>
  </section>`;
}

window.go = (route) => { state.route = route; render(); };
window.toggleCard = toggleCardSelection;
window.playCards = playSelectedCards;
window.pass = passTurn;
window.dealNew = resetGame;
window.clearField = () => { clearTable(true); render(); };
window.runExchangePhase = () => { runExchange(); render(); };
window.startNextGame = nextGameFromExchange;

function render() { app.innerHTML = state.route === 'game' ? gameTemplate() : (templates[state.route] || templates.top); }
render();
