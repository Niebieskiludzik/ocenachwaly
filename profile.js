document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();

  const supabase = window.supabaseClient;

  // 📌 pobierz ID z URL
  const params = new URLSearchParams(window.location.search);
  const playerId = params.get("id");

  if (!playerId) return;

  // 📅 navbar data (jak w main.js)
  const today = new Date().toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  document.getElementById("navbarDate").innerText = "📅 " + today;

  // 📥 pobierz gracza
  const { data: player, error } = await supabase
    .from("players")
    .select("*")
    .eq("id", playerId)
    .single();

  if (error || !player) {
    document.getElementById("profileCard").innerHTML = "❌ Nie znaleziono gracza";
    return;
  }

  const totalPoints = (player.rating + (player.manual_points || 0));

  // 🎨 render
  const { data: votes } = await supabase
  .from("votes")
  .select("score")
  .eq("player_id", playerId);

// 📊 statystyki
let avg = 0;
let count = 0;
let max = 0;

if (votes && votes.length > 0) {
  count = votes.length;

  const sum = votes.reduce((a, b) => a + b.score, 0);
  avg = sum / count;

  max = Math.max(...votes.map(v => v.score));
}

if (count === 0) {
  avg = 0;
  max = 0;
}

const { data: votesHistory, error: votesError } = await supabase
  .from("votes")
  .select("score, created_at")
  .eq("player_id", playerId)
  .order("created_at", { ascending: true });

console.log("VOTES:", votesHistory);
console.log("ERROR:", votesError);

let last30days = 0;

if (votesHistory) {
  const now = new Date();
  const pastDate = new Date();
  pastDate.setDate(now.getDate() - 30);

  last30days = votesHistory
    .filter(v => new Date(v.created_at) >= pastDate)
    .reduce((sum, v) => sum + v.score, 0);
}

const manualPoints = player.manual_points || 0;

const manualClass = manualPoints < 0 ? "minus" : "";

const diff = totalPoints - last30days;
  
const diffClass = last30days >= 0 ? "plus" : "minus";
  
document.getElementById("profileCard").innerHTML = `
  
  <div class="profile-avatar-circle">
    ${player.avatar || "👤"}
  </div>

  <h1 class="profile-name">${player.name}</h1>

  <div class="profile-points">
    Punkty: <b>${totalPoints.toFixed(3).replace(".", ",")}</b>
  </div>

  <div class="profile-history">
    📅 Przez ostatnie 30 dni zdobył
    <b>${last30days.toFixed(1).replace(".", ",")}</b>
    punktów.
  </div>
  
  <div class="profile-stats">
    ⭐ Średnia: ${avg.toFixed(2).replace(".", ",")}
    <span class="divider">|</span>
    ${count} ocen
  </div>

  <div class="profile-max">
    🔥 Najwyższa ocena: ${max.toFixed(1).replace(".", ",")}
  </div>

  <div class="profile-manual ${manualClass}">
    ⚖️ Kary i bonusy suma:
    <b>${manualPoints.toFixed(3).replace(".", ",")}</b>
  </div>
  
`;
});
