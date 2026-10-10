// =============================================================
//  RANKING EN IMAGEN
//  Dibuja el ranking como una imagen (SVG → PNG con sharp), con el
//  estilo de la página: podio para el top 3 con la foto de Discord,
//  chapas de Premier con los colores del juego, nivel de FACEIT y
//  los destacados. La imagen no lleva la hora: si los datos no
//  cambian, sale idéntica y no hace falta volver a subirla.
// =============================================================

import { createHash } from "node:crypto";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ANCHO = 1200;
const VERDE = "#22e36b";
const FUENTE = "Rajdhani, DejaVu Sans, sans-serif";

// Colores del CS Rating de Premier, como en el juego
export function colorPremier(premier) {
  if (premier == null) return "#5b6670";
  if (premier < 5000) return "#b0c3d9";
  if (premier < 10000) return "#8cc6ff";
  if (premier < 15000) return "#6a7dff";
  if (premier < 20000) return "#c166ff";
  if (premier < 25000) return "#f03cff";
  if (premier < 30000) return "#eb4b4b";
  return "#ffd700";
}

// Colores oficiales de los niveles de FACEIT
export function colorFaceit(nivel) {
  if (nivel == null) return "#5b6670";
  if (nivel === 1) return "#eeeeee";
  if (nivel <= 3) return "#1ce400";
  if (nivel <= 7) return "#ffc800";
  if (nivel <= 9) return "#ff6309";
  return "#fe1f00";
}

const PODIO = ["#ffd54a", "#d4dde6", "#e3925a"]; // oro, plata, bronce

export const escapar = (t) =>
  String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]);

const cortar = (t, n) => (t.length > n ? t.slice(0, n - 1) + "…" : t);
// Como en el juego: 18,926
const premierTexto = (p) => (p == null ? "SIN RANGO" : p.toLocaleString("en-US"));
const miles = (n) => Number(n).toLocaleString("es-AR");

// Chapa de Premier: un paralelogramo del color del rango con el número
function chapa(x, y, premier, alto = 46, ancho = 170) {
  const c = colorPremier(premier);
  const s = alto * 0.32;
  return `<g>
    <polygon points="${x + s},${y} ${x + ancho},${y} ${x + ancho - s},${y + alto} ${x},${y + alto}" fill="${c}" fill-opacity="0.18" stroke="${c}" stroke-width="2.5"/>
    <polygon points="${x + s + 6},${y + 5} ${x + s + 16},${y + 5} ${x + 10},${y + alto - 5} ${x},${y + alto - 5}" fill="${c}"/>
    <text x="${x + ancho / 2 + 6}" y="${y + alto * (premier == null ? 0.66 : 0.74)}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="${alto * (premier == null ? 0.44 : 0.68)}" letter-spacing="${premier == null ? 2 : 0}" fill="${premier == null ? "#8a949c" : "#ffffff"}">${premierTexto(premier)}</text>
  </g>`;
}

// Insignia de FACEIT: círculo del color del nivel + ELO al lado
function faceit(x, y, nivel, elo, r = 19) {
  if (nivel == null) {
    return `<text x="${x}" y="${y + 7}" font-family="${FUENTE}" font-weight="600" font-size="22" fill="#5b6670">SIN FACEIT</text>`;
  }
  const c = colorFaceit(nivel);
  return `<g>
    <circle cx="${x + r}" cy="${y}" r="${r}" fill="#0b0f0d" stroke="${c}" stroke-width="3.5"/>
    <text x="${x + r}" y="${y + r * 0.42}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="${r * 1.2}" fill="${c}">${nivel}</text>
    <text x="${x + r * 2 + 10}" y="${y + 8}" font-family="${FUENTE}" font-weight="600" font-size="24" fill="#cfd8dc">${elo ? `${elo} ELO` : "FACEIT"}</text>
  </g>`;
}

// ▲ +322 en verde, ▼ −150 en rojo. Sin dato o sin cambio, nada.
function cambio(x, y, delta, tamaño = 30, ancla = "end") {
  if (!delta) return "";
  const sube = delta > 0;
  return `<text x="${x}" y="${y}" text-anchor="${ancla}" font-family="${FUENTE}" font-weight="700" font-size="${tamaño}" fill="${sube ? "#4dff88" : "#ff5c5c"}">${sube ? "▲" : "▼"} ${sube ? "+" : "−"}${miles(Math.abs(delta))}</text>`;
}

// 4. Aim · HS · winrate, para el espacio de abajo de las tarjetas del podio
function miniStats(cx, y, j) {
  const partes = [
    j.aim != null && `AIM <tspan fill="#ffffff">${Math.round(j.aim)}</tspan>`,
    j.hs != null && `HS <tspan fill="#ffffff">${Math.round(j.hs)}%</tspan>`,
    j.winrate != null && `WR <tspan fill="#ffffff">${Math.round(j.winrate * 100)}%</tspan>`,
  ].filter(Boolean);
  if (!partes.length) return "";
  return `<text x="${cx}" y="${y}" text-anchor="middle" font-family="${FUENTE}" font-weight="600" font-size="23" letter-spacing="1" fill="#8fb39d">${partes.join('<tspan fill="#5f9a76" font-weight="700"> · </tspan>')}</text>`;
}

