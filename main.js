document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();

  const supabase = window.supabaseClient;

  const savedEmail = localStorage.getItem("savedEmail");
  if (savedEmail) {
    const emailInput = document.getElementById("email");
    if (emailInput) emailInput.value = savedEmail;
  }

  let players = [];
  let currentRoundId = null;
  let yesterdayRatings = {};
  let currentRole = "guest";
  let currentPlayer = null;

  const datePicker = document.getElementById('datePicker');
  const rankingTable = document.getElementById('rankingTable');
  const panelsDiv = document.getElementById('panels');
  const loginCard = document.getElementById('loginCard');
  const dateCard = document.getElementById("dateCard");

  /* ================= LOADER ================= */

  function showLoader() {
    const overlay = document.getElementById("globalLoader");
    const loader = overlay?.querySelector(".loader");

    loader?.classList.remove("success");
    overlay?.classList.remove("hidden");

    setTimeout(() => {
      overlay?.classList.add("active");
    }, 10);
  }

  function hideLoaderSuccess() {
    const overlay = document.getElementById("globalLoader");
    const loader = overlay?.querySelector(".loader");

    loader?.classList.add("success");

    setTimeout(() => {
      overlay?.classList.remove("active");
      overlay?.classList.add("hidden");
      loader?.classList.remove("success");
    }, 1200);
  }

  window.showLoader = showLoader;
  window.hideLoaderSuccess = hideLoaderSuccess;

  /* ================= INIT DATE ================= */

  datePicker.value = new Date().toISOString().split('T')[0];

  datePicker.addEventListener('change', () => {
    updateDateDisplay();
    init();
  });

  document.getElementById('addPlayerBtn')?.addEventListener('click', addPlayer);

  /* ================= ROUND ================= */

  async function ensureRound(date) {

    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('round_date', date)
      .maybeSingle();

    if (!data) {
      const { data: newRound } = await supabase
        .from('rounds')
        .insert({ round_date: date })
        .select()
        .single();

      currentRoundId = newRound.id;
    } else {
      currentRoundId = data.id;
    }
  }

  /* ================= PLAYERS ================= */

  async function loadPlayers() {

    const { data: playersData } = await supabase
      .from("players")
      .select("*");

    if (!playersData) return;

    players = playersData.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      rating: p.rating ?? 1000,
      manual_points: p.manual_points || 0,
      role: p.role || "user",
      email: p.email
    }));

    players.sort((a, b) => b.rating - a.rating);

    renderRanking();
    renderPanels();
    loadPenaltyPlayers();
  }

  async function loadYesterdayRatings() {

  const selectedDate = new Date(datePicker.value);

  const yesterday = new Date(selectedDate);
  yesterday.setDate(selectedDate.getDate() - 1);

  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const { data: round } = await supabase
    .from("rounds")
    .select("id")
    .eq("round_date", yesterdayStr)
    .maybeSingle();

  yesterdayRatings = {};

  if (!round) return;

  const { data: history, error } = await supabase
    .from("ranking_history")
    .select("player_id, points")
    .eq("round_id", round.id);

    if (error) {
      console.error("HISTORY ERROR:", error);
    }

  history?.forEach(row => {
  yesterdayRatings[String(row.player_id)] = row.points;
});
}

  /* ================= UI ================= */

  function updateDateDisplay(){

    const el = document.getElementById("currentDateDisplay");
    if (!el) return;

    const date = new Date(datePicker.value);

    el.innerHTML =
      "📅 Runda: <b>" +
      date.toLocaleDateString("pl-PL", {
        weekday:"long",
        year:"numeric",
        month:"long",
        day:"numeric"
      }) +
      "</b>";
  }

  /* ================= RANKING ================= */

  function renderRanking() {

  if (!rankingTable) return;

  rankingTable.innerHTML = `
    <tr>
      <th>#</th>
      <th>Gracz</th>
      <th>Punkty</th>
      <th>Zmiana</th>
    </tr>
  `;

  players.forEach((p, i) => {

    const prev = yesterdayRatings[p.id] ?? p.rating;
    const diff = Math.round(p.rating - prev);

    let diffDisplay = "-";
    let diffClass = "";

    if (diff > 0) {
      diffDisplay = `↑ ${diff}`;
      diffClass = "positive";
    }

    if (diff < 0) {
      diffDisplay = `↓ ${Math.abs(diff)}`;
      diffClass = "negative";
    }

    let medal = "";

    if (i === 0) medal = "🥇";
    if (i === 1) medal = "🥈";
    if (i === 2) medal = "🥉";

    rankingTable.innerHTML += `
      <tr class="${
        i === 0 ? "gold" :
        i === 1 ? "silver" :
        i === 2 ? "bronze" : ""
      }">
        <td>${medal || i + 1}</td>
        <td onclick="goToProfile('${p.id}')">
          <span class="avatar">${p.avatar || "👤"}</span>
          ${p.name}
        </td>
        <td>${Math.round(p.rating)}</td>
        <td class="${diffClass}">
          ${diffDisplay}
        </td>
      </tr>
    `;
  });
}

