async function init() {
  const msg = document.getElementById("meldung");
  if (!configOk()) {
    showMessage(msg, "Die Webseite ist vorbereitet. Es fehlt nur noch der Supabase Publishable Key.", "error");
    return;
  }
  try {
    const client = getSupabase();
    const settings = await loadSettings(client);
    document.getElementById("turnierTitel").textContent = settings.turniername;
    document.getElementById("datumHinweis").textContent =
      `Turnierbeginn an Fronleichnam: ${formatDate(corpusChristi(settings.turnierjahr))}`;

    const { data, error } = await client
      .from("oeffentliche_meldeliste")
      .select("*")
      .order("erstellt_am", { ascending: true });
    if (error) throw error;

    renderList(settings, data || []);
    hideMessage(msg);
  } catch (err) {
    showMessage(msg, "Meldeliste konnte nicht geladen werden: " + err.message, "error");
  }
}

function renderList(settings, rows) {
  const area = document.getElementById("listenBereich");
  area.innerHTML = "";

  for (let dayOffset = 0; dayOffset < 4; dayOffset++) {
    const dayStarts = STARTS.filter(s => s.dayOffset === dayOffset);
    const date = addDays(corpusChristi(settings.turnierjahr), dayOffset);

    const section = document.createElement("section");
    section.className = "day-section";
    section.innerHTML = `
      <h2 class="day-title">${DAY_NAMES[dayOffset]}, ${formatDate(date)}</h2>
      <div class="start-table-wrap">
        <table class="start-table"><tbody></tbody></table>
      </div>`;
    const tbody = section.querySelector("tbody");

    const headerRow = document.createElement("tr");
    headerRow.innerHTML = '<th>Platz</th>' + dayStarts.map(s => `<th>${s.time} Uhr</th>`).join("");
    tbody.appendChild(headerRow);

    const startRow = document.createElement("tr");
    startRow.innerHTML = '<td class="start-head">Start</td>' + dayStarts.map(s => `<td class="start-head">Start ${s.nr}</td>`).join("");
    tbody.appendChild(startRow);

    const freeRow = document.createElement("tr");
    freeRow.innerHTML = '<td class="free">Frei</td>' + dayStarts.map(s => {
      const occupied = rows.filter(r => Number(r.start_nr) === s.nr)
        .reduce((sum, r) => sum + Number(r.anzahl_teams || 1), 0);
      const free = Math.max(0, settings.max_teams - occupied);
      return `<td class="free"><span class="badge ${free ? "green" : "red"}">${free}</span></td>`;
    }).join("");
    tbody.appendChild(freeRow);

    for (let slot = 1; slot <= settings.max_teams; slot++) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${slot}.</td>`;
      dayStarts.forEach(start => {
        const expanded = [];
        rows.filter(r => Number(r.start_nr) === start.nr).forEach(r => {
          const n = Number(r.anzahl_teams || 1);
          for (let i = 0; i < n; i++) expanded.push(r);
        });
        const entry = expanded[slot - 1];
        const td = document.createElement("td");
        td.className = "slot";
        if (entry) {
          td.innerHTML = `<strong>${escapeHtml(entry.spieler1)}</strong> / ${escapeHtml(entry.spieler2)}${Number(entry.anzahl_teams) > 1 ? ` <span class="small">(${entry.anzahl_teams} Teams)</span>` : ""}`;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    }

    area.appendChild(section);
  }
}

init();
