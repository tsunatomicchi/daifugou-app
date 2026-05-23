const app = document.getElementById('app');

const CPU_PLAYERS = ['CPU1', 'CPU2', 'CPU3'];
const TURN_ORDER = ['あなた', ...CPU_PLAYERS];
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];

const state = {
  route: 'top',
  game: createNewGameState(),
};

function createDeck() {
  const deck = [];
  for (const rank of RANKS) {
    for (const suit of SUITS) {
      deck.push({ rank, suit, code: `${rank}${suit}` });
    }
  }
  deck.push({ rank: 'JOKER', suit: '🃏', code: 'JOKER' });
  return deck;
}

function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function rankValue(rank, isRevolution) {
  if (rank === 'JOKER') return 999;
  const idx = RANKS.indexOf(rank);
  return isRevolution ? (RANKS.length - 1 - idx) : idx;
}

function compareCards(a, b, isRevolution) {
  return rankValue(a.rank, isRevolution) - rankValue(b.rank, isRevolution);
}

function sortHand(hand, isRevolution) {
  return hand.sort((a, b) => compareCards(a, b, isRevolution) || SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit));
}

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

function createNewGameState(previousHands = null) {
  const dealtHands = previousHands || (() => {
    const shuffled = shuffle(createDeck());
    return [0, 1, 2, 3].map((i) => shuffled.slice(i * 13, (i + 1) * 13));
  })();

  const players = TURN_ORDER.map((name, i) => ({
    name,
    isCpu: i > 0,
    finished: false,
    hand: sortHand(dealtHands[i], false),
  }));

  return {
    players,
    table: [],
    previousTable: [],
    tableOwner: '-',
    currentTurnIndex: 0,
    selectedCards: [],
    message: 'あなたのターンです。カードを選んでください。',
    isRevolution: false,
    lockSuit: null,
    cpuLogs: [],
    passCount: 0,
    ranking: [],
    winnerBanner: false,
    exchangePhase: false,
    exchangeDone: false,
    exchangeSelection: [],
    pendingHandsForNextGame: null,
  };
}

function getActivePlayer() {
  return state.game.players[state.game.currentTurnIndex];
}

function getPlayerByName(name) {
  return state.game.players.find((p) => p.name === name);
}

function handOfYou() {
  return getPlayerByName('あなた').hand;
}

function isPlayerTurn() {
  return getActivePlayer().name === 'あなた' && !state.game.exchangePhase;
}

function isValidSet(cards) {
  if (!cards.length) return false;
  const nonJoker = cards.filter((c) => c.rank !== 'JOKER');
  return nonJoker.length === 0 || nonJoker.every((c) => c.rank === nonJoker[0].rank);
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
  if (!cards.length) return { ok: false, reason: 'カードを選んでください' };
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
  return { ok: true };
}

function cardsToText(cards) {
  return cards.map((c) => (c.rank === 'JOKER' ? 'ジョーカー' : `${c.rank}${c.suit}`)).join(' ');
}

function addCpuLog(text) {
  state.game.cpuLogs.unshift(text);
  state.game.cpuLogs = state.game.cpuLogs.slice(0, 12);
}

function findNextActiveIndex(fromIndex) {
  let idx = fromIndex;
  do {
    idx = (idx + 1) % 4;
  } while (state.game.players[idx].finished);
  return idx;
}

function advanceTurn() {
  const game = state.game;
  if (game.ranking.length >= 4) return;
  game.currentTurnIndex = findNextActiveIndex(game.currentTurnIndex);
}

function clearTable(withMessage = true) {
  const game = state.game;
  game.previousTable = game.table;
  game.table = [];
  game.lockSuit = null;
  game.passCount = 0;
  game.tableOwner = '-';
  if (withMessage) game.message = '場を流しました';
}

function updateLockByPrevious(previousTable, newCards) {
  const game = state.game;
  if (!previousTable.length || !newCards.length) return;
  const prevSuit = previousTable[0].suit;
  const currSuit = newCards[0].suit;
  const prevIsNormal = previousTable.every((c) => c.rank !== 'JOKER' && c.suit === prevSuit);
  const currIsNormal = newCards.every((c) => c.rank !== 'JOKER' && c.suit === currSuit);
  if (prevIsNormal && currIsNormal && prevSuit === currSuit) {
    game.lockSuit = currSuit;
    game.message = `${currSuit}縛り`;
  }
}

