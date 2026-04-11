document.addEventListener("DOMContentLoaded", async () => {

  // 🔹 Inicjalizacja auth i supabase
  initAuthUI();
  const supabase = window.supabaseClient;

  // 🔹 ID gracza z URL
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get("id");
  if (!playerId) return;

  // 🔹 Ustawienie daty w navbarze
  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  const navbarDateEl = document.getElementById("navbarDate");
  if (navbarDateEl) navbarDateEl.innerText = "📅 " + today;

  // 🔹 Pobranie danych gracza
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (!player) {
    const cardEl = document.getElementById("profileCard");
    if (cardEl) cardEl.innerHTML = "❌ Nie znaleziono gracza";
    return;
  }

  // 🔹 Obliczenie totalPoints
  const totalPoints = player.rating + (player.manual_points || 0);

  // 🔹 Średnia ocen gracza (ostatnie 30 dni)
  const { avg: avgRating, count: ratingCount } = await loadAverageRating(playerId);

  // 🔹 Głosy oddane na gracza
  const { data: votes } = await supabase
    .from("votes")
    .select("score")
    .eq("player_id", playerId);

  let votesAvg = 0;
  let votesCount = 0;
  if (votes && votes.length) {
    votesCount = votes.length;
    votesAvg = votes.reduce((acc, v) => acc + v.score, 0) / votesCount;
  }

  // 🔹 Historia głosów z datami
  const { data: votesHistory } = await supabase
    .from("votes")
    .select(`score, rounds (round_date)`)
    .eq("player_id", playerId);

  // 🔹 Punkty w ostatnich 30 dniach
  let last30 = 0;
  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);

  votesHistory?.forEach(v => {
    const d = new Date(v.rounds.round_date);
    if (d >= past30) last30 += v.score;
  });

  // 🔹 Oddane głosy (inne osoby vs self)
  const { data: givenVotes } = await supabase
    .from("votes")
    .select("score, player_id")
    .eq("voter_name", player.name);

  let givenAvg = 0, givenCount = 0;
  let selfAvg = 0, selfCount = 0;

  if (givenVotes && givenVotes.length) {
    const others = givenVotes.filter(v => v.player_id != playerId);
    const self = givenVotes.filter(v => v.player_id == playerId);

    givenCount = others.length;
    givenAvg = others.length ? others.reduce((a, b) => a + b.score, 0) / others.length : 0;

    selfCount = self.length;
    selfAvg = self.length ? self.reduce((a, b) => a + b.score, 0) / self.length : 0;
  }

  // 🔹 Dni aktywności
  const activeDays = new Set(votesHistory?.map(v => v.rounds.round_date)).size;

  // 🔹 Ranking średniej
  const { data: allVotes } = await supabase.from("votes").select("player_id, score");
  const avgMap = {};
  allVotes.forEach(v => {
    if (!avgMap[v.player_id]) avgMap[v.player_id] = { sum: 0, count: 0 };
    avgMap[v.player_id].sum += v.score;
    avgMap[v.player_id].count++;
  });

  async function loadAchievements(playerId) {
  const supabase = window.supabaseClient;

  const { data: achievements } = await supabase
    .from("achievements")
    .select("*")
    .eq("player_id", playerId)
    .order("obtained_at", { ascending: false });

  const listEl = document.getElementById("achievements-list");
  const countEl = document.getElementById("achievements-count");
  if (!listEl || !countEl) return;

  listEl.innerHTML = achievements.map(a => `
    <div class="achievement-badge ${a.rarity}" title="${a.description}">
      ${a.name}<br><small>${new Date(a.obtained_at).toLocaleDateString("pl-PL")}</small>
    </div>
  `).join("");

  countEl.innerText = `${achievements.length}/${achievements.length}`; // można dopracować jeśli lista wszystkich osiągnięć jest większa
}

  const averages = Object.entries(avgMap).map(([id, val]) => ({
    player_id: id,
    avg: val.sum / val.count
  }));
  averages.sort((a, b) => b.avg - a.avg);
  const avgRank = averages.findIndex(a => a.player_id == playerId) + 1;

  // 🔹 14 dni: top/low 3
  const past14 = new Date();
  past14.setDate(now.getDate() - 14);

  const { data: last14Votes } = await supabase
    .from("votes")
    .select(`score, voter_name, rounds (round_date)`)
    .eq("player_id", playerId);

  const filtered14 = (last14Votes || []).filter(v => new Date(v.rounds.round_date) >= past14);

  const top3 = [...filtered14].sort((a, b) => b.score - a.score).slice(0, 3);
  const low3 = [...filtered14].sort((a, b) => a.score - b.score).slice(0, 3);

  // 🔹 Render profilu
  const cardEl = document.getElementById("profileCard");
  if (!cardEl) return;

  cardEl.innerHTML = `
    <div class="profile-avatar-circle">
      ${player.avatar || "👤"}
    </div>
    <div class="profile-name">${player.name}</div>
    <div class="profile-points">
      Punkty: <b>${totalPoints.toFixed(3).replace(".", ",")}</b>
    </div>
    <div class="profile-highlight">
      📅 Przez ostatnie 30 dni zdobył <b>${last30.toFixed(1).replace(".", ",")}</b> punktów
    </div>
    <div class="profile-average">
      🗳 Średnia ocen: <span id="avg-rating">${avgRating}</span> <span class="divider">|</span> <span id="avg-count">${ratingCount}</span> ocen
    </div>
    <div class="profile-box">
      🗳 Oddane głosy średnia: <b>${givenAvg.toFixed(2).replace(".", ",")}</b>
      <span class="divider">|</span>
      ${givenCount} ocen
    </div>
    <div class="profile-box">
      🎯 Oddane głosy na siebie: <b>${selfAvg.toFixed(2).replace(".", ",")}</b>
      <span class="divider">|</span>
      ${selfCount} ocen
    </div>
    <div class="profile-box">
      📅 Dni aktywności: <b>${activeDays}</b>
    </div>
    <div class="profile-box">
      🏆 Ranking średniej: <b>#${avgRank}</b>
    </div>
    <div class="profile-section-title">
      📊 Najwyższe i najniższe oceny (14 dni)
    </div>
    <div class="votes-section">
      <div class="votes-column">
        <h3>🔥 Najwyższe</h3>
        ${top3.map(v => `
          <div class="vote-item">
            <div><b>${v.score.toFixed(1).replace(".", ",")}</b></div>
            <div class="vote-meta">${v.voter_name} • ${new Date(v.rounds.round_date).toLocaleDateString("pl-PL")}</div>
          </div>
        `).join("")}
      </div>
      <div class="votes-column">
        <h3>❄️ Najniższe</h3>
        ${low3.map(v => `
          <div class="vote-item">
            <div><b>${v.score.toFixed(1).replace(".", ",")}</b></div>
            <div class="vote-meta">${v.voter_name} • ${new Date(v.rounds.round_date).toLocaleDateString("pl-PL")}</div>
          </div>
        `).join("")}
      </div>
    </div>

    <div class="profile-section-title">
      <a href="achievements.html?id=${playerId}" class="achievements-btn">
        🏅 Osiągnięcia: <span id="achievements-count">0/0</span>
      </a>
    </div>
    <div id="achievements-list" class="achievements-list">
      <!-- Odznaki będą dodawane przez JS -->
    </div>
  `;

  // 🔹 Funkcja średniej ocen (ostatnie 30 dni)
  async function loadAverageRating(playerId) {
    const { data: votes } = await supabase
      .from("votes")
      .select("score, created_at")
      .eq("player_id", playerId)
      .gte("created_at", new Date(Date.now() - 30*24*60*60*1000).toISOString());

    if (!votes || votes.length === 0) return { avg: "0,00", count: 0 };

    const sum = votes.reduce((acc, v) => acc + v.score, 0);
    const avg = sum / votes.length;
    return { avg: avg.toFixed(2).replace(".", ","), count: votes.length };
  }

});
