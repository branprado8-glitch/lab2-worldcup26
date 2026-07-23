"use strict";

/* ──────────────────────────────────────────────────────
   ESTADO DE APLICACIÓN
────────────────────────────────────────────────────── */
const state = {
  groups: [],
  teams: [],
  games: []
};

/* ──────────────────────────────────────────────────────
   SELECTORES DOM
────────────────────────────────────────────────────── */
const gruposMatrices       = document.getElementById("gruposMatrices");
const estadoGlobal         = document.getElementById("estadoGlobal");
const contadorGrupos       = document.getElementById("contadorGrupos");
const alertaPartidos       = document.getElementById("alertaPartidos");
const btnReintentarPartidos = document.getElementById("btnReintentarPartidos");

/* ──────────────────────────────────────────────────────
  MATRICES
────────────────────────────────────────────────────── */
function construirMatrices() {
  gruposMatrices.innerHTML = "";

  state.groups.forEach(grupo => {
    const idsEquipos = (grupo.teams ?? []).map(fila => String(fila.team_id));

    const panel = document.createElement("section");
    panel.className = "matriz-grupo";

    let html = `<h2>Grupo ${grupo.group}</h2>
      <table class="tabla-matriz">
        <thead><tr><th></th>`;

    // Encabezados de columna
    idsEquipos.forEach(idColumna => {
      html += `<th title="${nombreDeEquipo(idColumna, state.teams)}">
                 ${codigoDeEquipo(idColumna)}
               </th>`;
    });
    html += `</tr></thead><tbody>`;

    // Filas
    idsEquipos.forEach(idFila => {
      html += `<tr>
        <th title="${nombreDeEquipo(idFila, state.teams)}">
          ${codigoDeEquipo(idFila)}
        </th>`;
      idsEquipos.forEach(idColumna => {
        if (idFila === idColumna) {
          // Diagonal
          html += `<td class="diagonal" aria-hidden="true">—</td>`;
        } else {
          html += `<td class="pendiente"
                       data-local="${idFila}"
                       data-visita="${idColumna}">Pendiente</td>`;
        }
      });
      html += `</tr>`;
    });

    html += `</tbody></table>`;
    panel.innerHTML = html;
    gruposMatrices.appendChild(panel);
  });

  contadorGrupos.textContent = String(state.groups.length);
  estadoGlobal.style.display = "none";
}


function codigoDeEquipo(teamId) {
  const equipo = state.teams.find(t => String(t.id) === String(teamId));
  return equipo?.fifa_code ?? nombreDeEquipo(teamId, state.teams).slice(0, 3).toUpperCase();
}

/* ──────────────────────────────────────────────────────
   ACTUALIZACIÓN DE CELDAS 
────────────────────────────────────────────────────── */
function actualizarCeldasConResultados() {
  state.games.forEach(juego => {
    if (juego.type !== "group") return;                          // solo fase de grupos
    if (String(juego.finished).toUpperCase() !== "TRUE") return; // solo jugados

    const idLocal  = String(juego.home_team_id);
    const idVisita = String(juego.away_team_id);

    // Celda vista desde la fila = equipo local del partido
    const celdaDirecta = gruposMatrices.querySelector(
      `td[data-local="${idLocal}"][data-visita="${idVisita}"]`
    );
    if (celdaDirecta) {
      celdaDirecta.textContent = `${juego.home_score}-${juego.away_score}`;
      celdaDirecta.classList.remove("pendiente");
      celdaDirecta.classList.add("jugado");
    }

    // Celda espejo: mismo partido visto desde el otro equipo
    const celdaEspejo = gruposMatrices.querySelector(
      `td[data-local="${idVisita}"][data-visita="${idLocal}"]`
    );
    if (celdaEspejo) {
      celdaEspejo.textContent = `${juego.away_score}-${juego.home_score}`;
      celdaEspejo.classList.remove("pendiente");
      celdaEspejo.classList.add("jugado");
    }
  });
}

/* ──────────────────────────────────────────────────────
   CARGA DE RESULTADOS 
────────────────────────────────────────────────────── */
function cargarResultados() {
  alertaPartidos.classList.remove("visible");

  apiGet("/get/games", {
    alReintentar: uiAvisarReintento,
    alContarSegundo: uiTickCountdown
  })
    .then(resultado => {
      uiOcultarBackoff();
      if (resultado.desdeCache) uiAvisarDatosCacheados(resultado.guardado);

      state.games = resultado.data.games ?? resultado.data;
      actualizarCeldasConResultados();
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("Fallo /get/games; las matrices quedan en Pendiente:", error);
      // Reto de resiliencia
      alertaPartidos.classList.add("visible");
    });
}

btnReintentarPartidos.addEventListener("click", () => cargarResultados());

/* ──────────────────────────────────────────────────────
   Init
────────────────────────────────────────────────────── */
function init() {
  apiGet("/get/groups", { alReintentar: uiAvisarReintento, alContarSegundo: uiTickCountdown })
    .then(rGroups => {
      if (rGroups.desdeCache) uiAvisarDatosCacheados(rGroups.guardado);
      state.groups = rGroups.data.groups ?? rGroups.data;

      return apiGet("/get/teams", { alReintentar: uiAvisarReintento, alContarSegundo: uiTickCountdown });
    })
    .then(rTeams => {
      uiOcultarBackoff();
      if (rTeams.desdeCache) uiAvisarDatosCacheados(rTeams.guardado);
      state.teams = rTeams.data.teams ?? rTeams.data;

      // Fase 1: matrices completas
      construirMatrices();

      // Fase 2: resultados
      cargarResultados();
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("No se pudo construir la estructura de las matrices:", error);
      estadoGlobal.innerHTML = `
        <span class="state-icon">🧩</span>
        <h2>No se pudieron construir las matrices</h2>
        <p>/get/groups o /get/teams no respondieron y no existe copia
           en caché. Sin la composición de los grupos no hay estructura
           que dibujar.</p>
      `;
    });
}

/* Punto de entrada */
init();