function handleFinish(player) {
  const game = state.game;
  if (!player.finished && player.hand.length === 0) {
    player.finished = true;
    game.ranking.push(player.name);
    if (player.name === 'あなた') {
      game.winnerBanner = true;
      game.message = 'あなたの上がりです！';
    } else {
      game.message = `${player.name}が上がりました！`;
    }
  }

  if (game.ranking.length === 3) {
    const last = game.players.find((p) => !p.finished);
    if (last) {
      last.finished = true;
      game.ranking.push(last.name);
    }
  }

  if (game.ranking.length === 4) {
    game.exchangePhase = true;
    game.message = '順位確定。カード交換フェーズです。';
  }
}

function applySpecialRules(cards, actorName) {
  const game = state.game;
  const hasEight = cards.some((c) => c.rank === '8');
  const isRevolutionSet = cards.length === 4 && isValidSet(cards);

  if (isRevolutionSet) {
    game.isRevolution = !game.isRevolution;
    const revText = game.isRevolution ? '革命！' : '革命返し！';
    game.message = revText;
    addCpuLog(`${actorName}：${revText}`);
  }

  if (hasEight) {
    game.message = `${game.message} 8切り！`.trim();
    addCpuLog(`${actorName}：${cardsToText(cards)} を出しました。8切り！`);
    clearTable(false);
    game.currentTurnIndex = TURN_ORDER.indexOf(actorName);
  }
}

function placeCards(player, cards) {
  const game = state.game;
  const previousTable = [...game.table];
  game.table = cards;
  game.tableOwner = player.name;
  game.passCount = 0;
  updateLockByPrevious(previousTable, cards);
  applySpecialRules(cards, player.name);
}

function processAfterAction(player) {
  handleFinish(player);
  if (state.game.ranking.length < 4) {
    advanceTurn();
  }
}

function playSelectedCards() {
  const game = state.game;
  if (!isPlayerTurn()) return;

  const hand = handOfYou();
  const cards = game.selectedCards.map((i) => hand[i]).filter(Boolean);
  const valid = canPlayCards(cards);
  if (!valid.ok) {
    game.message = valid.reason;
    render();
    return;
  }

  const removeSet = new Set(game.selectedCards);
  const myPlayer = getPlayerByName('あなた');
  myPlayer.hand = myPlayer.hand.filter((_, i) => !removeSet.has(i));
  game.selectedCards = [];

  placeCards(myPlayer, cards);
  game.message = `${myPlayer.name}：${cardsToText(cards)} を出しました`;
  processAfterAction(myPlayer);

  if (getActivePlayer().isCpu && !game.exchangePhase) processCpuTurns();
  render();
}

function handlePass(player) {
  const game = state.game;
  game.passCount += 1;
  if (player.isCpu) addCpuLog(`${player.name}：パスしました`);
  else game.message = 'あなた：パスしました';

  const alive = game.players.filter((p) => !p.finished).length;
  if (game.passCount >= alive - 1 && game.table.length) {
    const leader = game.tableOwner;
    clearTable(true);
    game.currentTurnIndex = TURN_ORDER.indexOf(leader);
    game.message = '場を流しました';
    return;
  }
  advanceTurn();
}

function passTurn() {
  if (!isPlayerTurn()) return;
  handlePass(getActivePlayer());
  if (getActivePlayer().isCpu && !state.game.exchangePhase) processCpuTurns();
  render();
}

function findCpuPlayableCards(player) {
  const game = state.game;
  const sorted = [...player.hand].sort((a, b) => compareCards(a, b, game.isRevolution));
  const needCount = game.table.length || 1;

  const groups = new Map();
  sorted.forEach((card) => {
    const key = card.rank;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(card);
  });

  const candidates = [];
  for (const arr of groups.values()) {
    if (arr.length >= needCount) candidates.push(arr.slice(0, needCount));
  }

  const valid = candidates.filter((cards) => canPlayCards(cards).ok);
  valid.sort((a, b) => compareCards(a[0], b[0], game.isRevolution));
  return valid[0] || [];
}