window.goToProfile = function(id) {
  window.location.href = `profile.html?id=${id}`;
};
    
  /* ================= ROLE FIX ================= */

  function getCurrentPlayer(userEmail) {
    return players.find(p => p.email === userEmail) || null;
  }

  /* ================= PANELS ================= */

  async function renderPanels() {

    if (!panelsDiv) return;

    panelsDiv.innerHTML = '';

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email;

    const player = getCurrentPlayer(userEmail);

    currentPlayer = player;
    currentRole = player?.role || "guest";

    /* ================= GUEST ================= */
    if (!currentPlayer) {
      panelsDiv.innerHTML = `
        <div class="card center">
          <h3>Zaloguj się, aby głosować</h3>
        </div>
      `;
      return;
    }
  
    const role = currentPlayer.role || "user";

    const selectedDate = new Date(datePicker.value);
    const today = new Date();

    selectedDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const threeDaysBefore = new Date(selectedDate);
    threeDaysBefore.setDate(selectedDate.getDate() - 3);

    let votingAllowed = role === "admin"
      ? true
      : !(today > selectedDate || today < threeDaysBefore);

    const voters = role === "admin"
      ? players
      : [currentPlayer];

    voters.forEach((voter) => {

      const card = document.createElement('div');
      card.className = 'card center';

      let html = `<h3>${voter.name} ocenia:</h3>`;
      html += `<div class="vote-row-container">`;

      players.forEach((player) => {

        html += `
          <div class="vote-row">
            <div>
              <span class="avatar">${player.avatar || "👤"}</span>
              ${player.name}
            </div>
            <input 
              type="number"
              min="1"
              max="10"
              step="0.1"
              ${!votingAllowed ? "disabled" : ""}
              id="${voter.id}_${player.id}"
            />
          </div>
        `;
      });

      html += `</div>`;

      if (role === "admin") {
        html += `
          <div class="panel-buttons">
            <button onclick="saveVotes('${voter.name}')">Zapisz oceny</button>
            <button class="absence-btn" onclick="markAbsent('${voter.id}')">Nieobecność</button>
          </div>
        `;
      }

      card.innerHTML = html;
      panelsDiv.appendChild(card);
    });
  }

  /* ================= MVP ================= */

  
  async function calculateAndSaveMVP() {

  let bestPlayer = null;
  let bestGain = -999999;

  players.forEach(player => {
    const oldRating = yesterdayRatings[player.id] ?? player.rating;
    const gain = Math.round(player.rating - oldRating);

    if (gain > bestGain) {
      bestGain = gain;
      bestPlayer = player;
    }
  });

  if (!bestPlayer) return;

  // usuń stare MVP tej rundy (żeby nie duplikować)
  await supabase
    .from("mvp_history")
    .delete()
    .eq("round_id", currentRoundId);

  // zapisz nowe MVP
  await supabase
    .from("mvp_history")
    .insert({
      round_id: currentRoundId,
      player_id: bestPlayer.id,
      points_gain: bestGain
    });
}

  /* ================= SAVE ================= */

  window.saveVotes = async function (voterName) {

    showLoader();

    try {

      const voter = players.find(p => p.name === voterName);
      if (!voter) return;

      for (let player of players) {

        const input = document.getElementById(`${voter.id}_${player.id}`);
        if (!input || !input.value) continue;

        const val = parseFloat(input.value.replace(",", "."));
        if (val < 1 || val > 10) continue;

        await supabase.from('votes').upsert({
          round_id: currentRoundId,
          player_id: player.id,
          voter_name: voterName,
          score: val
        });
      }

      await supabase.rpc("calculate_all");
      await supabase.rpc("update_players_rating");

      await loadPlayers();
      await calculateAndSaveMVP();

      hideLoaderSuccess();

    } catch (e) {
      console.error(e);
      alert("Błąd zapisu");
    }
  };

  window.markAbsent = async function (id) {
    await supabase.from('absences').insert({
      player_id: id,
      round_id: currentRoundId
    });

    await loadPlayers();
  };

  function loadPenaltyPlayers() {

  const select = document.getElementById("penaltyPlayer");
  if (!select || !players) return;

  select.innerHTML = "";

  players.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

  async function loadBoiskoCounter(){

  const today = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("field_meetups")
    .select("status, extra_players")
    .eq("date", today);

  const playersCount = data?.filter(x => x.status === "yes").length || 0;

  const extra = (data || []).reduce(
    (sum, x) => sum + (x.extra_players || 0),
    0
  );

  const total = playersCount + extra;

  const el = document.getElementById("boiskoCounter");
  if (el) el.innerText = `Dziś będzie ${total} osób`;
}

  /* ================= ADMIN ================= */

  async function addPlayer() {

    const name = document.getElementById('newPlayerName').value;
    if (!name) return;
    if (currentRole !== "admin") return;

    await supabase.from('players').insert({
      name,
      rating: 1000,
      role: "player"
    });

    document.getElementById('newPlayerName').value = '';
    await loadPlayers();
  }

  async function resolveUserRole() {

  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    currentRole = "guest";
    currentPlayer = null;
    return;
  }

  const { data: player } = await supabase
    .from("players")
    .select("*")
    .eq("email", auth.user.email)
    .maybeSingle();

  currentPlayer = player;

  if (!player) {
    currentRole = "guest";
  } else {
    currentRole = player.role || "player";
  }
}

  function applyPermissions() {

  const panels = document.getElementById("panels");
  const dateCard = document.getElementById("dateCard");

  const addPlayerBox = document.getElementById("newPlayerName")?.parentElement;
  const penaltyBox = document.getElementById("adminPenaltyBox");
  const mvpBox = document.getElementById("mvpBox");
  const boiskoBox = document.getElementById("boiskoBox");

  // RESET
  if (panels) panels.style.display = "block";
  if (dateCard) dateCard.style.display = "block";
  if (addPlayerBox) addPlayerBox.style.display = "block";
  if (penaltyBox) penaltyBox.style.display = "block";
  if (mvpBox) mvpBox.style.display = "block";
  if (boiskoBox) boiskoBox.style.display = "block";

  // 🔥 GUEST
  if (currentRole === "guest") {
    if (panels) panels.style.display = "none";
    if (dateCard) dateCard.style.display = "none";
    if (addPlayerBox) addPlayerBox.style.display = "none";
    if (penaltyBox) penaltyBox.style.display = "none";
    if (mvpBox) mvpBox.style.display = "none";
    return;
  }

  // 🔥 PLAYER
  if (currentRole === "player") {
    if (addPlayerBox) addPlayerBox.style.display = "none";
    if (penaltyBox) penaltyBox.style.display = "none";
    if (mvpBox) mvpBox.style.display = "none";
    return;
  }

  // ADMIN → wszystko widzi
}

  function loadPenaltyPlayers() {

  const select = document.getElementById("penaltyPlayer");
  if (!select || !players) return;

  select.innerHTML = "";

  players.forEach(p => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

  /* ================= Ostatni MVP ================= */

  async function loadLastMVP() {
  const box = document.getElementById("lastMVP");
  if (!box) return;

  const { data, error } = await supabase
    .from("mvp_history")
    .select(`
      gain,
      player_id,
      round_id,
      players(name, avatar),
      rounds(round_date)
    `)
    .gt("gain", 0)
    .order("round_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    box.innerHTML = "🏆 Ostatni MVP: brak";
    return;
  }

  box.innerHTML = `
    🏆 Ostatni MVP:
    ${data.players?.avatar || "👤"}
    ${data.players?.name || "Nieznany"}
    (+${Math.round(data.gain)})
  `;
}
  
  /* ================= INIT ================= */

async function init() {

  await resolveUserRole();

  const panels = document.getElementById("panels");
  const loginBox = document.getElementById("loginBox");

  if (currentRole === "guest") {
    panels.style.display = "none";
    loginBox.style.display = "flex";
  } else {
    panels.style.display = "block";
    loginBox.style.display = "none";
  }

  await ensureRound(datePicker.value);
  await loadYesterdayRatings();
  await loadPlayers();
  await loadLastMVP();

  applyPermissions();
  updateDateDisplay();
  loadBoiskoCounter();

}
  init();

});