function avatar(id, cx, cy, r, color, dataUrl) {
  const relleno = dataUrl
    ? `<image href="${dataUrl}" x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" clip-path="url(#av-${id})" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1b2a21"/>`;
  return `<clipPath id="av-${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
    <circle cx="${cx}" cy="${cy}" r="${r + 7}" fill="none" stroke="${color}" stroke-width="5" filter="url(#neon)"/>
    ${relleno}`;
}

function tarjetaPodio(j, puesto, cx, base, alto, avatares, cambios) {
  const ancho = 300;
  const x = cx - ancho / 2;
  const y = base - alto;
  const color = PODIO[puesto - 1];
  const r = puesto === 1 ? 62 : 52;
  const cyAv = y + 40 + r;
  const corona =
    puesto === 1
      ? `<polygon points="${cx - 34},${y - 6} ${cx - 34},${y - 40} ${cx - 17},${y - 22} ${cx},${y - 48} ${cx + 17},${y - 22} ${cx + 34},${y - 40} ${cx + 34},${y - 6}" fill="${color}" filter="url(#neon)"/>`
      : "";
  return `<g>
    <rect x="${x}" y="${y}" width="${ancho}" height="${alto}" rx="22" fill="url(#tarjeta)" stroke="${color}" stroke-opacity="0.85" stroke-width="2.5"/>
    <rect x="${x}" y="${y}" width="${ancho}" height="8" rx="4" fill="${color}"/>
    ${corona}
    <text x="${x + 22}" y="${y + 52}" font-family="${FUENTE}" font-weight="700" font-size="44" fill="${color}">#${puesto}</text>
    ${cambio(x + ancho - 20, y + 48, cambios[j.usuarioId], 28)}
    ${avatar(`p${puesto}`, cx, cyAv, r, colorPremier(j.premier), avatares[j.usuarioId])}
    <text x="${cx}" y="${cyAv + r + 48}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="36" fill="#ffffff">${escapar(cortar(j.nombre, 14))}</text>
    ${chapa(cx - 95, cyAv + r + 66, j.premier, 50, 190)}
    ${faceit(cx - 70, cyAv + r + 152, j.faceit, j.faceitElo)}
    ${miniStats(cx, cyAv + r + 205, j)}
  </g>`;
}

function fila(j, puesto, y, avatares, cambios) {
  return `<g>
    <rect x="40" y="${y}" width="${ANCHO - 80}" height="62" rx="14" fill="#ffffff" fill-opacity="${puesto % 2 ? 0.035 : 0.06}"/>
    <text x="78" y="${y + 42}" text-anchor="middle" font-family="${FUENTE}" font-weight="700" font-size="30" fill="#7fe0a5">#${puesto}</text>
    ${avatar(`f${puesto}`, 150, y + 31, 22, colorPremier(j.premier), avatares[j.usuarioId])}
    <text x="192" y="${y + 41}" font-family="${FUENTE}" font-weight="700" font-size="30" fill="#ffffff">${escapar(cortar(j.nombre, 22))}</text>
    ${cambio(668, y + 42, cambios[j.usuarioId], 26)}
    ${chapa(690, y + 9, j.premier, 44, 175)}
    ${faceit(930, y + 31, j.faceit, j.faceitElo, 17)}
  </g>`;
}

function destacados(jugadores) {
  const mejor = (campo) => {
    const con = jugadores.filter((j) => j[campo] != null);
    return con.length ? con.reduce((a, b) => (b[campo] > a[campo] ? b : a)) : null;
  };
  return [
    ["MEJOR AIM", mejor("aim"), (j) => Math.round(j.aim)],
    ["MÁS HEADSHOTS", mejor("hs"), (j) => `${Math.round(j.hs)}%`],
    ["MEJOR WINRATE", mejor("winrate"), (j) => `${Math.round(j.winrate * 100)}%`],
    ["MÁS PARTIDAS", mejor("partidas"), (j) => miles(j.partidas)],
  ].filter(([, j]) => j);
}

