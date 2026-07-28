let client;
let settings;
let belegungJeStart = {};

async function init() {
  const warning = document.getElementById("configWarnung");
  if (!configOk()) {
    showMessage(warning, "Die Webseite ist vorbereitet. Es fehlt nur noch der Supabase Publishable Key.", "error");
    document.getElementById("anmeldeFormular").querySelectorAll("input,select,textarea,button").forEach(el => el.disabled = true);
    return;
  }

  try {
    client = getSupabase();
    settings = await loadSettings(client);
    document.getElementById("turnierTitel").textContent = settings.turniername;
    document.getElementById("heroJahr").textContent = settings.turnierjahr;
    document.getElementById("heroDatum").textContent =
      `${formatDate(corpusChristi(settings.turnierjahr))} bis ${formatDate(addDays(corpusChristi(settings.turnierjahr), 3))}`;
    await loadStartAvailability();
  } catch (err) {
    showMessage(warning, "Verbindung zur Datenbank fehlgeschlagen: " + err.message, "error");
  }
}

async function loadStartAvailability() {
  const { data, error } = await client
    .from("oeffentliche_meldeliste")
    .select("start_nr,anzahl_teams");

  if (error) throw error;

  belegungJeStart = {};
  STARTS.forEach(s => belegungJeStart[s.nr] = 0);

  (data || []).forEach(row => {
    const nr = Number(row.start_nr);
    belegungJeStart[nr] = (belegungJeStart[nr] || 0) + Number(row.anzahl_teams || 1);
  });

  renderStartCheckboxes();
}

function renderStartCheckboxes() {
  const container = document.getElementById("startAuswahl");
  container.innerHTML = "";

  STARTS.forEach(start => {
    const frei = Math.max(0, Number(settings.max_teams) - Number(belegungJeStart[start.nr] || 0));
    const voll = frei <= 0;

    const row = document.createElement("div");
    row.className = "start-row" + (voll ? " full-start" : "");
    row.innerHTML = `
      <div class="start-check-cell">
        <input class="start-checkbox" type="checkbox" id="start_${start.nr}"
               data-start="${start.nr}" ${voll ? "disabled" : ""}>
      </div>
      <label class="start-name" for="start_${start.nr}">Start ${start.nr}</label>
      <label class="start-date" for="start_${start.nr}">
        ${DAY_NAMES[start.dayOffset]}, ${formatDate(addDays(corpusChristi(settings.turnierjahr), start.dayOffset))}
        · ${start.time} Uhr
      </label>
      <span class="free-count">${voll ? "Ausgebucht" : `${frei} frei`}</span>
      <input class="team-count" type="number" min="0" max="5" value="0"
             aria-label="Anzahl Teams für Start ${start.nr}" ${voll ? "disabled" : ""}>
    `;

    const checkbox = row.querySelector(".start-checkbox");
    const countInput = row.querySelector(".team-count");

    checkbox.addEventListener("change", () => {
      if (checkbox.checked && Number(countInput.value) === 0) countInput.value = "1";
      if (!checkbox.checked) countInput.value = "0";
      row.classList.toggle("selected", checkbox.checked);
    });

    countInput.addEventListener("input", () => {
      let value = Math.max(0, Math.min(5, Number(countInput.value || 0)));
      countInput.value = String(value);
      checkbox.checked = value > 0;
      row.classList.toggle("selected", value > 0);
    });

    container.appendChild(row);
  });
}

function selectedStarts() {
  return [...document.querySelectorAll(".start-row")]
    .map(row => {
      const checkbox = row.querySelector(".start-checkbox");
      const countInput = row.querySelector(".team-count");
      return {
        nr: Number(checkbox.dataset.start),
        count: Number(countInput.value || 0)
      };
    })
    .filter(item => item.count > 0);
}