function processCpuTurns() {
  const game = state.game;
  while (getActivePlayer().isCpu && !game.exchangePhase && game.ranking.length < 4) {
    const cpu = getActivePlayer();
    const play = findCpuPlayableCards(cpu);

    if (!play.length) {
      handlePass(cpu);
      continue;
    }

    play.forEach((card) => {
      const idx = cpu.hand.findIndex((h) => h.code === card.code && h.suit === card.suit);
      if (idx >= 0) cpu.hand.splice(idx, 1);
    });

    placeCards(cpu, play);
    if (!play.some((c) => c.rank === '8')) {
      addCpuLog(`${cpu.name}：${cardsToText(play)} を出しました`);
    }

    processAfterAction(cpu);
  }

  if (isPlayerTurn()) {
    state.game.message = 'あなたのターンです。カードを選んでください。';
  } else if (!state.game.exchangePhase) {
    state.game.message = 'CPUのターンです';
  }
}

function toggleCardSelection(index) {
  const game = state.game;
  if (!isPlayerTurn() && !game.exchangePhase) return;

  const target = game.exchangePhase ? game.exchangeSelection : game.selectedCards;
  const pos = target.indexOf(index);
  if (pos >= 0) target.splice(pos, 1);
  else target.push(index);

  if (!game.exchangePhase) {
    game.message = target.length ? `${target.length}枚選択中` : 'カードを選んでください';
  }
  render();
}

function removeCards(player, cards) {
  cards.forEach((card) => {
    const idx = player.hand.findIndex((h) => h.code === card.code && h.suit === card.suit);
    if (idx >= 0) player.hand.splice(idx, 1);
  });
}

function runExchange() {
  const game = state.game;
  if (!game.exchangePhase || game.exchangeDone) return;

  const [firstName, secondName, thirdName, fourthName] = game.ranking;
  const first = getPlayerByName(firstName);
  const second = getPlayerByName(secondName);
  const third = getPlayerByName(thirdName);
  const fourth = getPlayerByName(fourthName);

  const pickWeak = (player, n) => [...player.hand].sort((a, b) => compareCards(a, b, false)).slice(0, n);
  const pickStrong = (player, n) => [...player.hand].sort((a, b) => compareCards(b, a, false)).slice(0, n);

  let giveFirst = [];
  let giveSecond = [];

  if (first.name === 'あなた') {
    giveFirst = game.exchangeSelection.map((i) => first.hand[i]).filter(Boolean);
    if (giveFirst.length !== 2) {
      game.message = '1位として2枚選択してください';
      render();
      return;
    }
  } else {
    giveFirst = pickWeak(first, 2);
  }

  if (second.name === 'あなた') {
    giveSecond = game.exchangeSelection.map((i) => second.hand[i]).filter(Boolean);
    if (giveSecond.length !== 1) {
      game.message = '2位として1枚選択してください';
      render();
      return;
    }
  } else {
    giveSecond = pickWeak(second, 1);
  }

  const giveFourth = pickStrong(fourth, 2);
  const giveThird = pickStrong(third, 1);

  removeCards(first, giveFirst);
  removeCards(fourth, giveFourth);
  first.hand.push(...giveFourth);
  fourth.hand.push(...giveFirst);

  removeCards(second, giveSecond);
  removeCards(third, giveThird);
  second.hand.push(...giveThird);
  third.hand.push(...giveSecond);

  game.pendingHandsForNextGame = game.players.map((p) => sortHand([...p.hand], false));
  game.exchangeDone = true;
  game.message = '交換完了';
  game.exchangeSelection = [];
  render();
}

function startNextGame() {
  const nextHands = state.game.pendingHandsForNextGame;
  state.game = createNewGameState(nextHands);
  render();
}

function resetGame() {
  state.game = createNewGameState();
  render();
}

const templates = {
  top: `<section class="screen"><h2>トップ画面</h2><h3>つなサポ大富豪</h3><p>ようこそ！大富豪の試作版です。</p><div class="actions-row top-links"><button onclick="go('login')">ログインへ</button><button onclick="go('rooms')">ルーム一覧へ</button><button onclick="go('game')">ゲームへ</button></div></section>`,
  login: `<section class="screen"><h2>ログイン画面</h2><p><span class="badge">現時点では未使用</span> 将来Googleログイン予定。</p><input placeholder="ニックネーム"/></section>`,
  rooms: `<section class="screen"><h2>ルーム一覧（モック）</h2><p>オンライン対戦は未実装です。</p><button onclick="go('game')">ゲーム開始</button></section>`,
};

