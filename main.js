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

  const datePicker = document.getElementById('datePicker');
  const rankingTable = document.getElementById('rankingTable');
  const panelsDiv = document.getElementById('panels');

  /* ================= LOADER ================= */

  window.showLoader = function () {
    const overlay = document.getElementById("globalLoader");
    const loader = overlay?.querySelector(".loader");
    if (!overlay || !loader) return;

    loader.classList.remove("success");
    overlay.classList.remove("hidden");

    setTimeout(() => overlay.classList.add("active"), 10);
  };

  window.hideLoaderSuccess = function () {
    const overlay = document.getElementById("globalLoader");
    const loader = overlay?.querySelector(".loader");
    if (!overlay || !loader) return;

    loader.classList.add("success");

    setTimeout(() => {
      overlay.classList.remove("active");
      overlay.classList.add("hidden");
      loader.classList.remove("success");
    }, 1200);
  };

  /* ================= DATA ================= */

  datePicker.value = new Date().toISOString().split('T')[0];

  datePicker.addEventListener('change', () => {
    updateDateDisplay();
    init();
  });

  document.getElementById('addPlayerBtn')?.addEventListener('click', addPlayer);

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
      manual_points: p.manual_points || 0
    }));

    players.sort((a, b) => b.rating - a.rating);

    renderRanking();
    renderPanels();
    loadPenaltyPlayers();
  }

  async function loadYesterdayRatings() {
    const { data } = await supabase
      .from("players")
      .select("id, rating");

    yesterdayRatings = {};
    data?.forEach(p => {
      yesterdayRatings[p.id] = p.rating;
    });
  }

  function updateDateDisplay(){
    const dateDisplay = document.getElementById("currentDateDisplay");
    if (!dateDisplay) return;

    const date = new Date(datePicker.value);

    const formatted = date.toLocaleDateString("pl-PL", {
      weekday:"long",
      year:"numeric",
      month:"long",
      day:"numeric"
    });

    dateDisplay.innerHTML = "📅 Runda: <b>" + formatted + "</b>";
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

      let medal = '';
      if (i === 0) medal = '🥇';
      if (i === 1) medal = '🥈';
      if (i === 2) medal = '🥉';

      rankingTable.innerHTML += `
        <tr class="${i === 0 ? 'leader gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}">
          <td>${medal || i + 1}</td>
          <td onclick="goToProfile('${p.id}')">
            <span class="avatar">${p.avatar || "👤"}</span>
            ${p.name}
          </td>
          <td>${Math.round(p.rating)}</td>
          <td class="${diff >= 0 ? 'positive' : 'negative'}">
            ${diff >= 0 ? '+' : ''}${diff}
          </td>
        </tr>
      `;
    });
  }

  window.goToProfile = function(playerId){
    window.location.href = `profile.html?id=${playerId}`;
  };

  /* ================= PANELS ================= */

  async function renderPanels() {

    if (!panelsDiv) return;

    panelsDiv.innerHTML = '';

    const { data: userData } = await supabase.auth.getUser();
    const userEmail = userData?.user?.email;

    if (!userEmail) return;

    const { data: currentPlayer } = await supabase
      .from("players")
      .select("*")
      .eq("email", userEmail)
      .maybeSingle();

    if (!currentPlayer) return; // 🔥 FIX crasha

    const selectedDate = new Date(datePicker.value);
    const today = new Date();

    selectedDate.setHours(0,0,0,0);
    today.setHours(0,0,0,0);

    const threeDaysBefore = new Date(selectedDate);
    threeDaysBefore.setDate(selectedDate.getDate() - 3);

    let votingAllowed = true;

    if (currentPlayer.role !== "admin") {
      if (today > selectedDate || today < threeDaysBefore) {
        votingAllowed = false;
      }
    }

    const voters = currentPlayer.role === "admin"
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
              step="0.1"
              min="1"
              max="10"
              ${!votingAllowed ? "disabled" : ""}
              id="${voter.id}_${player.id}"
            />
          </div>
        `;
      });

      html += `</div>`;

      html += `
        <div class="panel-buttons">
          <button ${!votingAllowed ? "disabled" : ""} onclick="saveVotes('${voter.name}')">
            Zapisz oceny
          </button>
          <button class="absence-btn" onclick="markAbsent('${voter.id}')">
            Nieobecność
          </button>
        </div>
      `;

      card.innerHTML = html;
      panelsDiv.appendChild(card);
    });
  }

  /* ================= VOTES ================= */

  window.saveVotes = async function (voterName) {

    showLoader();

    try {
      const voter = players.find(p => p.name === voterName);
      if (!voter) return;

      for (let player of players) {

        const input = document.getElementById(`${voter.id}_${player.id}`);
        if (!input || !input.value) continue;

        await supabase.from('votes').upsert({
          round_id: currentRoundId,
          player_id: player.id,
          voter_name: voterName,
          score: parseFloat(input.value.replace(",", "."))
        });
      }

      await supabase.rpc("calculate_all");
      await supabase.rpc("update_players_rating");

      await loadPlayers();

      hideLoaderSuccess();

    } catch (e) {
      console.error(e);
      alert("Błąd zapisu");
    }
  };

  window.markAbsent = async function (playerId) {
    await supabase.from('absences').insert({
      player_id: playerId,
      round_id: currentRoundId,
    });

    await loadPlayers();
  };

  /* ================= ADMIN ================= */

  async function addPlayer() {

    const name = document.getElementById('newPlayerName').value;
    if (!name) return;

    await supabase.from('players').insert({
      name,
      rating: 1000
    });

    document.getElementById('newPlayerName').value = '';
    await loadPlayers();
  }

  function loadPenaltyPlayers(){

    const select = document.getElementById("penaltyPlayer");
    if (!select) return;

    select.innerHTML = "";

    players.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      select.appendChild(opt);
    });
  }

  window.givePenalty = async function(){
    const playerId = document.getElementById("penaltyPlayer").value;
    const points = parseFloat(document.getElementById("penaltyPoints").value);
    if (!points) return;

    const player = players.find(p => p.id == playerId);

    await supabase
      .from("players")
      .update({
        manual_points:(player.manual_points||0)-points
      })
      .eq("id",playerId);

    await loadPlayers();
  };

  window.giveBonus = async function(){
    const playerId = document.getElementById("penaltyPlayer").value;
    const points = parseFloat(document.getElementById("bonusPoints").value);
    if (!points) return;

    const player = players.find(p => p.id == playerId);

    await supabase
      .from("players")
      .update({
        manual_points:(player.manual_points||0)+points
      })
      .eq("id",playerId);

    await loadPlayers();
  };

  /* ================= BOISKO ================= */

  async function loadBoiskoCounter(){

    const today=new Date().toISOString().split("T")[0];

    const {data}=await supabase
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

  /* ================= INIT ================= */

  async function init() {

    const { data } = await supabase.auth.getUser();

    const panels = document.getElementById("panels");
    const loginBox = document.getElementById("loginBox");

    if (!data.user) {
      if (panels) panels.style.display = "none";
      if (loginBox) loginBox.style.display = "flex";
      return;
    }

    if (panels) panels.style.display = "block";
    if (loginBox) loginBox.style.display = "none";

    await ensureRound(datePicker.value);
    await loadYesterdayRatings();
    await loadPlayers();
    loadBoiskoCounter();
  }

  init();

});
