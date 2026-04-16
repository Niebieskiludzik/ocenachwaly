document.addEventListener("DOMContentLoaded", async () => {

  initAuthUI();

  const supabase = window.supabaseClient;
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

    const { data: players, error } = await supabase
      .from("players")
      .select("*")
      .order("rating", { ascending: false });

    if (error) throw error;

    if (!players || players.length === 0) {
      container.innerHTML = "Brak danych";
      return;
    }

    container.innerHTML = players.map((p, i) => {

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
            ${(p.rating + (p.manual_points || 0)).toFixed(0)}
          </div>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error(err);
    container.innerHTML = "❌ Błąd ładowania";
  }

});
