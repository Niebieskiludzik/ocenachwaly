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
      <tr class="${i === 0 ? 'leader' : ''}">
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

function renderPanels() {

  panelsDiv.innerHTML = '';

  players.forEach((voter) => {

    const card = document.createElement('div');
    card.className = 'card center';

    let html = `<h3>${voter.name} ocenia:</h3>`;

    players.forEach((player) => {

      html += `
        <div class="vote-row">
          <div>${player.name}</div>
          <input type="number" min="1" max="10"
          id="${voter.id}_${player.id}" />
        </div>
      `;

    });

    html += `
      <button onclick="saveVotes('${voter.name}')">Zapisz oceny</button>
      <button class="absence-btn"
      onclick="markAbsent('${voter.id}')">
      Nieobecność
      </button>
    `;

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
    .update({ rating: player.rating - 0 })
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
      score: Number(input.value),
    });

  }

  await supabase.rpc('calculate_round', {
    p_round_id: currentRoundId,
  });

  await loadPlayers();

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

  await ensureRound(datePicker.value);

  await loadYesterdayRatings();

  await loadPlayers();

}

await init();

});
