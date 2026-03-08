if (!window.supabaseInitialized) {
  const supabase = window.supabase.createClient(
    'https://wzanqzcjrpbhocrfcciy.supabase.co',
    'TWÓJ_ANON_KEY'
  );

  window.supabaseClient = supabase;
  window.supabaseInitialized = true;

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
    const { data } = await window.supabaseClient
      .from('rounds')
      .select('*')
      .eq('round_date', date)
      .single();

    if (!data) {
      const { data: newRound } = await window.supabaseClient
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
    const { data } = await window.supabaseClient
      .from('players')
      .select('*')
      .order('rating', { ascending: false });

    players = data || [];
    renderRanking();
    renderPanels();
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

      const diff = 0;

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
          Nieobecność (-20)
        </button>
      `;

      card.innerHTML = html;
      panelsDiv.appendChild(card);
    });
  }

  window.markAbsent = async function (playerId) {
    await window.supabaseClient.from('absences').insert({
      player_id: playerId,
      round_id: currentRoundId,
    });

    const player = players.find((p) => p.id === playerId);

    await window.supabaseClient
      .from('players')
      .update({ rating: player.rating - 20 })
      .eq('id', playerId);

    alert('Dodano nieobecność -20');
    await loadPlayers();
  };

  window.saveVotes = async function (voterName) {
    for (let player of players) {
      const input = document.getElementById(
        players.find((p) => p.name === voterName).id + '_' + player.id
      );
      if (!input.value) continue;

      await window.supabaseClient.from('votes').upsert({
        round_id: currentRoundId,
        player_id: player.id,
        voter_name: voterName,
        score: Number(input.value),
      });
    }

    await window.supabaseClient.rpc('calculate_round', {
      p_round_id: currentRoundId,
    });

    await loadPlayers();
  };

  async function addPlayer() {
    const name = document.getElementById('newPlayerName').value;
    if (!name) return;

    await window.supabaseClient.from('players').insert({ name });

    document.getElementById('newPlayerName').value = '';
    await loadPlayers();
  }

  window.init = async function () {
    console.log('INIT START');

    yesterdayRatings = {};

    await ensureRound(datePicker.value);
    console.log('Round OK:', currentRoundId);

    await loadYesterdayRatings();
    console.log('Yesterday loaded');

    await loadPlayers();
    console.log('Players loaded:', players);
  };
}
