const app = document.getElementById('app');

const cpuPlayers = ['CPU 1', 'CPU 2', 'CPU 3'];
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
  if (includeJoker) {
    deck.push({ rank: 'JOKER', suit: '🃏', code: 'JOKER' });
  }
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

function createNewGameState() {
  const hand = shuffle(createDeck(true)).slice(0, 13);
  return {
    hand,
    table: [],
    selectedCards: [],
    message: 'カードを選んでください',
    currentTurnIndex: 0,
    isRevolution: false,
    players: [
      { name: 'あなた', handCount: hand.length, isCpu: false },
      ...cpuPlayers.map((name) => ({ name, handCount: 13, isCpu: true })),
    ],
  };
}

const navigate = (route) => {
  state.route = route;
  render();
};

document.querySelectorAll('[data-route]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦';
}

function getCardStrength(card, isRevolution) {
  if (card.rank === 'JOKER') return 999;
  const base = RANKS.indexOf(card.rank);
  return isRevolution ? RANKS.length - 1 - base : base;
}

function isValidSet(cards) {
  if (cards.length <= 1) return true;
  return cards.every((card) => card.rank === cards[0].rank);
}

function canPlay(selectedCards) {
  const table = state.game.table;
  if (!isValidSet(selectedCards)) {
    return { ok: false, reason: '同じ数字のカードを選んでください' };
  }

  if (table.length === 0) return { ok: true };

  if (selectedCards.length !== table.length) {
    return { ok: false, reason: 'そのカードは出せません' };
  }

  if (table.length >= 2) {
    const sameRank = selectedCards.every((card) => card.rank === table[0].rank);
    if (!sameRank) return { ok: false, reason: 'そのカードは出せません' };
    return { ok: true };
  }

  const selectedStrength = getCardStrength(selectedCards[0], state.game.isRevolution);
  const tableStrength = getCardStrength(table[0], state.game.isRevolution);
  if (selectedStrength <= tableStrength) {
    return { ok: false, reason: 'そのカードは出せません' };
  }

  return { ok: true };
}

function toggleCardSelection(index) {
  const selectedIndex = state.game.selectedCards.indexOf(index);
  if (selectedIndex >= 0) {
    state.game.selectedCards.splice(selectedIndex, 1);
  } else {
    state.game.selectedCards.push(index);
  }

  state.game.message =
    state.game.selectedCards.length === 0
      ? 'カードを選んでください'
      : `${state.game.selectedCards.length}枚選択中`;

  render();
}

function clearTable(withMessage = true) {
  state.game.table = [];
  if (withMessage) {
    state.game.message = '場を流しました';
  }
}

function playSelectedCards() {
  if (state.game.selectedCards.length === 0) {
    state.game.message = 'カードを選んでください';
    render();
    return;
  }

  const selectedCards = state.game.selectedCards
    .map((index) => state.game.hand[index])
    .filter(Boolean);

  const validity = canPlay(selectedCards);
  if (!validity.ok) {
    state.game.message = validity.reason;
    render();
    return;
  }

  const selectedSet = new Set(state.game.selectedCards);
  state.game.hand = state.game.hand.filter((_, idx) => !selectedSet.has(idx));
  state.game.players[0].handCount = state.game.hand.length;
  state.game.selectedCards = [];
  state.game.table = selectedCards;

  const hasEight = selectedCards.some((card) => card.rank === '8');
  const isFourOfKind = selectedCards.length === 4 && selectedCards.every((card) => card.rank === selectedCards[0].rank);

  if (isFourOfKind) {
    state.game.isRevolution = !state.game.isRevolution;
    state.game.message = state.game.isRevolution ? '革命！' : '革命返し！';
  } else {
    state.game.message = `${selectedCards.map((card) => card.code).join(' ')} を出しました`;
  }

  if (hasEight) {
    state.game.message = `${state.game.message} / 8切り！`;
    clearTable(false);
  }

  render();
}

function passTurn() {
  state.game.message = 'パスしました';
  render();
}

function resetGame() {
  state.game = createNewGameState();
  render();
}

const templates = {
  top: `...`,
  login: `...`,
  rooms: `...`,
};

