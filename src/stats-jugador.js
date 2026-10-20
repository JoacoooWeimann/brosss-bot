// =============================================================
//  /stats y /comparar
//  Con los datos que deja el bot en datos/jugadores.json:
//   /stats @jugador          → su ficha: rangos, puntos fuertes,
//                              qué mejorar y en qué rol encaja.
//   /comparar @uno @otro     → los dos lado a lado, stat por stat.
//  Los "puntos fuertes" se comparan contra el resto de los vinculados.
// =============================================================

import { ROLES, puntajesRelativos, puntajeRol, encaje, barra, colorPremier } from "./formacion.js";

const r = Math.round;
const miles = (n) => Number(n).toLocaleString("es-AR");

// [nombre, formato, menos es mejor]
export const AREAS = {
  aim: ["Aim", (v) => `${r(v)}`],
  hs: ["Headshots", (v) => `${r(v)}%`],
  precision: ["Precisión", (v) => `${r(v)}%`],
  preaim: ["Preaim", (v) => `${v.toFixed(1)}°`, true],
  reaccion: ["Reacción", (v) => `${r(v)} ms`, true],
  spray: ["Control de spray", (v) => `${r(v)}%`],
  counterstrafe: ["Counter-strafe", (v) => `${r(v)}%`],
  utilidad: ["Utilidad", (v) => `${r(v)}`],
  flashes: ["Enemigos por flash", (v) => v.toFixed(2)],
  posicionamiento: ["Posicionamiento", (v) => `${r(v)}`],
  tradeKills: ["Tradeos", (v) => `${r(v)}%`],
  clutch: ["Clutch", (v) => (v * 100).toFixed(1)],
  apertura: ["Apertura", (v) => (v * 100).toFixed(1)],
  entradaT: ["Entradas como T", (v) => `${r(v)}%`],
};

const valor = (datos, k) => (k === "winrate" || k === "partidas" ? datos?.[k] : datos?.areas?.[k]);
export const urlLeetify = (steamId) => (steamId ? `https://leetify.com/app/profile/${steamId}` : null);

// Qué tan arriba o abajo del resto de los vinculados está en cada área
function zContraElServer(usuarioId, todos) {
  const lista = Object.entries(todos).map(([id, datos]) => ({ id, datos }));
  const z = puntajesRelativos(lista);
  const i = lista.findIndex((j) => j.id === usuarioId);
  return i >= 0 ? z[i] : {};
}

// El rol en el que mejor encaja, comparado con el resto del server
export function rolIdeal(usuarioId, todos) {
  const z = zContraElServer(usuarioId, todos);
  const [rol, puntaje] = Object.keys(ROLES).map((k) => [k, puntajeRol(z, k)]).sort((a, b) => b[1] - a[1])[0];
  return { rol, encaje: encaje(puntaje) };
}

// Puntos fuertes y débiles: las áreas más arriba y más abajo del promedio del server
export function fuertesYDebiles(usuarioId, todos, cuantos = 3) {
  const datos = todos[usuarioId];
  const lista = Object.entries(todos).map(([id, d]) => ({ id, datos: d }));
  // z de cada área (incluidas las que no usan los roles)
  const z = {};
  for (const [k, [, , menos]] of Object.entries(AREAS)) {
    const valores = lista.map((j) => valor(j.datos, k)).filter((v) => typeof v === "number");
    const v = valor(datos, k);
    if (typeof v !== "number" || valores.length < 2) continue;
    const media = valores.reduce((a, b) => a + b, 0) / valores.length;
    const desvio = Math.sqrt(valores.reduce((a, x) => a + (x - media) ** 2, 0) / valores.length);
    if (desvio > 0) z[k] = ((v - media) / desvio) * (menos ? -1 : 1);
  }
  const orden = Object.entries(z).sort((a, b) => b[1] - a[1]);
  const texto = ([k]) => `**${AREAS[k][0]}** · ${AREAS[k][1](valor(datos, k))}`;
  return {
    fuertes: orden.filter(([, v]) => v > 0).slice(0, cuantos).map(texto),
    debiles: orden.filter(([, v]) => v < 0).slice(-2).reverse().map(texto),
  };
}

