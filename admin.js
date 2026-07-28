let client;
let settings;

function rowInput(value, type = "text") {
  return `<input type="${type}" value="${escapeHtml(value ?? "")}">`;
}

async function init() {
  const loginMsg = document.getElementById("loginMeldung");
  if (!configOk()) {
    showMessage(loginMsg, "Die Webseite ist vorbereitet. Es fehlt nur noch der Supabase Publishable Key.", "error");
    return;
  }
  client = getSupabase();
  const { data: { session } } = await client.auth.getSession();
  if (session) await openAdmin();
}

document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const msg = document.getElementById("loginMeldung");
  hideMessage(msg);
  const { error } = await client.auth.signInWithPassword({
    email: document.getElementById("loginEmail").value.trim(),
    password: document.getElementById("loginPasswort").value
  });
  if (error) {
    showMessage(msg, "Anmeldung fehlgeschlagen: " + error.message, "error");
    return;
  }
  await openAdmin();
});

async function openAdmin() {
  const { data: permission, error: permError } = await client
    .from("admin_users")
    .select("user_id")
    .limit(1);
  if (permError || !permission?.length) {
    await client.auth.signOut();
    showMessage(document.getElementById("loginMeldung"), "Dieses Benutzerkonto ist nicht als Administrator freigeschaltet.", "error");
    return;
  }
  document.getElementById("loginCard").classList.add("hidden");
  document.getElementById("adminArea").classList.remove("hidden");
  await loadAdmin();
}

async function loadAdmin() {
  settings = await loadSettings(client);
  document.getElementById("turnierTitel").textContent = settings.turniername;
  document.getElementById("turniername").value = settings.turniername;
  document.getElementById("turnierjahr").value = settings.turnierjahr;
  document.getElementById("maxTeams").value = settings.max_teams;

  const { data, error } = await client
    .from("anmeldungen")
    .select("*")
    .order("erstellt_am", { ascending: true });
  if (error) {
    showMessage(document.getElementById("adminMeldung"), error.message, "error");
    return;
  }
  renderAdmin(data || []);
}

function renderAdmin(rows) {
  const body = document.getElementById("adminBody");
  body.innerHTML = "";
  rows.forEach(row => {
    const tr = document.createElement("tr");
    if (row.status === "storniert") tr.classList.add("storniert");
    tr.dataset.id = row.id;
    tr.innerHTML = `
      <td><select class="status"><option value="offen">offen</option><option value="storniert">storniert</option></select></td>
      <td><select class="start">${STARTS.map(s => `<option value="${s.nr}">${s.nr}</option>`).join("")}</select></td>
      <td>${rowInput(row.spieler1)}</td>
      <td>${rowInput(row.spieler2)}</td>
      <td>${rowInput(row.anzahl_teams, "number")}</td>
      <td>${rowInput(row.email, "email")}</td>
      <td>${rowInput(row.telefon)}</td>
      <td><input value="${escapeHtml(row.bemerkung ?? "")}"></td>
      <td><button class="primary saveBtn" type="button">Speichern</button> <button class="danger deleteBtn" type="button">Löschen</button></td>`;
    tr.querySelector(".status").value = row.status;
    tr.querySelector(".start").value = row.start_nr;
    tr.querySelector(".saveBtn").addEventListener("click", () => saveRow(tr));
    tr.querySelector(".deleteBtn").addEventListener("click", () => deleteRow(tr));
    body.appendChild(tr);
  });
}

async function saveRow(tr) {
  const inputs = tr.querySelectorAll("input");
  const payload = {
    status: tr.querySelector(".status").value,
    start_nr: Number(tr.querySelector(".start").value),
    spieler1: inputs[0].value.trim(),
    spieler2: inputs[1].value.trim(),
    anzahl_teams: Number(inputs[2].value),
    email: inputs[3].value.trim(),
    telefon: inputs[4].value.trim() || null,
    bemerkung: inputs[5].value.trim() || null
  };
  const { error } = await client.from("anmeldungen").update(payload).eq("id", tr.dataset.id);
  const msg = document.getElementById("adminMeldung");
  if (error) showMessage(msg, "Speichern fehlgeschlagen: " + error.message, "error");
  else {
    showMessage(msg, "Änderung gespeichert.", "success");
    await loadAdmin();
  }
}

async function deleteRow(tr) {
  if (!confirm("Diese Anmeldung wirklich endgültig löschen?")) return;
  const { error } = await client.from("anmeldungen").delete().eq("id", tr.dataset.id);
  const msg = document.getElementById("adminMeldung");
  if (error) showMessage(msg, "Löschen fehlgeschlagen: " + error.message, "error");
  else {
    showMessage(msg, "Anmeldung gelöscht.", "success");
    await loadAdmin();
  }
}

document.getElementById("settingsForm").addEventListener("submit", async e => {
  e.preventDefault();
  const payload = {
    turniername: document.getElementById("turniername").value.trim(),
    turnierjahr: Number(document.getElementById("turnierjahr").value),
    max_teams: Number(document.getElementById("maxTeams").value)
  };
  const { error } = await client.from("turnier_einstellungen").update(payload).eq("id", 1);
  const msg = document.getElementById("settingsMeldung");
  if (error) showMessage(msg, "Speichern fehlgeschlagen: " + error.message, "error");
  else {
    showMessage(msg, "Turnier-Einstellungen gespeichert.", "success");
    await loadAdmin();
  }
});

document.getElementById("neuLadenBtn").addEventListener("click", loadAdmin);
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await client.auth.signOut();
  location.reload();
});

init();