function renderCard(card, isButton, index, selected) {
  const cls = `playing-card${isButton ? ' card-button' : ''}${selected ? ' selected' : ''}`;
  const colorClass = card.rank === 'JOKER' ? 'joker' : isRedSuit(card.suit) ? 'red' : 'black';
  const rankLabel = card.rank === 'JOKER' ? 'JOKER' : card.rank;
  const suitLabel = card.rank === 'JOKER' ? '🃏' : card.suit;
  const inner = `<span class="card-corner tl">${rankLabel}<small>${suitLabel}</small></span><span class="card-center">${rankLabel}<small>${suitLabel}</small></span><span class="card-corner br">${rankLabel}<small>${suitLabel}</small></span>`;
  if (isButton) return `<button class="${cls} ${colorClass}" onclick="toggleCard(${index})">${inner}</button>`;
  return `<div class="${cls} ${colorClass}">${inner}</div>`;
}

function gameTemplate() {
  const game = state.game;
  const isYourTurn = isPlayerTurn();

  const tableCards = game.table.length
    ? game.table.map((card) => renderCard(card, false)).join('')
    : '<p class="empty-note">まだカードは出ていません</p>';

  const handCards = handOfYou()
    .map((card, idx) => {
      const selected = game.exchangePhase ? game.exchangeSelection.includes(idx) : game.selectedCards.includes(idx);
      return renderCard(card, true, idx, selected);
    }).join('');

  const rankList = game.ranking.map((name, i) => `<li>${i + 1}位：${name}</li>`).join('');
  const cpuCounts = CPU_PLAYERS
    .map((name) => {
      const cpu = getPlayerByName(name);
      return `<li>${name}：残り${cpu.hand.length}枚${cpu.finished ? '（上がり）' : ''}</li>`;
    }).join('');

  const disableAction = (!isYourTurn || game.exchangePhase) ? 'disabled' : '';

  return `<section class="screen">
    <h2>ゲーム画面</h2>
    <p>現在のターン: <strong>${getActivePlayer().name}</strong></p>
    <p>現在の状態: <strong>${game.isRevolution ? '革命中' : '通常'}</strong></p>
    <p>縛り状態: <strong>${game.lockSuit || 'なし'}</strong></p>
    <p>最後にカードを出した人: <strong>${game.tableOwner}</strong></p>
    ${game.winnerBanner ? '<p class="winner-banner">あなたの上がりです！</p>' : ''}

    <div class="card"><h3>場に出ているカード</h3><div class="cards-row">${tableCards}</div></div>

    <div class="card"><h3>CPUの履歴</h3><ul>${game.cpuLogs.map((log) => `<li>${log}</li>`).join('') || '<li>まだ行動はありません</li>'}</ul><h4>CPU残り手札</h4><ul>${cpuCounts}</ul></div>

    <div class="card"><h3>順位状況</h3><ol>${rankList || '<li>まだ確定していません</li>'}</ol></div>

    ${game.exchangePhase ? `<div class="card"><h3>カード交換フェーズ</h3><p>1位↔4位は2枚、2位↔3位は1枚交換します。</p><p>${game.message}</p><div class="actions-row"><button onclick="runExchangePhase()" ${game.exchangeDone ? 'disabled' : ''}>交換を実行</button>${game.exchangeDone ? '<button onclick="nextGame()">次のゲーム開始</button>' : ''}</div></div>` : ''}

    <div class="card">
      <h3>あなたの手札</h3>
      <div class="cards-row hand-row">${handCards || '<p class="empty-note">手札がありません</p>'}</div>
      <div class="actions-row">
        <button onclick="playCards()" ${disableAction}>カードを出す</button>
        <button class="btn-alt" onclick="pass()" ${disableAction}>パス</button>
        <button class="btn-alt" onclick="clearField()">場を流す</button>
        <button onclick="dealNew()">新しく配る</button>
      </div>
      <p class="message-area">${isYourTurn ? game.message : 'CPUのターンです'}</p>
    </div>
  </section>`;
}

window.go = (route) => { state.route = route; render(); };
window.toggleCard = toggleCardSelection;
window.playCards = playSelectedCards;
window.pass = passTurn;
window.clearField = () => { clearTable(true); render(); };
window.dealNew = resetGame;
window.runExchangePhase = runExchange;
window.nextGame = startNextGame;

function render() {
  app.innerHTML = state.route === 'game' ? gameTemplate() : (templates[state.route] || templates.top);
}

render();
