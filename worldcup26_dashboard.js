"use strict";

/* ──────────────────────────────────────────────────────
   CONFIGURACIÓN Y ESTADO
────────────────────────────────────────────────────── */
const LLAVE_FAVORITO = "wc26_equipo_favorito";

const state = {
  teams: [],
  games: [],
  groups: [],
  favoritoId: localStorage.getItem(LLAVE_FAVORITO) // persiste entre sesiones
};

/* ──────────────────────────────────────────────────────
   SELECTORES DOM
────────────────────────────────────────────────────── */
const favoritoSelect   = document.getElementById("favoritoSelect");
const statsBar         = document.getElementById("statsBar");
const panelGrupo       = document.getElementById("panelGrupo");
const tituloGrupo      = document.getElementById("tituloGrupo");
const cuerpoTablaGrupo = document.getElementById("cuerpoTablaGrupo");
const sectionEyebrow   = document.getElementById("sectionEyebrow");
const eyebrowCount     = document.getElementById("eyebrowCount");
const cardsGrid        = document.getElementById("cardsGrid");
const estadoInicial    = document.getElementById("estadoInicial");

/* ──────────────────────────────────────────────────────
   TEMATIZACIÓN DINÁMICA
────────────────────────────────────────────────────── */
function repintarAcento(teamId) {
  const matiz = (Number(teamId) * 47) % 360; // 47 dispersa los tonos
  const color = `hsl(${matiz}, 75%, 58%)`;
  document.body.style.setProperty("--acento", color);
}

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: selector de favoritos
────────────────────────────────────────────────────── */
function poblarSelector() {
  const ordenados = [...state.teams].sort((a, b) =>
    (a.name_en ?? "").localeCompare(b.name_en ?? "")
  );

  favoritoSelect.innerHTML =
    `<option value="">— Selecciona tu favorito (${ordenados.length}) —</option>`;

  ordenados.forEach(equipo => {
    const opt = document.createElement("option");
    opt.value = String(equipo.id);
    opt.textContent = `${equipo.name_en} (${equipo.fifa_code ?? ""})`;
    favoritoSelect.appendChild(opt);
  });

  favoritoSelect.disabled = false;

  // Reto de resiliencia
  if (state.favoritoId) {
    favoritoSelect.value = state.favoritoId;
    renderizarDashboard(state.favoritoId);
  }
}

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: dashboard completo del favorito
────────────────────────────────────────────────────── */
function renderizarDashboard(teamId) {
  const equipo = state.teams.find(t => String(t.id) === String(teamId));
  if (!equipo) return;

  estadoInicial.style.display = "none";
  repintarAcento(teamId);

  // ── Partidos del favorito filtrados 
  const partidos = state.games.filter(juego =>
    String(juego.home_team_id) === String(teamId) ||
    String(juego.away_team_id) === String(teamId)
  );

  cardsGrid.innerHTML = "";
  partidos.forEach(juego => {
    const esLocal = String(juego.home_team_id) === String(teamId);
    const rival = esLocal
      ? (juego.away_team_name_en ?? juego.away_team_label ?? "Por definir")
      : (juego.home_team_name_en ?? juego.home_team_label ?? "Por definir");
    const jugado = String(juego.finished).toUpperCase() === "TRUE";
    const golesFavorito = esLocal ? juego.home_score : juego.away_score;
    const golesRival    = esLocal ? juego.away_score : juego.home_score;
    const marcador = jugado ? `${golesFavorito} - ${golesRival}` : "vs";

    const tarjeta = document.createElement("article");
    tarjeta.className = `match-card ${esLocal ? "home" : ""}`;
    tarjeta.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <p class="card-round">Partido ${juego.id} · ${juego.type}</p>
          <p class="card-teams">
            <span class="team-highlight">${equipo.name_en}</span> ${marcador} ${rival}
          </p>
        </div>
        <span class="card-role-badge ${esLocal ? "role-home" : "role-away"}">
          ${esLocal ? "Local" : "Visitante"}
        </span>
      </div>
      <div class="card-body">
        <div class="card-row">
          <div class="card-icon">📅</div>
          <div class="card-row-content">
            <p class="card-row-label">Fecha local</p>
            <p class="card-row-value">${juego.local_date}</p>
          </div>
        </div>
      </div>
    `;
    cardsGrid.appendChild(tarjeta);
  });

  sectionEyebrow.classList.add("visible");
  eyebrowCount.textContent = String(partidos.length);

  // ── Posición dentro del grupo
  renderizarTablaGrupo(teamId, partidos.length);
}

function renderizarTablaGrupo(teamId, totalPartidos) {
  // Se busca el grupo cuyo arreglo teams contenga al favorito
  const grupo = state.groups.find(g =>
    (g.teams ?? []).some(fila => String(fila.team_id) === String(teamId))
  );

  if (!grupo) {
    panelGrupo.classList.remove("visible");
    statsBar.classList.add("visible");
    document.getElementById("statPartidos").textContent = String(totalPartidos);
    return;
  }

  // Orden de la tabla: puntos, luego diferencia de goles
  const filas = [...grupo.teams].sort((a, b) => {
    const porPuntos = Number(b.pts) - Number(a.pts);
    if (porPuntos !== 0) return porPuntos;
    return (Number(b.gf) - Number(b.ga)) - (Number(a.gf) - Number(a.ga));
  });

  tituloGrupo.textContent = `Grupo ${grupo.group} · posición actual`;
  cuerpoTablaGrupo.innerHTML = "";

  filas.forEach((fila, indice) => {
    const nombre = nombreDeEquipo(fila.team_id, state.teams);
    const tr = document.createElement("tr");
    if (String(fila.team_id) === String(teamId)) tr.className = "fila-favorito";
    tr.innerHTML = `
      <td>${indice + 1}</td>
      <td>${nombre}</td>
      <td>${fila.pts}</td>
      <td>${fila.gf}</td>
      <td>${fila.ga}</td>
    `;
    cuerpoTablaGrupo.appendChild(tr);
  });

  panelGrupo.classList.add("visible");

  const filaFavorito = filas.find(f => String(f.team_id) === String(teamId));
  statsBar.classList.add("visible");
  document.getElementById("statPartidos").textContent = String(totalPartidos);
  document.getElementById("statPts").textContent = filaFavorito?.pts ?? "—";
  document.getElementById("statGf").textContent = filaFavorito?.gf ?? "—";
  document.getElementById("statGa").textContent = filaFavorito?.ga ?? "—";
}

/* ──────────────────────────────────────────────────────
   EVENTOS
────────────────────────────────────────────────────── */
favoritoSelect.addEventListener("change", () => {
  const teamId = favoritoSelect.value;
  if (!teamId) return;

  // Persistencia
  localStorage.setItem(LLAVE_FAVORITO, teamId);
  state.favoritoId = teamId;
  renderizarDashboard(teamId);
});

/* ──────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────── */
function init() {
  let huboCache = false;
  let timestampCache = null;

  apiGet("/get/teams", { alReintentar: uiAvisarReintento, alContarSegundo: uiTickCountdown })
    .then(rTeams => {
      if (rTeams.desdeCache) { huboCache = true; timestampCache = rTeams.guardado; }
      state.teams = rTeams.data.teams ?? rTeams.data;
      return apiGet("/get/games", { alReintentar: uiAvisarReintento, alContarSegundo: uiTickCountdown });
    })
    .then(rGames => {
      if (rGames.desdeCache) { huboCache = true; timestampCache = rGames.guardado; }
      state.games = rGames.data.games ?? rGames.data;
      return apiGet("/get/groups", { alReintentar: uiAvisarReintento, alContarSegundo: uiTickCountdown });
    })
    .then(rGroups => {
      uiOcultarBackoff();
      if (rGroups.desdeCache) { huboCache = true; timestampCache = rGroups.guardado; }
      state.groups = rGroups.data.groups ?? rGroups.data;

      if (huboCache) uiAvisarDatosCacheados(timestampCache);

      poblarSelector();
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("Error al inicializar el dashboard:", error);
      estadoInicial.innerHTML = `
        <span class="state-icon">📡</span>
        <h2>Sin datos disponibles</h2>
        <p>La API no respondió y todavía no existe copia en caché
           (visitá el dashboard al menos una vez con conexión para
           habilitar el modo offline).</p>
      `;
    });
}

/* Punto de entrada */
init();
