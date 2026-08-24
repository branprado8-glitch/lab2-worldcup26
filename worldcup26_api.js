"use strict";

/* ══════════════════════════════════════════════════════════
   ARQUITECTURA BASE DE RESILIENCIA
   ISW-521 · Laboratorio 2 · Brandon Prado Mora

   Punto único de acceso a la API worldcup26.ir. Las pantallas
   NO llaman a fetch: llaman a apiGet() y reciben siempre el
   mismo contrato { data, desdeCache, guardado }.

   Estilo asíncrono: cadenas de promesas (.then/.catch), sin
   async/await, según la indicación del profesor para este lab.
   Prohibiciones absolutas: cero alert(), cero location.reload().
══════════════════════════════════════════════════════════ */

/* ──────────────────────────────────────────────────────────
   CONFIGURACIÓN
────────────────────────────────────────────────────────── */
const API_BASE = "https://worldcup26.ir";

const MAX_REINTENTOS = 4;          // 1s → 2s → 4s → 8s
const ESPERA_BASE_MS = 1000;
const ESTADOS_REINTENTABLES = [429, 500, 502, 503, 504];

const PREFIJO_CACHE = "wc26_cache:";

/* ──────────────────────────────────────────────────────────
   CACHÉ EN localStorage (modo offline)

   Se guarda { guardado: <ISO>, data: <respuesta> } bajo la
   llave wc26_cache:<endpoint>. La llave es por endpoint y no
   por pantalla: /get/games lo usan cuatro de las cinco, así
   que la primera que lo descarga habilita el modo offline
   para las demás.
────────────────────────────────────────────────────────── */
function guardarEnCache(endpoint, datos) {
  try {
    const sobre = { guardado: new Date().toISOString(), data: datos };
    localStorage.setItem(PREFIJO_CACHE + endpoint, JSON.stringify(sobre));
  } catch (error) {
    // Cuota llena o almacenamiento bloqueado: la app sigue viva sin caché.
    console.warn("No se pudo cachear " + endpoint + ":", error);
  }
}

function leerDeCache(endpoint) {
  try {
    const crudo = localStorage.getItem(PREFIJO_CACHE + endpoint);
    if (!crudo) return null;

    const sobre = JSON.parse(crudo);
    if (!sobre || typeof sobre !== "object" || !("data" in sobre)) return null;

    return { data: sobre.data, guardado: sobre.guardado || null };
  } catch (error) {
    console.warn("Caché ilegible para " + endpoint + ":", error);
    return null;
  }
}

/* ──────────────────────────────────────────────────────────
   ESPERA CON CUENTA REGRESIVA

   No basta con esperar: el usuario tiene que ver que la app
   está esperando y cuánto falta. Por eso cada segundo se
   notifica a la pantalla mediante alContarSegundo().
────────────────────────────────────────────────────────── */
function esperarConCuenta(milisegundos, estado, alContarSegundo) {
  return new Promise(function (resolver) {
    let restantes = Math.ceil(milisegundos / 1000);
    alContarSegundo(restantes, estado);

    const cronometro = setInterval(function () {
      restantes = restantes - 1;
      if (restantes <= 0) {
        clearInterval(cronometro);
        alContarSegundo(0, estado);
        resolver();
      } else {
        alContarSegundo(restantes, estado);
      }
    }, 1000);
  });
}

/* ──────────────────────────────────────────────────────────
   apiGet — ÚNICO PUNTO DE ACCESO A LA API

   endpoint : "/get/games", "/get/teams", …
   opciones : { alReintentar, alContarSegundo }

   Resuelve SIEMPRE con { data, desdeCache, guardado }.
   Solo rechaza si se agotaron los reintentos Y no hay caché.
────────────────────────────────────────────────────────── */
function apiGet(endpoint, opciones) {
  const config = opciones || {};
  const alReintentar    = config.alReintentar    || function () {};
  const alContarSegundo = config.alContarSegundo || function () {};

  function intentar(numeroIntento) {
    return fetch(API_BASE + endpoint, {
      method: "GET",
      headers: { "Accept": "application/json" }
    }).then(
      /* ── La petición llegó al servidor ───────────────── */
      function (respuesta) {
        if (respuesta.ok) return respuesta.json();

        const esReintentable =
          ESTADOS_REINTENTABLES.indexOf(respuesta.status) !== -1;

        if (esReintentable && numeroIntento < MAX_REINTENTOS) {
          // Backoff exponencial: cada espera duplica la anterior.
          const espera = ESPERA_BASE_MS * Math.pow(2, numeroIntento);

          alReintentar({
            endpoint: endpoint,
            estado: respuesta.status,
            intento: numeroIntento + 1,
            de: MAX_REINTENTOS,
            espera: espera
          });

          return esperarConCuenta(espera, respuesta.status, alContarSegundo)
            .then(function () { return intentar(numeroIntento + 1); });
        }

        // 404 y demás errores permanentes: no se reintentan.
        const fallo = new Error("HTTP " + respuesta.status + " en " + endpoint);
        fallo.estado = respuesta.status;
        return Promise.reject(fallo);
      },

      /* ── Ni siquiera hubo respuesta (offline, DNS, CORS) ── */
      function (errorDeRed) {
        if (numeroIntento < MAX_REINTENTOS) {
          const espera = ESPERA_BASE_MS * Math.pow(2, numeroIntento);

          alReintentar({
            endpoint: endpoint,
            estado: 0,
            intento: numeroIntento + 1,
            de: MAX_REINTENTOS,
            espera: espera
          });

          return esperarConCuenta(espera, 0, alContarSegundo)
            .then(function () { return intentar(numeroIntento + 1); });
        }

        errorDeRed.estado = 0;
        return Promise.reject(errorDeRed);
      }
    );
  }

  return intentar(0)
    .then(function (datos) {
      guardarEnCache(endpoint, datos);
      return { data: datos, desdeCache: false, guardado: null };
    })
    .catch(function (error) {
      // Último recurso antes de rendirse: la copia en caché.
      const copia = leerDeCache(endpoint);
      if (copia) {
        console.warn("Sirviendo " + endpoint + " desde caché:", error.message);
        return { data: copia.data, desdeCache: true, guardado: copia.guardado };
      }
      return Promise.reject(error);
    });
}

