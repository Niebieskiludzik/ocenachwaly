document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();
  
  const supabase = window.supabaseClient;

  if (!supabase) {
    console.error("❌ Supabase nie istnieje");
    return;
  }

  const container = document.getElementById("ranking");

  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

const navbarDate = document.getElementById("navbarDate");
if (navbarDate) {
  navbarDate.innerText = "📅 " + today;
}

  try {

    // 📥 gracze
    const { data: players, error: playersError } = await supabase
      .from("players")
      .select("id, name");

    if (playersError) throw playersError;

    // 📥 wszystkie głosy
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("player_id, score, round_id");

    if (votesError) throw votesError;

    if (!players || players.length === 0) {
      container.innerHTML = "Brak graczy";
      return;
    }

    // 📊 grupowanie: player + round
    const map = {};

    votes.forEach(v => {
      const key = `${v.player_id}_${v.round_id}`;

      if (!map[key]) {
        map[key] = [];
      }

      map[key].push(v.score);
    });

    // 📊 suma punktów rankingowych
    const playerPoints = {};

    players.forEach(p => {
      playerPoints[p.id] = 1000; // start
    });

    for (const key in map) {

      const [playerId] = key.split("_");
      const scores = map[key];

      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

      const change = (avg - 6) * 40;

      playerPoints[playerId] += change;
    }

    // 📊 budowa rankingu
    const ranking = players.map(p => ({
      name: p.name,
      points: playerPoints[p.id] || 1000
    }));

    ranking.sort((a, b) => b.points - a.points);

    // 🎨 render
    container.innerHTML = ranking.map((p, i) => {

      let extraClass = "";
      if (i === 0) extraClass = "top1";
      if (i === 1) extraClass = "top2";
      if (i === 2) extraClass = "top3";

      return `
        <div class="rank-item ${extraClass}">
          <div class="rank-left">
            <div class="rank-position">#${i + 1}</div>
            <div class="rank-name">${p.name}</div>
          </div>
          <div class="rank-points">
            ${p.points.toFixed(0)}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
    container.innerHTML = "❌ Błąd ładowania";
  }

});