export function mensajeStats(usuarioId, todos) {
  const d = todos[usuarioId];
  const { fuertes, debiles } = fuertesYDebiles(usuarioId, todos);
  const { rol, encaje: enc } = rolIdeal(usuarioId, todos);
  const leetify = urlLeetify(d.steamId);
  return {
    embeds: [
      {
        title: `📊 Stats de ${d.nombre}`,
        url: leetify ?? undefined,
        description: `<@${usuarioId}>`,
        color: colorPremier(d.premier),
        thumbnail: d.avatar ? { url: d.avatar } : undefined,
        fields: [
          { name: "📈 Premier", value: d.premier != null ? `**${miles(d.premier)}**` : "Sin rango", inline: true },
          { name: "🟧 FACEIT", value: d.faceit != null ? `**Nivel ${d.faceit}**` : "—", inline: true },
          { name: "🏆 Winrate", value: d.winrate != null ? `**${r(d.winrate * 100)}%**` : "—", inline: true },
          { name: "🎮 Partidas", value: d.partidas != null ? miles(d.partidas) : "—", inline: true },
          { name: "🎯 Aim", value: d.areas?.aim != null ? `${r(d.areas.aim)}` : "—", inline: true },
          { name: "💀 Headshots", value: d.areas?.hs != null ? `${r(d.areas.hs)}%` : "—", inline: true },
          { name: "💪 Puntos fuertes", value: fuertes.join("\n") || "—", inline: true },
          { name: "📉 Para mejorar", value: debiles.join("\n") || "—", inline: true },
          { name: `${ROLES[rol].emoji} Rol ideal: ${ROLES[rol].nombre}`, value: barra(enc), inline: false },
        ],
        footer: { text: "Comparado con el resto de los vinculados del server · datos de Leetify" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}

// Las stats que se comparan en /comparar
const COMPARAR = [
  ["Premier", (d) => d.premier, (v) => miles(v)],
  ["FACEIT", (d) => d.faceit, (v) => `Nv ${v}`],
  ["Winrate", (d) => d.winrate, (v) => `${r(v * 100)}%`],
  ...Object.entries(AREAS).map(([k, [nombre, formato, menos]]) => [nombre, (d) => d.areas?.[k], formato, menos]),
];

const ANCHO = 9;
const celda = (t, n = ANCHO) => (t.length > n ? t.slice(0, n - 1) + "…" : t);

export function mensajeComparar(idA, idB, todos) {
  const a = todos[idA];
  const b = todos[idB];
  let ganaA = 0;
  let ganaB = 0;
  const filas = [];
  for (const [nombre, sacar, formato, menos] of COMPARAR) {
    const va = sacar(a);
    const vb = sacar(b);
    if (typeof va !== "number" || typeof vb !== "number") continue;
    const mejorA = menos ? va < vb : va > vb;
    const mejorB = menos ? vb < va : vb > va;
    if (mejorA) ganaA++;
    if (mejorB) ganaB++;
    const flecha = mejorA ? "◀" : mejorB ? "▶" : "=";
    filas.push(`${celda(nombre, 16).padEnd(16)} ${formato(va).padStart(7)} ${flecha} ${formato(vb).padEnd(7)}`);
  }
  const cabecera = `${"".padEnd(16)} ${celda(a.nombre, 7).padStart(7)}   ${celda(b.nombre, 7)}`;
  const ganador = ganaA === ganaB ? "🤝 **Empate**" : `🏆 **${ganaA > ganaB ? a.nombre : b.nombre}** gana en ${Math.max(ganaA, ganaB)} de ${filas.length}`;
  const rolA = rolIdeal(idA, todos);
  const rolB = rolIdeal(idB, todos);
  return {
    embeds: [
      {
        title: `⚔️ ${a.nombre} vs ${b.nombre}`,
        description: `<@${idA}> vs <@${idB}>\n\`\`\`\n${cabecera}\n${filas.join("\n")}\n\`\`\`\n${ganador}`,
        color: colorPremier(Math.max(a.premier ?? 0, b.premier ?? 0) || null),
        fields: [
          { name: `Rol ideal de ${a.nombre}`, value: `${ROLES[rolA.rol].emoji} ${ROLES[rolA.rol].nombre} · ${rolA.encaje}%`, inline: true },
          { name: `Rol ideal de ${b.nombre}`, value: `${ROLES[rolB.rol].emoji} ${ROLES[rolB.rol].nombre} · ${rolB.encaje}%`, inline: true },
        ],
        footer: { text: "◀ ▶ marca quién es mejor en cada stat · datos de Leetify" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
