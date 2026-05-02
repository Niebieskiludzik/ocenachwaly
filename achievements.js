document.addEventListener("DOMContentLoaded", async () => {

  // 🔥 poczekaj aż auth się załaduje
  setTimeout(() => {
    initAuthUI();
  }, 100);

  const supabase = window.supabaseClient;

  const params = new URLSearchParams(window.location.search);
  const playerId = params.get("id");
  if (!playerId) return;

  // 📅 data
  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  document.getElementById("navbarDate").innerText = "📅 " + today;

  try {

    // 🧍‍♂️ gracz
    const { data: player } = await supabase
      .from("players")
      .select("*")
      .eq("id", playerId)
      .single();

    if (!player) return;

    document.getElementById("playerHeader").innerHTML = `
      <div class="profile-avatar-circle">
        ${player.avatar || "👤"}
      </div>
      <div class="profile-name">
        ${player.name}
      </div>
    `;
/////
    // 🏅 osiągnięcia
    const { data: achievements, error } = await supabase
  .from("achievements")
  .select("*")
  .eq("player_id", playerId);

const rarityOrder = {
  gold: 5,
  purple: 4,
  blue: 3,
  green: 2,
  gray: 1
};

achievements.sort((a, b) => {
  const rarityDiff =
    (rarityOrder[b.rarity] || 0) -
    (rarityOrder[a.rarity] || 0);

  if (rarityDiff !== 0) return rarityDiff;

  return new Date(b.obtained_at) - new Date(a.obtained_at);
});

    if (error) {
      console.error(error);
      return;
    }

    const grid = document.getElementById("achievementsGrid");

    if (!achievements || achievements.length === 0) {
      grid.innerHTML = `<div class="empty">Brak osiągnięć</div>`;
      return;
    }

    const mvpCount = achievements.filter(a => a.code?.startsWith("mvp_")).length;
    const header = document.getElementById("playerHeader");
      if (mvpCount > 0) {
         header.innerHTML += `
          <div class="profile-box">
            🏆 MVP: <b>${mvpCount}</b> razy
          </div>
        `;
      }

    async function checkTop1(playerId) {

  const { data: rounds } = await supabase
    .from("rounds")
    .select("id");

  let daysTop1 = 0;

  for (const r of rounds) {

    const { data: votes } = await supabase
      .from("votes")
      .select("player_id, score")
      .eq("round_id", r.id);

    const map = {};

    votes.forEach(v => {
      if (!map[v.player_id]) map[v.player_id] = [];
      map[v.player_id].push(v.score);
    });

    const ranking = Object.entries(map).map(([id, scores]) => ({
      id,
      avg: scores.reduce((a,b)=>a+b,0)/scores.length
    }));

    ranking.sort((a,b)=>b.avg-a.avg);

    if (ranking[0]?.id == playerId) daysTop1++;
  }

  if (daysTop1 >= 10)
    addAchievement(playerId, "top1_10", "Dominacja", "10 dni na 1 miejscu", "purple");

}
///
    grid.innerHTML = achievements.map(a => `
      <div class="achievement-card ${a.rarity}">
        <div class="ach-icon">🏅</div>
        <div class="ach-title">${a.name}</div>
        <div class="ach-desc">${a.description || ""}</div>
        <div class="ach-date">
          ${new Date(a.obtained_at).toLocaleDateString("pl-PL")}
        </div>
      </div>
    `).join("");

  } catch (err) {
    console.error(err);
  }

});