export function svgRanking(jugadores, { semana = null, avatares = {}, cambios = {} } = {}) {
  const top = jugadores.slice(0, 3);
  const resto = jugadores.slice(3, 15);
  const altoPodio = top.length ? 425 : 0;
  const inicioFilas = 200 + altoPodio + 20;
  const finFilas = inicioFilas + resto.length * 72;
  const items = destacados(jugadores);
  const altoDestacados = items.length ? 150 : 0;
  const ALTO = finFilas + altoDestacados + 40;

  // Podio: el 1 al medio y más alto, el 2 a la izquierda, el 3 a la derecha
  const base = 200 + altoPodio;
  const lugares = [
    [600, 415],
    [270, 385],
    [930, 375],
  ];
  const podio = top.map((j, i) => tarjetaPodio(j, i + 1, lugares[i][0], base, lugares[i][1], avatares, cambios)).join("");

  const lider = semana?.actual;
  const chipSemana = lider
    ? `<g>
        <rect x="770" y="58" width="390" height="96" rx="20" fill="#ffd54a" fill-opacity="0.08" stroke="#ffd54a" stroke-opacity="0.7" stroke-width="2"/>
        <text x="795" y="94" font-family="${FUENTE}" font-weight="600" font-size="22" letter-spacing="3" fill="#ffd54a">JUGADOR DE LA SEMANA</text>
        <text x="795" y="136" font-family="${FUENTE}" font-weight="700" font-size="36" fill="#ffffff">${escapar(cortar(lider.nombre, 13))} <tspan fill="#7dff9e">+${miles(lider.subio)}</tspan></text>
      </g>`
    : "";

  const anchoItem = (ANCHO - 80 - 3 * 16) / 4;
  const cajas = items
    .map(([titulo, j, valor], i) => {
      const x = 40 + i * (anchoItem + 16);
      return `<g>
        <rect x="${x}" y="${finFilas + 24}" width="${anchoItem}" height="110" rx="18" fill="url(#tarjeta)" stroke="${VERDE}" stroke-opacity="0.35" stroke-width="2"/>
        <text x="${x + 22}" y="${finFilas + 60}" font-family="${FUENTE}" font-weight="600" font-size="20" letter-spacing="2.5" fill="${VERDE}">${titulo}</text>
        <text x="${x + 22}" y="${finFilas + 112}" font-family="${FUENTE}" font-weight="700" font-size="40" fill="#ffffff">${valor(j)}</text>
        <text x="${x + anchoItem - 20}" y="${finFilas + 112}" text-anchor="end" font-family="${FUENTE}" font-weight="600" font-size="26" fill="#9fb3a8">${escapar(cortar(j.nombre, 10))}</text>
      </g>`;
    })
    .join("");

  let seed = 5;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const puntos = Array.from({ length: 80 }, () => {
    const x = rnd() * ANCHO, y = rnd() * ALTO, r = 0.8 + rnd() * 2, o = 0.12 + rnd() * 0.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${VERDE}" opacity="${o.toFixed(2)}"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#050a07"/><stop offset="1" stop-color="#0b1a11"/></linearGradient>
    <radialGradient id="brillo" cx="0.5" cy="0.32" r="0.6"><stop offset="0" stop-color="${VERDE}" stop-opacity="0.22"/><stop offset="1" stop-color="${VERDE}" stop-opacity="0"/></radialGradient>
    <linearGradient id="tarjeta" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#13261a" stop-opacity="0.95"/><stop offset="1" stop-color="#0a140e" stop-opacity="0.95"/></linearGradient>
    <linearGradient id="titulo" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#b9f7cf"/></linearGradient>
    <filter id="neon" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#fondo)"/>
  <rect width="${ANCHO}" height="${ALTO}" fill="url(#brillo)"/>
  ${puntos}
  <text x="40" y="78" font-family="${FUENTE}" font-weight="600" font-size="26" letter-spacing="9" fill="${VERDE}">BROSSS</text>
  <text x="36" y="150" font-family="${FUENTE}" font-weight="700" font-size="88" letter-spacing="3" fill="${VERDE}" opacity="0.55" filter="url(#sombra)">RANKING CS2</text>
  <text x="36" y="150" font-family="${FUENTE}" font-weight="700" font-size="88" letter-spacing="3" fill="url(#titulo)">RANKING CS2</text>
  ${chipSemana}
  ${podio}
  ${resto.map((j, i) => fila(j, i + 4, inicioFilas + i * 72, avatares, cambios)).join("")}
  ${cajas}
  <rect x="0" y="${ALTO - 6}" width="${ANCHO}" height="6" fill="${VERDE}"/>
</svg>`;
}

// Huella corta de la imagen: si no cambia, no se vuelve a subir
export const huella = (svg) => createHash("sha1").update(svg).digest("hex").slice(0, 10);

// Le dice a sharp dónde está Rajdhani (assets/fuentes) antes de cargarlo
function prepararFuentes() {
  if (process.env.FONTCONFIG_FILE) return;
  const fuentes = fileURLToPath(new URL("../assets/fuentes/", import.meta.url));
  const dir = mkdtempSync(join(tmpdir(), "brosss-fc-"));
  const conf = join(dir, "fonts.conf");
  writeFileSync(
    conf,
    `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${fuentes}</dir><dir>/usr/share/fonts</dir><cachedir>${dir}</cachedir></fontconfig>`
  );
  process.env.FONTCONFIG_FILE = conf;
}

export async function renderizar(svg) {
  prepararFuentes();
  const { default: sharp } = await import("sharp");
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

// Fotos de Discord como data URL (para meterlas en el SVG)
export async function cargarAvatares(jugadores, pedir) {
  const avatares = {};
  await Promise.all(
    jugadores.map(async (j) => {
      if (!j.avatar) return;
      try {
        const res = await pedir(j.avatar);
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        avatares[j.usuarioId] = `data:image/png;base64,${buf.toString("base64")}`;
      } catch {
        // Sin foto: se dibuja un círculo vacío
      }
    })
  );
  return avatares;
}
