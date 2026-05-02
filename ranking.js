document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();

  const supabase = window.supabaseClient;

  const monthPicker = document.getElementById("monthPicker");
  const rankingList = document.getElementById("rankingList");

  // 📅 navbar data
  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  document.getElementById("navbarDate").innerText = "📅 " + today;

  // 📅 domyślny miesiąc
  const now = new Date();
  monthPicker.value = now.toISOString().slice(0, 7);

  monthPicker.addEventListener("change", loadRanking);

  await loadRanking();

  function calculateDailyPoints(avg) {
    return (avg - 6) * 74.5;
  }

  async function loadRanking() {

    rankingList.innerHTML = "Ładowanie...";

    const [year, month] = monthPicker.value.split("-").map(Number);

    const { data: votes, error } = await supabase
      .from("votes")
      .select(`
        score,
        player_id,
        rounds (
          round_date
        )
      `);

    if (error) {
      console.error(error);
      rankingList.innerHTML = "❌ Błąd";
      return;
    }

    const map = {};

    votes.forEach(v => {
      const date = new Date(v.rounds.round_date);

      if (
        date.getFullYear() === year &&
        date.getMonth() === (month - 1)
      ) {
        const dayKey = date.toISOString().split("T")[0];
        const key = v.player_id + "_" + dayKey;

        if (!map[key]) {
          map[key] = {
            player_id: v.player_id,
            scores: []
          };
        }

        map[key].scores.push(v.score);
      }
    });

    const playerPoints = {};

    Object.values(map).forEach(entry => {
      const avg =
        entry.scores.reduce((a, b) => a + b, 0) /
        entry.scores.length;

      const pts = calculateDailyPoints(avg);

      if (!playerPoints[entry.player_id]) {
        playerPoints[entry.player_id] = 1000;
      }

      playerPoints[entry.player_id] += pts;
    });

    const { data: players } = await supabase
      .from("players")
      .select("id, name");

    const playerMap = {};
    players.forEach(p => {
      playerMap[p.id] = p.name;
    });

    const ranking = Object.entries(playerPoints)
      .map(([player_id, points]) => ({
        player_id,
        points
      }))
      .sort((a, b) => b.points - a.points);

    if (ranking.length === 0) {
      rankingList.innerHTML = `<div style="text-align:center;font-size:24px;margin-top:30px;">Brak danych</div>`;
      return;
    }

    const maxPoints = ranking[0]?.points || 1000;

rankingList.innerHTML = ranking.map((p, i) => {
  let medal = `${i + 1}`;

  if (i === 0) medal = "🥇";
  if (i === 1) medal = "🥈";
  if (i === 2) medal = "🥉";

  const width = Math.max(
    8,
    (p.points / maxPoints) * 100
  );

  return `
    <div class="monthly-row" onclick="goToProfile('${p.player_id}')">

      <div class="monthly-top">
        <div class="monthly-left">
          <span class="monthly-rank">${medal}</span>
          <span class="monthly-name">
            ${playerMap[p.player_id] || "?"}
          </span>
        </div>

        <div class="monthly-points">
          ${p.points.toFixed(1)} pkt
        </div>
      </div>

      <div class="monthly-bar-wrap">
        <div
          class="monthly-bar"
          style="width:${width}%"
        ></div>
      </div>

    </div>
  `;
}).join("");
  }

});

function goToProfile(id) {
  window.location.href = `profile.html?id=${id}`;
}