templates.top = `
<section class="screen">
  <h2>トップ画面</h2>
  <h3>つなサポ大富豪</h3>
  <p>ようこそ！このアプリは、つなサポサイトから利用する<strong>大富豪</strong>の動作確認版です。</p>
  <div class="grid">
    <div class="card"><h3>できること</h3><ul><li>4画面の移動確認</li><li>カード選択、出す、パス、場流し、新しく配る</li><li>1人用ルール判定（8切り・革命）</li></ul></div>
    <div class="card"><h3>遊び方</h3><ol><li>ゲーム画面へ移動</li><li>手札をクリック</li><li>「カードを出す」や「パス」を操作</li></ol></div>
  </div>
  <div class="actions-row top-links"><button onclick="go('login')">ログインへ</button><button onclick="go('rooms')">ルーム一覧へ</button><button onclick="go('game')">ゲームへ</button></div>
</section>`;

templates.login = `
<section class="screen"><h2>ログイン画面</h2><p><span class="badge">現時点では未使用</span> まずは1人用の動作確認版として利用してください。</p><label>ニックネーム</label><input placeholder="たとえば：つなサポ太郎" /><label>メールアドレス（モック）</label><input placeholder="example@school.jp" /><div style="display:flex;gap:10px;flex-wrap:wrap;"><button onclick="go('rooms')">次へ（モック）</button></div></section>`;

templates.rooms = `
<section class="screen"><h2>ルーム一覧（モック）</h2><p>オンライン対戦は未実装です。今は1人用の動作確認版です。</p><div class="grid rooms"><article class="card"><h3>🧪 動作確認ルーム</h3><p>参加者: 1人（あなた）</p><button onclick="go('game')">入室</button></article></div></section>`;

function renderCard(card, isButton, index, selected) {
  const cls = `playing-card${isButton ? ' card-button' : ''}${selected ? ' selected' : ''}`;
  const colorClass = card.rank === 'JOKER' ? 'joker' : isRedSuit(card.suit) ? 'red' : 'black';
  const rankLabel = card.rank === 'JOKER' ? 'JOKER' : card.rank;
  const suitLabel = card.rank === 'JOKER' ? '🃏' : card.suit;
  const inner = `
  <span class="card-corner tl">${rankLabel}<small>${suitLabel}</small></span>
  <span class="card-center">${suitLabel}</span>
  <span class="card-corner br">${rankLabel}<small>${suitLabel}</small></span>`;
  if (isButton) {
    return `<button class="${cls} ${colorClass}" onclick="toggleCard(${index})">${inner}</button>`;
  }
  return `<div class="${cls} ${colorClass}">${inner}</div>`;
}

function gameTemplate() {
  const tableCards = state.game.table.length
    ? state.game.table.map((card) => renderCard(card, false)).join('')
    : '<p class="empty-note">まだカードは出ていません</p>';

  const handCards = state.game.hand
    .map((card, idx) => renderCard(card, true, idx, state.game.selectedCards.includes(idx)))
    .join('');

  return `
    <section class="screen">
      <h2>ゲーム画面（1人用動作確認）</h2>
      <p>現在の状態: <strong>${state.game.isRevolution ? '革命中' : '通常'}</strong></p>
      <div class="card"><h3>場に出ているカード</h3><div class="cards-row">${tableCards}</div></div>
      <div class="card" style="margin-top:12px;"><h3>あなたの手札</h3><div class="cards-row hand-row">${handCards || '<p class="empty-note">手札がありません</p>'}</div>
      <div class="actions-row"><button onclick="playCards()">カードを出す</button><button class="btn-alt" onclick="pass()">パス</button><button class="btn-alt" onclick="clearField()">場を流す</button><button onclick="dealNew()">新しく配る</button></div>
      <p class="message-area">${state.game.message}</p></div>
    </section>
  `;
}

window.go = navigate;
window.toggleCard = toggleCardSelection;
window.playCards = playSelectedCards;
window.pass = passTurn;
window.dealNew = resetGame;
window.clearField = () => {
  clearTable(true);
  render();
};

function render() {
  if (state.route === 'game') app.innerHTML = gameTemplate();
  else app.innerHTML = templates[state.route] || templates.top;
}

render();
