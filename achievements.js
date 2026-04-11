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

    // 🏅 osiągnięcia
    const { data: achievements, error } = await supabase
      .from("achievements")
      .select("*")
      .eq("player_id", playerId)
      .order("obtained_at", { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    const grid = document.getElementById("achievementsGrid");

    if (!achievements || achievements.length === 0) {
      grid.innerHTML = `<div class="empty">Brak osiągnięć</div>`;
      return;
    }

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
