# 🏆 Laboratorio 2 · World Cup 2026 — Interfaces Interactivas y DOM Avanzado

> **ISW-521: Programación en Ambiente Web I** · Universidad Técnica Nacional, Sede San Carlos
> Laboratorio 02 - Categoria B
> **Estudiante:** Brandon Prado Mora

---

## 📋 Descripción

Aplicación web de **cinco pantallas independientes**, cada una implementando un subproyecto del catálogo de la Categoría B sobre la API pública [`worldcup26.ir`](https://worldcup26.ir). El foco del laboratorio no es el "camino feliz": cada pantalla implementa la **Arquitectura Base de Resiliencia** (backoff exponencial, countdown de 429, modo offline con `localStorage`) más su **reto de resiliencia específico**.

> Conforme a las indicaciones del profesor para este laboratorio, se omiten la autenticación JWT y la exigencia de `async/await`; las llamadas usan `fetch` con cadenas de promesas (`.then()/.catch()`), manteniendo la estructura del machote del curso.

## 🖥️ Las cinco pantallas

| # | Pantalla | Técnica DOM | Endpoints | Reto de resiliencia |
|---|----------|-------------|-----------|---------------------|
| 1 | **Tour Virtual de Sedes** (`worldcup26_tour_sedes.html`) | `scrollIntoView({behavior:'smooth'})` + estado activo | `/get/stadiums`, `/get/games` | Si `/get/games` falla, las 16 sedes siguen clicables; cada sección muestra un error local |
| 2 | **Agenda Simultánea** (`worldcup26_agenda.html`) | Agrupación por clave compuesta + layout dividido (CSS Grid) | `/get/games`, `/get/teams` | Sin datos → esqueletos de carga en cada columna; nunca pantalla en blanco |
| 3 | **Timeline Infinito** (`worldcup26_timeline.html`) | `IntersectionObserver` sobre centinela, bloques de 10 | `/get/games` | Error inicial → botón de reintento manual con backoff; sin duplicados al recuperar |
| 4 | **Dashboard del Fanático** (`worldcup26_dashboard.html`) | Tematización con variables CSS (`--acento`) + `localStorage` | `/get/teams`, `/get/games`, `/get/groups` | El favorito sobrevive al refresco; ante fallo se muestra el último estado cacheado |
| 5 | **Matriz de Enfrentamientos** (`worldcup26_matriz.html`) | Cuadrícula 4×4 por grupo, cruce de 3 recursos | `/get/groups`, `/get/teams`, `/get/games` | Si `/get/games` falla, matrices completas en "Pendiente"; al recuperar solo se actualizan celdas |

## 🛡️ Arquitectura de resiliencia

Toda la lógica de red vive en **`worldcup26_api.js`**, separada de la presentación:

- **`apiGet(endpoint, opciones)`** — punto único de acceso a la API:
  - **Backoff exponencial** ante `500` y `429`: reintentos automáticos con esperas de **1s → 2s → 4s → 8s** (máx. 4 reintentos).
  - **Countdown visible** en el `429`: el banner muestra los segundos restantes hasta el próximo reintento.
  - **Modo offline**: cada respuesta exitosa se guarda en `localStorage` (`wc26_cache:<endpoint>`); si una petición nueva agota los reintentos, se resuelve con la copia cacheada y la UI muestra el aviso de **"datos no actualizados"** con la fecha de guardado.
- Las pantallas solo reciben `{ data, desdeCache, guardado }` y deciden cómo pintarlo.

### Cumplimiento de prohibiciones absolutas

- ❌ Cero `alert()` — los errores se comunican con banners y estados en el DOM.
- ❌ Cero `window.location.reload()` — la recuperación es siempre por reintento en memoria.
- ✅ Estilo asíncrono consistente en todo el proyecto (cadenas de promesas, según la excepción indicada por el profesor).

## 📡 Notas sobre la API

- Todos los valores llegan como **string** (`"id": "37"`, `"pts": "0"`, `"finished": "FALSE"`), por lo que las comparaciones se hacen con `String()` y las operaciones numéricas con `Number()`.
- `local_date` viene en formato `MM/DD/YYYY HH:mm` y se parsea manualmente (`parsearFechaLocal`) para no depender del locale del navegador.
- Los partidos de eliminatoria sin equipos definidos traen `home_team_id: "0"` y un `home_team_label` descriptivo ("Winner Group A"), que se usa como respaldo.
- El rate limit público es de **120 peticiones/minuto por IP**; excederlo produce un `429` real, útil para la demostración de la defensa.

## 🚀 Ejecución

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/branprado8/lab2-worldcup26.git
   ```
2. Abrir la carpeta en **VS Code** y servir con la extensión **Live Server** (clic derecho sobre `index.html` → *Open with Live Server*).
3. Navegar entre pantallas desde el menú superior.

