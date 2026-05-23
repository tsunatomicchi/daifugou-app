const app = document.getElementById('app');

const initialHand = ['3♠', '7♦', '9♠', 'J♣', 'Q♥', '2♣'];
const cpuPlayers = ['CPU 1', 'CPU 2', 'CPU 3'];
const turnOrder = ['あなた', ...cpuPlayers];

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
    currentTurnIndex: 0,
    players: [
      { name: 'あなた', handCount: initialHand.length, isCpu: false },
      ...cpuPlayers.map((name) => ({
        name,
        handCount: 6,
        isCpu: true,
      })),
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

function nextTurn() {
  state.game.currentTurnIndex = (state.game.currentTurnIndex + 1) % turnOrder.length;
}

function runCpuTurnsUntilPlayer() {
  const logs = [];
  let safety = 0;

  while (state.game.currentTurnIndex !== 0 && safety < 20) {
    const cpu = state.game.players[state.game.currentTurnIndex];
    if (!cpu || !cpu.isCpu) break;

    if (cpu.handCount <= 0 || Math.random() < 0.35) {
      logs.push(`${cpu.name} はパス`);
    } else {
      cpu.handCount -= 1;
      const cpuCard = `CPU札${Math.floor(Math.random() * 13) + 1}`;
      state.game.table = [cpuCard];
      logs.push(`${cpu.name} がカードを出しました`);
    }

    nextTurn();
    safety += 1;
  }

  return logs;
}

function playSelectedCards() {
  if (state.game.currentTurnIndex !== 0) {
    state.game.message = 'あなたのターンまでお待ちください';
    render();
    return;
  }

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

  state.game.players[0].handCount = state.game.hand.length;
  state.game.table = played;
  state.game.selectedCards = [];

  nextTurn();
  const cpuLogs = runCpuTurnsUntilPlayer();
  const cpuSummary = cpuLogs.length ? ` / ${cpuLogs.join(' / ')}` : '';
  state.game.message = `${played.join(' ')} を出しました${cpuSummary}`;
  render();
}

function passTurn() {
  if (state.game.currentTurnIndex !== 0) {
    state.game.message = 'あなたのターンまでお待ちください';
    render();
    return;
  }

  nextTurn();
  const cpuLogs = runCpuTurnsUntilPlayer();
  const cpuSummary = cpuLogs.length ? ` / ${cpuLogs.join(' / ')}` : '';
  state.game.message = `あなたはパスしました${cpuSummary}`;
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
            <li>4人対戦風（あなた+CPU3人）の手札操作確認</li>
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
      <p>オンライン対戦は未実装です。ゲーム画面で4人対戦風の動作確認を行ってください。</p>
      <div class="grid rooms">
        <article class="card">
          <h3>🧪 動作確認ルーム</h3>
          <p>参加者: 4/4（あなた + CPU3人）</p>
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

  const players = state.game.players
    .map((player, idx) => {
      const active = idx === state.game.currentTurnIndex ? ' active' : '';
      return `<div class="player-chip${active}">${player.name}<span>手札 ${player.handCount}枚</span></div>`;
    })
    .join('');

  return `
    <section class="screen">
      <h2>ゲーム画面（4人対戦風）</h2>
      <p>現在のターン: <strong>${turnOrder[state.game.currentTurnIndex]}</strong></p>
      <div class="card">
        <h3>プレイヤー状況</h3>
        <div class="players-row">${players}</div>
      </div>
      <div class="card" style="margin-top:12px;">
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
