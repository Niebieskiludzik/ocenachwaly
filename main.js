document.addEventListener("DOMContentLoaded", async () => {

const supabase = window.supabase.createClient(
  'https://wzanqzcjrpbhocrfcciy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind6YW5xemNqcnBiaG9jcmZjY2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0MzQ4MjUsImV4cCI6MjA4NzAxMDgyNX0.VNer3odvLPJzBbecICFZFw86SXvvCbEZDQNVciEm97k'
);

let players = [];
let currentRoundId = null;
let yesterdayRatings = {};

const datePicker = document.getElementById('datePicker');
const rankingTable = document.getElementById('rankingTable');
const panelsDiv = document.getElementById('panels');
const loginCard = document.getElementById('loginCard');
const dateCard = document.getElementById("dateCard");

datePicker.value = new Date().toISOString().split('T')[0];

datePicker.addEventListener('change', init);
document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);

async function ensureRound(date) {

  const { data } = await supabase
    .from('rounds')
    .select('*')
    .eq('round_date', date)
    .single();

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

  const { data } = await supabase
    .from('players')
    .select('*')
    .order('rating', { ascending: false });

  players = data || [];

  renderRanking();
  renderPanels();
}

async function loadYesterdayRatings() {

  const { data } = await supabase
    .from('players')
    .select('id,rating');

  yesterdayRatings = {};

  data?.forEach(p => {
    yesterdayRatings[p.id] = p.rating;
  });
}

function renderRanking() {

  rankingTable.innerHTML = `
    <tr>
      <th>#</th>
      <th>Gracz</th>
      <th>Punkty</th>
      <th>Zmiana</th>
    </tr>
  `;

  players.forEach((p, i) => {

    let medal = '';
    if (i === 0) medal = '🥇';
    if (i === 1) medal = '🥈';
    if (i === 2) medal = '🥉';

    const diff = Math.round(p.rating - (yesterdayRatings[p.id] || p.rating));

    rankingTable.innerHTML += `
      <tr class="${
          i === 0 ? 'leader gold' :
          i === 1 ? 'silver' :
          i === 2 ? 'bronze' : ''
      }">
        <td>${medal || i + 1}</td>
        <td>${p.name}</td>
        <td>${Math.round(p.rating)}</td>
        <td class="${diff >= 0 ? 'positive' : 'negative'}">
          ${diff >= 0 ? '+' : ''}${diff}
        </td>
      </tr>
    `;
  });

}

async function renderPanels() {

  panelsDiv.innerHTML = '';

  const { data: userData } = await supabase.auth.getUser();
  const userEmail = userData.user?.email;

  const currentPlayer = players.find(p => p.email === userEmail);

  if (!currentPlayer) return;

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

  let voters = [];

  if (currentPlayer.role === "admin") {
    voters = players;
  } else {
    voters = [currentPlayer];
  }

  voters.forEach((voter) => {

    const card = document.createElement('div');
    card.className = 'card center';

    let html = `<h3>${voter.name} ocenia:</h3>`;
    html += `<div class="vote-row-container">`;

    players.forEach((player) => {

      html += `
        <div class="vote-row">
          <div>${player.name}</div>
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
        <button class="absence-btn"
        onclick="markAbsent('${voter.id}')">
        Nieobecność
        </button>
      </div>
    `;

    if (!votingAllowed) {

      html += `
        <p style="margin-top:20px;opacity:0.7;">
        Głosowanie dostępne tylko od 3 dni przed datą rundy do dnia rundy.
        </p>
      `;

    }

    card.innerHTML = html;
    panelsDiv.appendChild(card);

  });

}

window.markAbsent = async function (playerId) {

  await supabase.from('absences').insert({
    player_id: playerId,
    round_id: currentRoundId,
  });

  const player = players.find((p) => p.id === playerId);

  await supabase
    .from('players')
    .update({ rating: player.rating })
    .eq('id', playerId);

  alert('Dodano nieobecność');

  await loadPlayers();
};

window.saveVotes = async function (voterName) {

  for (let player of players) {

    const voter = players.find(p => p.name === voterName);

    const input = document.getElementById(
      voter.id + '_' + player.id
    );

    if (!input.value) continue;

    await supabase.from('votes').upsert({
      round_id: currentRoundId,
      player_id: player.id,
      voter_name: voterName,
      score: parseFloat(input.value.replace(",", "."))
    });

  }

  await supabase.rpc('calculate_round', {
    p_round_id: currentRoundId,
  });

  await loadPlayers();

};

window.login = async function () {

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { error } = await supabase.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    alert("Błąd logowania");
    return;
  }

  alert("Zalogowano!");

  init();
};

window.logout = async function () {

  await supabase.auth.signOut();

  alert("Wylogowano");

  location.reload();

};

async function addPlayer() {

  const name = document.getElementById('newPlayerName').value;

  if (!name) return;

  await supabase.from('players').insert({ name });

  document.getElementById('newPlayerName').value = '';

  await loadPlayers();
}

async function init() {

  console.log('INIT START');

  const { data } = await supabase.auth.getUser();

  const addPlayerSection = document.getElementById("newPlayerName").parentElement;
  const logoutBox = document.getElementById("logoutBox");

  if (!data.user) {

    panelsDiv.style.display = "none";
    loginCard.style.display = "block";

    addPlayerSection.style.display = "none";
    logoutBox.style.display = "none";

    dateCard.style.display = "none";
    

  } else {

    panelsDiv.style.display = "block";
    loginCard.style.display = "none";

    logoutBox.style.display = "block";

    dateCard.style.display = "block";

    datePicker.disabled = false;

    const { data: player } = await supabase
      .from('players')
      .select('*')
      .eq('email', data.user.email)
      .single();

    if (player && player.role === "admin") {
      addPlayerSection.style.display = "block";
    } else {
      addPlayerSection.style.display = "none";
    }

  }

  await ensureRound(datePicker.value);
  await loadYesterdayRatings();
  await loadPlayers();

}

await init();

});
