var supabase = window.supabaseClient;

document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI();
  loadDays();
});

const daysContainer = document.getElementById("daysContainer");
let currentStatus = {};

function getNextDays(){
  const days=[];
  for(let i=0;i<3;i++){
    const d=new Date();
    d.setDate(d.getDate()+i);
    days.push(d.toISOString().split("T")[0]);
  }
  return days;
}

async function loadDays(){
  daysContainer.innerHTML="";
  const days=getNextDays();
  for(const day of days){
    await renderDay(day);
  }
}

async function renderDay(date){

  const { data: userData } = await supabase.auth.getUser();
  const logged = userData.user;

  const { data } = await supabase
    .from("field_meetups")
    .select("*")
    .eq("date",date);

  const card=document.createElement("div");
  card.className="card";

  const dateFormatted=new Date(date).toLocaleDateString("pl-PL",{
    day:"numeric",
    month:"long"
  });

  let html=`<h2>📅 ${dateFormatted}</h2>`;

  if(!data || data.length===0){
    html+=`<p>Pusto</p>`;
  }else{

    const yes=data.filter(x=>x.status==="yes");
    const no=data.filter(x=>x.status==="no");

    html+=`<h3>Będą</h3>`;

    yes.forEach(p=>{
      html+=`<div><span class="avatar">${p.avatar || "👤"}</span>${p.player_name} ${formatTime(p)}</div>`;
      if(p.note){
        html+=`<div class="note">${p.note}</div>`;
      }
    });

    // ✅ FIX SUMA EXTRA
    const extra = (data || []).reduce(
      (sum, x) => sum + (x.extra_players || 0),
      0
    );

    html += `<div class="extra-info">👥 +${extra} dodatkowych osób</div>`;

    html+=`<h3>Nie będą</h3>`;

    no.forEach(p=>{
      html+=`<div><span class="avatar">${p.avatar || "👤"}</span>${p.player_name}</div>`;
      if(p.note){
        html+=`<div class="note">${p.note}</div>`;
      }
    });
  }

  if(logged){
    html+=`
    <hr>

    <div class="meet-row">
      Od <input type="time" id="from_${date}">
      Do <input type="time" id="to_${date}">
      <label class="sunsetBox">
        <input type="checkbox" id="sunset_${date}">
        do zachodu
      </label>
    </div>

    <div class="extra-players-box">
      👥 Dodatkowe osoby:
      <select id="extra_${date}">
        ${[...Array(16).keys()].map(i => `<option value="${i}">${i}</option>`).join("")}
      </select>
    </div>

    <input id="note_${date}" maxlength="100" placeholder="opis (opcjonalnie)">

    <div class="status-row">
      <button class="statusBtn" onclick="setStatus('${date}','yes',this)">Będę</button>
      <button class="statusBtn" onclick="setStatus('${date}','no',this)">Nie będę</button>
    </div>

    <button class="saveBtn" onclick="save('${date}')">Zapisz</button>
    `;
  }

  card.innerHTML=html;
  daysContainer.appendChild(card);
}

function formatTime(p){
  let from=p.time_from||"-:-";
  let to=p.time_to||"-:-";
  if(to==="sunset") to="zachodu słońca";
  return `od ${from} do ${to}`;
}

function setStatus(date,status,btn){
  currentStatus[date]=status;
  const buttons=btn.parentElement.querySelectorAll(".statusBtn");
  buttons.forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
}

async function save(date){

  // ✅ blokada
  if (!currentStatus[date]) {
    alert("Wybierz czy będziesz");
    return;
  }

  const { data: userData } = await supabase.auth.getUser();
  if(!userData.user) return;

  const email=userData.user.email;

  const {data:player}=await supabase
    .from("players")
    .select("*")
    .eq("email",email)
    .single();

  const from=document.getElementById("from_"+date).value;
  let to=document.getElementById("to_"+date).value;

  if(document.getElementById("sunset_"+date).checked){
    to="sunset";
  }

  const note=document.getElementById("note_"+date).value;
  const extraPlayers = document.getElementById(`extra_${date}`).value;

  await supabase
    .from("field_meetups")
    .upsert({
      player_id: player.id,
      player_name: player.name,
      date: date,
      status: currentStatus[date],
      time_from: from,
      time_to: to,
      note: note,
      extra_players: extraPlayers
    });

  loadDays();
}