async function sendAdminNotification({ spieler1, spieler2, email, telefon, bemerkung, starts }) {
  const startDetails = starts
    .map(item => `${startLabel(item.nr, settings.turnierjahr)} – ${item.count} Team(s)`)
    .join("\n");

  const data = new FormData();
  data.append("_subject", `Neue Presssack-Open-Anmeldung: ${spieler1} / ${spieler2}`);
  data.append("_template", "table");
  data.append("_captcha", "false");
  data.append("Turnier", `${settings.turniername} ${settings.turnierjahr}`);
  data.append("Spieler 1", spieler1);
  data.append("Spieler 2", spieler2);
  data.append("E-Mail des Anmelders", email);
  data.append("Telefon", telefon || "nicht angegeben");
  data.append("Gewählte Starts und Teamanzahl", startDetails);
  data.append("Bemerkung", bemerkung || "keine");
  data.append("Hinweis", "Die Anmeldung wurde bereits erfolgreich in Supabase gespeichert.");

  const response = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(ANMELDUNG_EMAIL)}`, {
    method: "POST",
    body: data,
    headers: { "Accept": "application/json" }
  });

  if (!response.ok) {
    throw new Error(`E-Mail-Dienst meldet Status ${response.status}`);
  }

  const result = await response.json().catch(() => ({}));
  if (result.success === false) {
    throw new Error(result.message || "E-Mail konnte nicht verschickt werden.");
  }
}

document.getElementById("anmeldeFormular").addEventListener("submit", async (event) => {
  event.preventDefault();

  const msg = document.getElementById("meldung");
  const submitButton = event.submitter;
  hideMessage(msg);

  const starts = selectedStarts();
  const spieler1 = document.getElementById("spieler1").value.trim();
  const spieler2 = document.getElementById("spieler2").value.trim();
  const email = document.getElementById("email").value.trim();
  const telefon = document.getElementById("telefon").value.trim() || null;
  const bemerkung = document.getElementById("bemerkung").value.trim() || null;

  if (!spieler1 || !spieler2 || !email) {
    showMessage(msg, "Bitte alle Pflichtfelder ausfüllen.", "error");
    return;
  }

  if (!starts.length) {
    showMessage(msg, "Bitte mindestens einen Start auswählen.", "error");
    return;
  }

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent = "Anmeldung wird gespeichert …";
  }

  try {
    const { data: current, error: readError } = await client
      .from("oeffentliche_meldeliste")
      .select("start_nr,anzahl_teams")
      .in("start_nr", starts.map(item => item.nr));

    if (readError) throw readError;

    const aktuelleBelegung = {};
    starts.forEach(item => aktuelleBelegung[item.nr] = 0);
    (current || []).forEach(row => {
      const nr = Number(row.start_nr);
      aktuelleBelegung[nr] = (aktuelleBelegung[nr] || 0) + Number(row.anzahl_teams || 1);
    });

    const nichtMoeglich = starts.filter(item =>
      Number(aktuelleBelegung[item.nr] || 0) + item.count > Number(settings.max_teams)
    );

    if (nichtMoeglich.length) {
      const namen = nichtMoeglich.map(item => `Start ${item.nr}`).join(", ");
      showMessage(
        msg,
        `Für ${namen} sind nicht mehr genügend freie Teamplätze vorhanden. Bitte Auswahl ändern.`,
        "error"
      );
      await loadStartAvailability();
      return;
    }

    const gruppe = crypto.randomUUID();
    const payloads = starts.map(item => ({
      anmeldungsgruppe: gruppe,
      spieler1,
      spieler2,
      email,
      telefon,
      bemerkung,
      start_nr: item.nr,
      anzahl_teams: item.count,
      status: "offen"
    }));

    const { error } = await client.from("anmeldungen").insert(payloads);
    if (error) throw error;

    let emailHinweis = "";
    try {
      await sendAdminNotification({ spieler1, spieler2, email, telefon, bemerkung, starts });
      emailHinweis = " Eine Benachrichtigung wurde an stephan@rsconline.de gesendet.";
    } catch (mailError) {
      console.warn("E-Mail-Benachrichtigung fehlgeschlagen:", mailError);
      emailHinweis = " Die Anmeldung ist gespeichert; die E-Mail-Benachrichtigung konnte jedoch nicht bestätigt werden.";
    }

    event.target.reset();
    await loadStartAvailability();

    const startText = starts.map(item => `Start ${item.nr} (${item.count} Team${item.count === 1 ? "" : "s"})`).join(", ");
    showMessage(
      msg,
      `Vielen Dank. Die Anmeldung für ${startText} wurde gespeichert und erscheint jetzt in der Meldeliste.${emailHinweis}`,
      "success"
    );
  } catch (err) {
    showMessage(msg, "Die Anmeldung konnte nicht gespeichert werden: " + err.message, "error");
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Verbindlich anmelden";
    }
  }
});

init();
