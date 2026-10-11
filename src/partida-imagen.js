// =============================================================
//  PARTIDA EN IMAGEN (#historial)
//  La tabla de la partida completa, como el scoreboard del juego:
//  mapa, resultado, los 5 de cada equipo con K/D/A, ADR, HS% y
//  rating de Leetify, los vinculados resaltados y el MVP con corona.
// =============================================================

import { escapar } from "./ranking-imagen.js";

const ANCHO = 1200;
const VERDE = "#22e36b";
const ROJO = "#ff4d4d";
const FUENTE = "Rajdhani, DejaVu Sans, sans-serif";

const MODOS = {
  matchmaking: "PREMIER",
  matchmaking_competitive: "COMPETITIVO",
  matchmaking_wingman: "WINGMAN",
  faceit: "FACEIT",
  renown: "RENOWN",
};

export function nombreMapa(mapa) {
  const m = String(mapa || "");
  if (m === "de_dust2") return "DUST II";
  const sin = m.replace(/^(de|cs|ar)_/, "");
  return sin ? sin.toUpperCase() : "MAPA";
}

const cortar = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

// Los números de cada jugador, listos para mostrar
export function statsJugador(s) {
  const adr = s.dpr != null ? Math.round(s.dpr) : s.rounds_count ? Math.round(s.total_damage / s.rounds_count) : null;
  const hs = s.total_kills ? Math.round(((s.total_hs_kills ?? 0) / s.total_kills) * 100) : 0;
  const rating = typeof s.leetify_rating === "number" ? Math.round(s.leetify_rating * 1000) / 10 : null;
  return { k: s.total_kills ?? 0, d: s.total_deaths ?? 0, a: s.total_assists ?? 0, adr, hs, rating, mvps: s.mvps ?? 0 };
}

// Arma los dos equipos: el de los vinculados ("nosotros") y los rivales
export function armarEquipos(detalle, vinculados) {
  const porSteam = new Map(vinculados.map((v) => [v.steamId, v]));
  const filas = (detalle.stats ?? []).map((s) => ({
    steamId: s.steam64_id,
    nombre: porSteam.get(s.steam64_id)?.nombre ?? String(s.name ?? "Jugador"),
    vinculado: porSteam.has(s.steam64_id),
    equipo: s.initial_team_number,
    ganados: s.rounds_won ?? 0,
    perdidos: s.rounds_lost ?? 0,
    ...statsJugador(s),
  }));
  const nuestro = filas.find((f) => f.vinculado)?.equipo ?? filas[0]?.equipo;
  const orden = (a, b) => b.k - a.k || (b.rating ?? -99) - (a.rating ?? -99);
  const nosotros = filas.filter((f) => f.equipo === nuestro).sort(orden);
  const rivales = filas.filter((f) => f.equipo !== nuestro).sort(orden);
  // El MVP de la partida: el de mejor rating de todos
  const mvp = filas.reduce((m, f) => ((f.rating ?? -99) > (m?.rating ?? -99) ? f : m), null);
  const ref = nosotros[0];
  return { nosotros, rivales, mvp: mvp?.steamId ?? null, ganados: ref?.ganados ?? 0, perdidos: ref?.perdidos ?? 0 };
}

const COLUMNAS = [
  ["MVP", 560],
  ["K", 640],
  ["D", 715],
  ["A", 790],
  ["ADR", 885],
  ["HS%", 990],
  ["RATING", 1110],
];

