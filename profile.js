document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();
  const supabase = window.supabaseClient;

  // 📌 ID z URL
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get("id");
  if (!playerId) return;

  // 📅 data w navbarze
  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  document.getElementById("navbarDate").innerText = "📅 " + today;

  // 📥 gracz
  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (!player) {
    document.getElementById("profileCard").innerHTML = "❌ Nie znaleziono gracza";
    return;
  }

  const totalPoints = player.rating + (player.manual_points || 0);

  // 📊 głosy NA gracza
  const { data: votes } = await supabase
    .from("votes")
    .select("score")
    .eq("player_id", playerId);

  let avg = 0;
  let count = 0;

  if (votes && votes.length > 0) {
    count = votes.length;
    avg = votes.reduce((a, b) => a + b.score, 0) / count;
  }

  // 📅 historia z datami
  const { data: votesHistory } = await supabase
    .from("votes")
    .select(`score, rounds (round_date)`)
    .eq("player_id", playerId);

  // 📅 ostatnie 30 dni
  let last30 = 0;
  const now = new Date();
  const past30 = new Date();
  past30.setDate(now.getDate() - 30);

  votesHistory?.forEach(v => {
    const d = new Date(v.rounds.round_date);
    if (d >= past30) last30 += v.score;
  });

  // 🗳 oddane głosy
  const { data: givenVotes } = await supabase
    .from("votes")
    .select("score, player_id")
    .eq("voter_name", player.name);

  let givenAvg = 0;
  let givenCount = 0;

  let selfAvg = 0;
  let selfCount = 0;

  if (givenVotes && givenVotes.length > 0) {
    const others = givenVotes.filter(v => v.player_id != playerId);
    const self = givenVotes.filter(v => v.player_id == playerId);

    givenCount = others.length;
    givenAvg = others.length
      ? others.reduce((a, b) => a + b.score, 0) / others.length
      : 0;

    selfCount = self.length;
    selfAvg = self.length
      ? self.reduce((a, b) => a + b.score, 0) / self.length
      : 0;
  }

  // 📅 dni aktywności
  const activeDays = new Set(
    votesHistory?.map(v => v.rounds.round_date)
  ).size;

  // 🏆 ranking średniej
  const { data: allVotes } = await supabase
    .from("votes")
    .select("player_id, score");

  const avgMap = {};

  allVotes.forEach(v => {
    if (!avgMap[v.player_id]) {
      avgMap[v.player_id] = { sum: 0, count: 0 };
    }
    avgMap[v.player_id].sum += v.score;
    avgMap[v.player_id].count++;
  });

  const averages = Object.entries(avgMap).map(([id, val]) => ({
    player_id: id,
    avg: val.sum / val.count
  }));

  averages.sort((a, b) => b.avg - a.avg);

  const avgRank = averages.findIndex(a => a.player_id == playerId) + 1;

  // 📊 14 dni
  const past14 = new Date();
  past14.setDate(now.getDate() - 14);

  const { data: last14Votes } = await supabase
  .from("votes")
  .select(`
    score,
    voter_name,
    rounds (round_date)
  `)
  .eq("player_id", playerId);

const filtered14 = (last14Votes || []).filter(v =>
  new Date(v.rounds.round_date) >= past14
);

const top3 = [...filtered14]
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

const low3 = [...filtered14]
  .sort((a, b) => a.score - b.score)
  .slice(0, 3);
  
  // 🎨 RENDER
  document.getElementById("profileCard").innerHTML = `
    
    <div class="profile-avatar-circle">
      ${player.avatar || "👤"}
    </div>

    <div class="profile-name">${player.name}</div>

    <div class="profile-points">
      Punkty: <b>${totalPoints.toFixed(3).replace(".", ",")}</b>
    </div>

    <div class="profile-highlight">
      📅 Przez ostatnie 30 dni zdobył 
      <b>${last30.toFixed(1).replace(".", ",")}</b> punktów
    </div>

    <div class="profile-box">
      🗳 Oddane głosy średnia: 
      <b>${givenAvg.toFixed(2).replace(".", ",")}</b>
      <span class="divider">|</span>
      ${givenCount} ocen
    </div>

    <div class="profile-box">
      🎯 Oddane głosy na siebie:
      <b>${selfAvg.toFixed(2).replace(".", ",")}</b>
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
            <div class="vote-meta">
              ${v.voter_name} • ${new Date(v.rounds.round_date).toLocaleDateString("pl-PL")}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="votes-column">
        <h3>❄️ Najniższe</h3>
        ${low3.map(v => `
          <div class="vote-item">
            <div><b>${v.score.toFixed(1).replace(".", ",")}</b></div>
            <div class="vote-meta">
              ${v.voter_name} • ${new Date(v.rounds.round_date).toLocaleDateString("pl-PL")}
            </div>
          </div>
        `).join("")}
      </div>

    </div>
  `;
});
