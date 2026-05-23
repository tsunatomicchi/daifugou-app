const app = document.getElementById('app');

const initialHand = ['3♠', '7♦', '9♠', 'J♣', 'Q♥', '2♣'];

const state = {
  route: 'top',
  game: createNewGameState(),
};

function createNewGameState() {
  return {
    hand: [...initialHand],
    table: [],
    selectedCards: [],
    message: 'カードを選んでください',
  };
}

const navigate = (route) => {
  state.route = route;
  render();
};

document.querySelectorAll('[data-route]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

function toggleCardSelection(card) {
  const index = state.game.selectedCards.indexOf(card);
  if (index >= 0) {
    state.game.selectedCards.splice(index, 1);
  } else {
    state.game.selectedCards.push(card);
  }

  if (state.game.selectedCards.length === 0) {
    state.game.message = 'カードを選んでください';
  } else {
    state.game.message = `${state.game.selectedCards.length}枚選択中`;
  }

  render();
}

function playSelectedCards() {
  if (state.game.selectedCards.length === 0) {
    state.game.message = 'カードを選んでください';
    render();
    return;
  }

  const selected = new Set(state.game.selectedCards);
  const played = [];

  state.game.hand = state.game.hand.filter((card) => {
    if (selected.has(card)) {
      played.push(card);
      selected.delete(card);
      return false;
    }
    return true;
  });

  state.game.table = played;
  state.game.selectedCards = [];
  state.game.message = `${played.join(' ')} を出しました`;
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
  top: `
    <section class="screen">
      <h2>トップ画面</h2>
      <p>ようこそ！このアプリは、つなサポサイトから利用する<strong>大富豪</strong>の動作確認版です。</p>
      <div class="grid">
        <div class="card">
          <h3>🎯 できること（今）</h3>
          <ul>
            <li>画面デザインの確認</li>
            <li>画面遷移の確認</li>
            <li>1人用の手札操作確認</li>
          </ul>
        </div>
        <div class="card">
          <h3>🚀 次のステップ</h3>
          <p>ゲーム画面で「カード選択」「カードを出す」「パス」「新しく配る」を試せます。</p>
          <button class="btn" onclick="go('game')">ゲームへ</button>
        </div>
      </div>
    </section>
  `,
  login: `
    <section class="screen">
      <h2>ログイン画面</h2>
      <p><span class="badge">現時点では未使用</span> まずは1人用の動作確認版として利用してください。</p>
      <label>ニックネーム</label>
      <input placeholder="たとえば：つなサポ太郎" />
      <label>メールアドレス（モック）</label>
      <input placeholder="example@school.jp" />
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="go('rooms')">次へ（モック）</button>
      </div>
    </section>
  `,
  rooms: `
    <section class="screen">
      <h2>ルーム一覧（モック）</h2>
      <p>オンライン対戦は未実装です。ゲーム画面で1人動作確認を行ってください。</p>
      <div class="grid rooms">
        <article class="card">
          <h3>🧪 動作確認ルーム</h3>
          <p>参加者: 1/1</p>
          <button onclick="go('game')">入室</button>
        </article>
      </div>
    </section>
  `,
};

function gameTemplate() {
  const tableCards = state.game.table.length
    ? state.game.table
        .map((card) => `<div class="playing-card">${card}</div>`)
        .join('')
    : '<p class="empty-note">まだカードは出ていません</p>';

  const handCards = state.game.hand
    .map((card, idx) => {
      const selected = state.game.selectedCards.includes(card) ? ' selected' : '';
      return `<button class="playing-card card-button${selected}" onclick="toggleCard(${idx})">${card}</button>`;
    })
    .join('');

  return `
    <section class="screen">
      <h2>ゲーム画面（1人用確認版）</h2>
      <p>現在のターン: あなた</p>
      <div class="card">
        <h3>場に出ているカード</h3>
        <div class="cards-row">${tableCards}</div>
      </div>
      <div class="card" style="margin-top:12px;">
        <h3>あなたの手札</h3>
        <div class="cards-row">${handCards || '<p class="empty-note">手札がありません</p>'}</div>
        <div class="actions-row">
          <button onclick="playCards()">カードを出す</button>
          <button class="btn-alt" onclick="pass()">パス</button>
          <button onclick="dealNew()">新しく配る</button>
        </div>
        <p class="message-area">${state.game.message}</p>
      </div>
    </section>
  `;
}

window.go = navigate;
window.toggleCard = (index) => {
  const card = state.game.hand[index];
  if (!card) return;
  toggleCardSelection(card);
};
window.playCards = playSelectedCards;
window.pass = passTurn;
window.dealNew = resetGame;

function render() {
  if (state.route === 'game') {
    app.innerHTML = gameTemplate();
    return;
  }
  app.innerHTML = templates[state.route] || templates.top;
}

render();