/* ══════════════════════════════════════════════════════════
   BANNERS COMPARTIDOS
   Los cinco HTML declaran los mismos ids, así que estas
   funciones sirven a todas las pantallas sin cambios.
══════════════════════════════════════════════════════════ */

function uiAvisarReintento(info) {
  const banner = document.getElementById("bannerBackoff");
  const texto  = document.getElementById("bannerBackoffTexto");
  if (!banner || !texto) return;

  let mensaje;
  if (info.estado === 429) {
    mensaje = "Límite de peticiones alcanzado (429 Too Many Requests). " +
              "Reintento " + info.intento + " de " + info.de + " en";
  } else if (info.estado === 0) {
    mensaje = "Sin respuesta de la API. " +
              "Reintento " + info.intento + " de " + info.de + " en";
  } else {
    mensaje = "La API respondió " + info.estado + ". " +
              "Reintento " + info.intento + " de " + info.de + " en";
  }

  texto.textContent = mensaje;
  banner.classList.add("visible");
}

function uiTickCountdown(segundos) {
  const contador = document.getElementById("bannerBackoffCountdown");
  if (!contador) return;
  contador.textContent = segundos > 0 ? segundos + " s" : "…";
}

function uiOcultarBackoff() {
  const banner   = document.getElementById("bannerBackoff");
  const contador = document.getElementById("bannerBackoffCountdown");
  if (banner) banner.classList.remove("visible");
  if (contador) contador.textContent = "";
}

function uiAvisarDatosCacheados(guardado) {
  const banner = document.getElementById("bannerCache");
  const texto  = document.getElementById("bannerCacheTexto");
  if (!banner || !texto) return;

  texto.textContent =
    "Datos no actualizados: la API no respondió y se está mostrando " +
    "la última copia guardada" + formatearGuardado(guardado) + ".";
  banner.classList.add("visible");
}

function uiOcultarBannerCache() {
  const banner = document.getElementById("bannerCache");
  if (banner) banner.classList.remove("visible");
}

function formatearGuardado(guardado) {
  if (!guardado) return "";
  const fecha = new Date(guardado);
  if (isNaN(fecha.getTime())) return "";

  return " (" + fecha.toLocaleString("es-CR", {
    day: "numeric", month: "long", hour: "2-digit", minute: "2-digit"
  }) + ")";
}

/* ══════════════════════════════════════════════════════════
   UTILIDADES DE DATOS
   La API devuelve todo como string, así que estas dos
   funciones concentran la normalización.
══════════════════════════════════════════════════════════ */

/**
 * Parsea "MM/DD/YYYY HH:mm" sin depender del locale del navegador.
 * new Date("08/24/2026") es ambiguo entre motores; esto no lo es.
 * Acepta también la fecha sola, sin hora (la Agenda la usa así).
 */
function parsearFechaLocal(textoFecha) {
  if (!textoFecha) return new Date(NaN);

  const partes = String(textoFecha).trim().split(" ");
  const calendario = partes[0].split("/");
  if (calendario.length < 3) return new Date(NaN);

  const mes  = Number(calendario[0]);
  const dia  = Number(calendario[1]);
  const anio = Number(calendario[2]);

  let hora = 0;
  let minuto = 0;
  if (partes[1]) {
    const reloj = partes[1].split(":");
    hora   = Number(reloj[0]) || 0;
    minuto = Number(reloj[1]) || 0;
  }

  // mes - 1 porque en JavaScript los meses van de 0 a 11.
  return new Date(anio, mes - 1, dia, hora, minuto);
}

/**
 * Nombre legible de un equipo a partir de su id.
 * Los partidos de eliminatoria traen home_team_id "0" y un
 * rótulo descriptivo ("Winner Group A"); ese rótulo entra
 * como respaldo para que nunca se pinte "undefined".
 */
function nombreDeEquipo(teamId, equipos, respaldo) {
  const lista = equipos || [];
  const encontrado = lista.find(function (equipo) {
    return String(equipo.id) === String(teamId);
  });

  if (encontrado && encontrado.name_en) return encontrado.name_en;
  if (respaldo) return respaldo;
  return "Por definir";
}