function bloque(titulo, color, jugadores, y, mvp) {
  const cabecera = `<text x="60" y="${y + 34}" font-family="${FUENTE}" font-weight="700" font-size="30" letter-spacing="4" fill="${color}">${titulo}</text>
    ${COLUMNAS.map(([c, x]) => `<text x="${x}" y="${y + 34}" text-anchor="middle" font-family="${FUENTE}" font-weight="600" font-size="22" letter-spacing="2" fill="#7f9a8a">${c}</text>`).join("")}`;
  const filas = jugadores
    .map((j, i) => {
      const fy = y + 52 + i * 58;
      const fondo = j.vinculado
        ? `<rect x="40" y="${fy}" width="${ANCHO - 80}" height="50" rx="12" fill="${VERDE}" fill-opacity="0.14" stroke="${VERDE}" stroke-opacity="0.6"/>
           <rect x="40" y="${fy}" width="7" height="50" rx="3" fill="${VERDE}"/>`
        : `<rect x="40" y="${fy}" width="${ANCHO - 80}" height="50" rx="12" fill="#ffffff" fill-opacity="${i % 2 ? 0.03 : 0.055}"/>`;
      const corona =
        j.steamId === mvp
          ? `<polygon points="70,${fy + 36} 70,${fy + 16} 79,${fy + 25} 88,${fy + 12} 97,${fy + 25} 106,${fy + 16} 106,${fy + 36}" fill="#ffd54a"/>`
          : "";
      const xNombre = j.steamId === mvp ? 118 : 70;
      const ratingColor = j.rating == null ? "#7f9a8a" : j.rating >= 0 ? "#4dff88" : "#ff6b6b";
      const valores = [
        j.mvps ? `★${j.mvps}` : "",
        j.k, j.d, j.a, j.adr ?? "—", `${j.hs}%`,
        j.rating == null ? "—" : `${j.rating > 0 ? "+" : ""}${j.rating.toFixed(1)}`,
      ];
      const colorDe = (k) => (k === 0 ? "#ffd54a" : k === valores.length - 1 ? ratingColor : "#ffffff");
      return `<g>${fondo}${corona}
        <text x="${xNombre}" y="${fy + 34}" font-family="${FUENTE}" font-weight="700" font-size="28" fill="${j.vinculado ? "#ffffff" : "#c9d6cf"}">${escapar(cortar(j.nombre, 22))}</text>
        ${valores
          .map(
            (v, k) =>
              `<text x="${COLUMNAS[k][1]}" y="${fy + 34}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="${k === 0 ? 24 : 28}" fill="${colorDe(k)}">${v}</text>`
          )
          .join("")}
      </g>`;
    })
    .join("");
  return cabecera + filas;
}

export function svgPartida(detalle, vinculados) {
  const { nosotros, rivales, mvp, ganados, perdidos } = armarEquipos(detalle, vinculados);
  const resultado = ganados > perdidos ? ["VICTORIA", VERDE] : ganados < perdidos ? ["DERROTA", ROJO] : ["EMPATE", "#c9d6cf"];
  const alto1 = 52 + nosotros.length * 58;
  const alto2 = 52 + rivales.length * 58;
  const y1 = 200;
  const y2 = y1 + alto1 + 30;
  const ALTO = y2 + alto2 + 40;
  const modo = MODOS[detalle.data_source] ?? "PARTIDA";

  let seed = 9;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const puntos = Array.from({ length: 50 }, () => `<circle cx="${(rnd() * ANCHO).toFixed(1)}" cy="${(rnd() * ALTO).toFixed(1)}" r="${(0.8 + rnd() * 1.8).toFixed(1)}" fill="${VERDE}" opacity="${(0.1 + rnd() * 0.35).toFixed(2)}"/>`).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050a07"/><stop offset="1" stop-color="#0b1a11"/></linearGradient>
    <radialGradient id="brillo" cx="0.15" cy="0.1" r="0.6"><stop offset="0" stop-color="${resultado[1]}" stop-opacity="0.22"/><stop offset="1" stop-color="${resultado[1]}" stop-opacity="0"/></radialGradient>
    <linearGradient id="titulo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9f7cf"/></linearGradient>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)"/>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>
  ${puntos}
  <text x="44" y="62" font-family="${FUENTE}" font-weight="600" font-size="24" letter-spacing="7" fill="${VERDE}">${modo}</text>
  <text x="40" y="150" font-family="${FUENTE}" font-weight="700" font-size="96" letter-spacing="3" fill="${resultado[1]}" opacity="0.45" filter="url(#sombra)">${nombreMapa(detalle.map_name)}</text>
  <text x="40" y="150" font-family="${FUENTE}" font-weight="700" font-size="96" letter-spacing="3" fill="url(#titulo)">${nombreMapa(detalle.map_name)}</text>
  <text x="${ANCHO - 44}" y="70" text-anchor="end" font-family="${FUENTE}" font-weight="700" font-size="34" letter-spacing="6" fill="${resultado[1]}">${resultado[0]}</text>
  <text x="${ANCHO - 44}" y="152" text-anchor="end" font-family="${FUENTE}" font-weight="700" font-size="92" fill="#ffffff">${ganados}<tspan fill="#5f7a6a"> – </tspan>${perdidos}</text>
  <rect x="40" y="176" width="${ANCHO - 80}" height="3" rx="1.5" fill="${resultado[1]}" fill-opacity="0.6"/>
  ${bloque("NUESTRO EQUIPO", VERDE, nosotros, y1, mvp)}
  ${bloque("RIVALES", ROJO, rivales, y2, mvp)}
  <rect x="0" y="${ALTO - 6}" width="${ANCHO}" height="6" fill="${resultado[1]}"/>
</svg>`;
}
