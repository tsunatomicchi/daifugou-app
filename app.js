const app = document.getElementById('app');

const state = {
  route: 'top',
};

const navigate = (route) => {
  state.route = route;
  render();
};

document.querySelectorAll('[data-route]').forEach((btn) => {
  btn.addEventListener('click', () => navigate(btn.dataset.route));
});

const templates = {
  top: `
    <section class="screen">
      <h2>トップ画面</h2>
      <p>ようこそ！このアプリは、つなサポサイトから利用する<strong>オンライン大富豪</strong>のモック版です。</p>
      <div class="grid">
        <div class="card">
          <h3>🎯 できること（今）</h3>
          <ul>
            <li>画面デザインの確認</li>
            <li>画面遷移の確認</li>
            <li>将来機能の配置イメージ確認</li>
          </ul>
        </div>
        <div class="card">
          <h3>🚀 次のステップ</h3>
          <p>ログイン画面へ進み、ルーム一覧やゲーム画面の見た目をチェックしよう！</p>
          <button class="btn" onclick="go('login')">ログインへ</button>
        </div>
      </div>
    </section>
  `,
  login: `
    <section class="screen">
      <h2>ログイン画面</h2>
      <p><span class="badge">将来対応予定</span> Googleアカウント認証 / 許可アカウント制限</p>
      <label>ニックネーム</label>
      <input placeholder="たとえば：つなサポ太郎" />
      <label>メールアドレス（モック）</label>
      <input placeholder="example@school.jp" />
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        <button onclick="go('rooms')">ログイン（モック）</button>
        <button class="btn-alt" onclick="alert('将来: Google OAuth ボタンに置き換え')">Googleでログイン（予定）</button>
      </div>
    </section>
  `,
  rooms: `
    <section class="screen">
      <h2>ルーム一覧</h2>
      <p>入りたい部屋を選ぼう！</p>
      <div class="grid rooms">
        <article class="card">
          <h3>🌟 わいわい初級ルーム</h3>
          <p>参加者: 3/4</p>
          <button onclick="go('game')">入室</button>
        </article>
        <article class="card">
          <h3>🔥 チャレンジルーム</h3>
          <p>参加者: 2/4</p>
          <button onclick="go('game')">入室</button>
        </article>
        <article class="card">
          <h3>🎓 学校イベント部屋</h3>
          <p>参加者: 4/4（満員）</p>
          <button disabled>満員</button>
        </article>
      </div>
    </section>
  `,
  game: `
    <section class="screen">
      <h2>ゲーム画面（モック）</h2>
      <p>現在のターン: あなた</p>
      <div class="card">
        <h3>場に出ているカード</h3>
        <div class="cards-row">
          <div class="playing-card">9♣</div>
          <div class="playing-card">9♥</div>
        </div>
      </div>
      <div class="card" style="margin-top:12px;">
        <h3>あなたの手札</h3>
        <div class="cards-row">
          <div class="playing-card">3♠</div><div class="playing-card">7♦</div><div class="playing-card">9♠</div>
          <div class="playing-card">J♣</div><div class="playing-card">Q♥</div><div class="playing-card">2♣</div>
        </div>
        <button>カードを出す（モック）</button>
        <button class="btn-alt">パス</button>
      </div>
    </section>
  `,
};

window.go = navigate;

function render() {
  app.innerHTML = templates[state.route] || templates.top;
}

render();
