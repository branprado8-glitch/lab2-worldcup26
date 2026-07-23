"use strict";

/* ──────────────────────────────────────────────────────
   ESTADO DE APLICACIÓN
────────────────────────────────────────────────────── */
const state = {
  teams: [],
  games: [],
  fechasSimultaneas: [],  
  partidosPorFecha: {},  
  indiceFecha: 0
};

/* ──────────────────────────────────────────────────────
   SELECTORES DOM
────────────────────────────────────────────────────── */
const agendaColumnas    = document.getElementById("agendaColumnas");
const fechaActual       = document.getElementById("fechaActual");
const contadorPartidos  = document.getElementById("contadorPartidos");
const btnFechaAnterior  = document.getElementById("btnFechaAnterior");
const btnFechaSiguiente = document.getElementById("btnFechaSiguiente");

/* ──────────────────────────────────────────────────────
   Exigencia del reto de resiliencia
────────────────────────────────────────────────────── */
function renderizarSkeletons(cantidadColumnas = 3) {
  agendaColumnas.innerHTML = "";
  for (let i = 0; i < cantidadColumnas; i++) {
    const columna = document.createElement("div");
    columna.className = "skeleton-columna";
    columna.innerHTML = `
      <div class="skel skel-sm"></div>
      <div class="skel skel-lg"></div>
      <div class="skel skel-md"></div>
      <div class="skel skel-lg"></div>
    `;
    agendaColumnas.appendChild(columna);
  }
}

/* ──────────────────────────────────────────────────────
   AGRUPACIÓN POR CLAVE COMPUESTA
   */
function agruparPorFecha() {
  state.partidosPorFecha = {};

  state.games.forEach(juego => {
    const clave = (juego.local_date ?? "").split(" ")[0];
    if (!clave) return;
    if (!state.partidosPorFecha[clave]) state.partidosPorFecha[clave] = [];
    state.partidosPorFecha[clave].push(juego);
  });

  // Solo interesan las fechas con 2 o más partidos el mismo día
  state.fechasSimultaneas = Object.keys(state.partidosPorFecha)
    .filter(clave => state.partidosPorFecha[clave].length >= 2)
    .sort((a, b) => parsearFechaLocal(a) - parsearFechaLocal(b));
}

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: columnas del día seleccionado
────────────────────────────────────────────────────── */
function renderizarDia() {
  const clave = state.fechasSimultaneas[state.indiceFecha];
  const partidos = state.partidosPorFecha[clave] ?? [];

  // Encabezado y contador
  const fecha = parsearFechaLocal(clave);
  fechaActual.textContent = fecha.toLocaleDateString("es-CR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  });
  contadorPartidos.textContent = String(partidos.length);

  // Controles: se deshabilitan en los extremos del arreglo
  btnFechaAnterior.disabled = state.indiceFecha === 0;
  btnFechaSiguiente.disabled = state.indiceFecha === state.fechasSimultaneas.length - 1;

  // Una columna por partido, ordenadas por hora
  agendaColumnas.innerHTML = "";
  const ordenados = [...partidos].sort(
    (a, b) => parsearFechaLocal(a.local_date) - parsearFechaLocal(b.local_date)
  );

  ordenados.forEach(juego => {
    const local  = nombreDeEquipo(juego.home_team_id, state.teams, juego.home_team_label);
    const visita = nombreDeEquipo(juego.away_team_id, state.teams, juego.away_team_label);
    const hora = (juego.local_date ?? "").split(" ")[1] ?? "—";

    const columna = document.createElement("article");
    columna.className = "columna-partido";
    columna.innerHTML = `
      <div class="card-stripe"></div>
      <div class="cuerpo">
        <p class="columna-hora">🕐 ${hora} hora local · Partido ${juego.id}</p>
        <p class="columna-equipo">${local}</p>
        <p class="columna-vs">contra</p>
        <p class="columna-equipo">${visita}</p>
      </div>
    `;
    agendaColumnas.appendChild(columna);
  });
}

/* ──────────────────────────────────────────────────────
   EVENTOS: navegación entre fechas
────────────────────────────────────────────────────── */
function cambiarFecha(delta) {
  const nuevoIndice = state.indiceFecha + delta;
  if (nuevoIndice < 0 || nuevoIndice >= state.fechasSimultaneas.length) return;

  state.indiceFecha = nuevoIndice;
  renderizarSkeletons(Math.min(4, 3));
  requestAnimationFrame(() => renderizarDia());
}

btnFechaAnterior.addEventListener("click", () => cambiarFecha(-1));
btnFechaSiguiente.addEventListener("click", () => cambiarFecha(1));

/* ──────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────── */
function init() {
  renderizarSkeletons();

  apiGet("/get/teams", {
    alReintentar: uiAvisarReintento,
    alContarSegundo: uiTickCountdown
  })
    .then(resultadoEquipos => {
      if (resultadoEquipos.desdeCache) uiAvisarDatosCacheados(resultadoEquipos.guardado);
      state.teams = resultadoEquipos.data.teams ?? resultadoEquipos.data;

      return apiGet("/get/games", {
        alReintentar: uiAvisarReintento,
        alContarSegundo: uiTickCountdown
      });
    })
    .then(resultadoPartidos => {
      uiOcultarBackoff();
      if (resultadoPartidos.desdeCache) uiAvisarDatosCacheados(resultadoPartidos.guardado);

      state.games = resultadoPartidos.data.games ?? resultadoPartidos.data;
      agruparPorFecha();

      if (state.fechasSimultaneas.length === 0) {
        agendaColumnas.innerHTML = `
          <div class="error-local">No hay fechas con partidos simultáneos.</div>
        `;
        fechaActual.textContent = "Sin fechas";
        return;
      }

      state.indiceFecha = 0;
      renderizarDia();
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("Error en la agenda simultánea:", error);
      fechaActual.textContent = "Sin datos";
      agendaColumnas.insertAdjacentHTML("afterbegin", `
        <div class="error-local" style="grid-column: 1 / -1;">
          No hay datos en caché ni respuesta de red disponible.
          Las columnas permanecen como esqueletos de carga hasta
          que la conexión se recupere.
        </div>
      `);
    });
}

/* Punto de entrada */
init();
