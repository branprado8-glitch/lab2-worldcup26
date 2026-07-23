"use strict";

/* ──────────────────────────────────────────────────────
   CONFIGURACIÓN Y ESTADO
────────────────────────────────────────────────────── */
const TAMANO_BLOQUE = 10;

const state = {
  games: [],          
  indiceInsertado: 0,  // cuántos partidos hay YA en el DOM
  observer: null      
};

/* ──────────────────────────────────────────────────────
   SELECTORES DOM
────────────────────────────────────────────────────── */
const timelineLista      = document.getElementById("timelineLista");
const centinela          = document.getElementById("centinela");
const timelineProgreso   = document.getElementById("timelineProgreso");
const contadorInsertados = document.getElementById("contadorInsertados");
const estadoError        = document.getElementById("estadoError");
const estadoCarga        = document.getElementById("estadoCarga");
const btnReintentar      = document.getElementById("btnReintentar");

/* ──────────────────────────────────────────────────────
   PRESENTACIÓN: insertar el siguiente bloque de 10
────────────────────────────────────────────────────── */
function insertarSiguienteBloque() {
  const bloque = state.games.slice(
    state.indiceInsertado,
    state.indiceInsertado + TAMANO_BLOQUE
  );

  bloque.forEach(juego => {
    const local  = juego.home_team_name_en ?? juego.home_team_label ?? "Por definir";
    const visita = juego.away_team_name_en ?? juego.away_team_label ?? "Por definir";
    const jugado = String(juego.finished).toUpperCase() === "TRUE";
    const marcador = jugado ? `${juego.home_score} - ${juego.away_score}` : "vs";

    const item = document.createElement("article");
    item.className = "timeline-item";
    item.innerHTML = `
      <p class="ti-fecha">${juego.local_date}</p>
      <p class="ti-partido">${local} <span class="team-highlight">${marcador}</span> ${visita}</p>
      <p class="ti-detalle">Partido ${juego.id} · Etapa: ${juego.type} · Jornada ${juego.matchday}</p>
    `;
    timelineLista.appendChild(item);
  });

  state.indiceInsertado += bloque.length;
  contadorInsertados.textContent = `${state.indiceInsertado} / ${state.games.length}`;

  if (state.indiceInsertado >= state.games.length) {
    // Todo insertado: el observer ya no tiene trabajo pendiente
    if (state.observer) state.observer.disconnect();
    timelineProgreso.textContent = "— Fin del calendario: 104 partidos cargados —";
  } else {
    timelineProgreso.textContent = "Desplazate hacia abajo para cargar más partidos…";
  }
}

/* ──────────────────────────────────────────────────────
   OBSERVADOR DE INTERSECCIÓN
────────────────────────────────────────────────────── */
function conectarObserver() {
  if (state.observer) state.observer.disconnect();

  state.observer = new IntersectionObserver(entradas => {
    entradas.forEach(entrada => {
      if (entrada.isIntersecting && state.games.length > 0) {
        insertarSiguienteBloque();
      }
    });
  }, { rootMargin: "200px" });

  state.observer.observe(centinela);
}

/* ──────────────────────────────────────────────────────
   CARGA DE DATOS 
────────────────────────────────────────────────────── */
function cargarPartidos() {
  estadoError.style.display = "none";
  estadoCarga.style.display = "block";

  apiGet("/get/games", {
    alReintentar: uiAvisarReintento,
    alContarSegundo: uiTickCountdown
  })
    .then(resultado => {
      uiOcultarBackoff();
      estadoCarga.style.display = "none";
      if (resultado.desdeCache) uiAvisarDatosCacheados(resultado.guardado);
      else uiOcultarBannerCache();

      const lista = resultado.data.games ?? resultado.data;

    
      state.games = [...lista].sort(
        (a, b) => parsearFechaLocal(a.local_date) - parsearFechaLocal(b.local_date)
      );

      // Reinicio ANTI-DUPLICADOS
      timelineLista.innerHTML = "";
      state.indiceInsertado = 0;

      insertarSiguienteBloque(); // primer bloque inmediato
      conectarObserver();        // el resto lo dispara el scroll
    })
    .catch(error => {
      uiOcultarBackoff();
      console.error("Error al cargar el timeline:", error);

      /* Reto de resiliencia */
      if (state.observer) state.observer.disconnect();
      estadoCarga.style.display = "none";
      estadoError.style.display = "block";
      timelineProgreso.textContent = "";
    });
}

/* ──────────────────────────────────────────────────────
   EVENTOS
────────────────────────────────────────────────────── */
btnReintentar.addEventListener("click", () => {
  cargarPartidos();
});

/* Punto de entrada */
cargarPartidos();
