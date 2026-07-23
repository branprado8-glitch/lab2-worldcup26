"use strict";

/* ──────────────────────────────────────────────────────
   ESTADO DE APLICACIÓN
────────────────────────────────────────────────────── */
const state = {
  stadiums: [],        // Array<{id, name_en, city_en, country_en, capacity}>
  games: [],           // Array de partidos de /get/games
  fallaronPartidos: false,
  sedeActivaId: null,
  scrollEnCurso: false // evita estados inconsistentes por clics repetidos
};

/* ──────────────────────────────────────────────────────
   SELECTORES DOM
────────────────────────────────────────────────────── */
const sedesGrid      = document.getElementById("sedesGrid");
const seccionesSedes = document.getElementById("seccionesSedes");
const estadoGlobal   = document.getElementById("estadoGlobal");
const contadorSedes  = document.getElementById("contadorSedes");

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: botones de sede
────────────────────────────────────────────────────── */
function renderizarBotonesSedes() {
  sedesGrid.innerHTML = "";

  state.stadiums.forEach(sede => {
    const boton = document.createElement("button");
    boton.className = "sede-btn";
    boton.type = "button";
    boton.dataset.sedeId = String(sede.id);
    boton.innerHTML = `
      <span class="sede-nombre">${sede.name_en}</span>
      <span class="sede-ciudad">${sede.city_en} · ${sede.country_en}</span>
    `;
    boton.addEventListener("click", () => activarSede(String(sede.id)));
    sedesGrid.appendChild(boton);
  });

  contadorSedes.textContent = String(state.stadiums.length);
}

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: secciones destino
────────────────────────────────────────────────────── */
function renderizarSeccionesSedes() {
  seccionesSedes.innerHTML = "";

  state.stadiums.forEach(sede => {
    const seccion = document.createElement("section");
    seccion.className = "seccion-sede";
    seccion.id = `sede-${sede.id}`;

    const capacidad = Number(sede.capacity).toLocaleString("es-CR");
    seccion.innerHTML = `
      <h2>${sede.name_en}</h2>
      <p class="sede-meta">
        ${sede.fifa_name ?? ""} · ${sede.city_en}, ${sede.country_en} ·
        Capacidad: ${capacidad}
      </p>
      <div class="cards-grid" id="partidos-sede-${sede.id}"></div>
    `;
    seccionesSedes.appendChild(seccion);

    renderizarPartidosDeSede(String(sede.id));
  });
}

function renderizarPartidosDeSede(sedeId) {
  const contenedor = document.getElementById(`partidos-sede-${sedeId}`);
  if (!contenedor) return;

  // ── Reto de resiliencia
  if (state.fallaronPartidos) {
    contenedor.innerHTML = `
      <div class="error-local">
        No se pudieron cargar los partidos de esta sede
        (/get/games no respondió). La navegación entre sedes
        sigue disponible.
      </div>
    `;
    return;
  }

  const partidos = state.games.filter(
    juego => String(juego.stadium_id) === sedeId
  );

  if (partidos.length === 0) {
    contenedor.innerHTML = `
      <div class="error-local">Sin partidos registrados para esta sede.</div>
    `;
    return;
  }

  contenedor.innerHTML = "";
  partidos.forEach(juego => {
    const local  = juego.home_team_name_en ?? juego.home_team_label ?? "Por definir";
    const visita = juego.away_team_name_en ?? juego.away_team_label ?? "Por definir";
    const jugado = String(juego.finished).toUpperCase() === "TRUE";
    const marcador = jugado ? `${juego.home_score} - ${juego.away_score}` : "vs";

    const tarjeta = document.createElement("article");
    tarjeta.className = "match-card";
    tarjeta.innerHTML = `
      <div class="card-stripe"></div>
      <div class="card-header">
        <div class="card-matchup">
          <p class="card-round">Partido ${juego.id} · ${juego.type}</p>
          <p class="card-teams">${local} <span class="team-highlight">${marcador}</span> ${visita}</p>
        </div>
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
    contenedor.appendChild(tarjeta);
  });
}

/* ──────────────────────────────────────────────────────
   INTERACCIÓN
────────────────────────────────────────────────────── */
function activarSede(sedeId) {
  if (state.scrollEnCurso) return;
  state.scrollEnCurso = true;
  setTimeout(() => { state.scrollEnCurso = false; }, 700);

  state.sedeActivaId = sedeId;

  // Estado visual "sede activa" en botones y secciones
  document.querySelectorAll(".sede-btn").forEach(boton => {
    boton.classList.toggle("activa", boton.dataset.sedeId === sedeId);
  });
  document.querySelectorAll(".seccion-sede").forEach(seccion => {
    seccion.classList.toggle("activa", seccion.id === `sede-${sedeId}`);
  });

  // Navegación interna del DOM exigida por el proyecto
  const destino = document.getElementById(`sede-${sedeId}`);
  if (destino) {
    destino.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ──────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────── */
function init() {
  apiGet("/get/stadiums", {
    alReintentar: uiAvisarReintento,
    alContarSegundo: uiTickCountdown
  })
    .then(resultadoSedes => {
      uiOcultarBackoff();
      if (resultadoSedes.desdeCache) uiAvisarDatosCacheados(resultadoSedes.guardado);

   
      state.stadiums = resultadoSedes.data.stadiums ?? resultadoSedes.data;

      estadoGlobal.style.display = "none";
      renderizarBotonesSedes();
      renderizarSeccionesSedes();

      return apiGet("/get/games", {
        alReintentar: uiAvisarReintento,
        alContarSegundo: uiTickCountdown
      });
    })
    .then(resultadoPartidos => {
      uiOcultarBackoff();
      if (resultadoPartidos.desdeCache) uiAvisarDatosCacheados(resultadoPartidos.guardado);

      state.games = resultadoPartidos.data.games ?? resultadoPartidos.data;
      state.fallaronPartidos = false;
      state.stadiums.forEach(sede => renderizarPartidosDeSede(String(sede.id)));
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("Error en el tour de sedes:", error);

      if (state.stadiums.length > 0) {

        state.fallaronPartidos = true;
        state.stadiums.forEach(sede => renderizarPartidosDeSede(String(sede.id)));
      } else {

        estadoGlobal.innerHTML = `
          <span class="state-icon">🏟️</span>
          <h2>No se pudieron cargar las sedes</h2>
          <p>/get/stadiums no respondió y no existe copia en caché.
             Revisá tu conexión y recargá manualmente cuando estés listo.</p>
        `;
      }
    });
}

/* Punto de entrada */
init();
