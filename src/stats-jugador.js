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

const EMOJI_PREMIER = (p) =>
  p == null ? "⚫" : p < 5000 ? "⚪" : p < 10000 ? "🩵" : p < 15000 ? "🔵" : p < 20000 ? "🟣" : p < 25000 ? "🩷" : p < 30000 ? "🔴" : "🟡";

// Los roles ordenados de mejor a peor para él, comparado con el resto del server
export function rolesIdeales(usuarioId, todos, cuantos = 3) {
  const z = zContraElServer(usuarioId, todos);
  return Object.keys(ROLES)
    .map((rol) => ({ rol, encaje: encaje(puntajeRol(z, rol)) }))
    .sort((a, b) => b.encaje - a.encaje)
    .slice(0, cuantos);
}
export const rolIdeal = (usuarioId, todos) => rolesIdeales(usuarioId, todos, 1)[0];

// En qué lugar está entre los vinculados para esa área, de 0 (el peor) a 1 (el mejor)
function percentil(usuarioId, todos, k) {
  const menos = AREAS[k]?.[2];
  const propio = valor(todos[usuarioId], k);
  const otros = Object.entries(todos).filter(([id]) => id !== usuarioId).map(([, d]) => valor(d, k)).filter((v) => typeof v === "number");
  if (typeof propio !== "number" || !otros.length) return null;
  const peores = otros.filter((v) => (menos ? v > propio : v < propio)).length;
  const iguales = otros.filter((v) => v === propio).length;
  return (peores + iguales / 2) / otros.length;
}

const cuadritos = (p, largo = 5) => {
  const llenos = Math.max(0, Math.min(largo, Math.round(p * largo)));
  const color = p >= 0.67 ? "🟩" : p >= 0.34 ? "🟨" : "🟥";
  return color.repeat(llenos) + "⬛".repeat(largo - llenos);
};

// Puntos fuertes y débiles: las áreas más arriba y más abajo del promedio del server
export function fuertesYDebiles(usuarioId, todos, cuantos = 3) {
  const datos = todos[usuarioId];
  const lista = Object.entries(todos).map(([id, d]) => ({ id, datos: d }));
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
    debiles: orden.filter(([, v]) => v < 0).slice(-cuantos).reverse().map(texto),
  };
}

const RENDIMIENTO = [
  ["aim", "🎯"], ["hs", "💀"], ["preaim", "📐"],
  ["reaccion", "⚡"], ["spray", "🔫"], ["counterstrafe", "🦶"],
  ["utilidad", "💨"], ["posicionamiento", "🧭"], ["clutch", "🥷"],
];

export function mensajeStats(usuarioId, todos) {
  const d = todos[usuarioId];
  const { fuertes, debiles } = fuertesYDebiles(usuarioId, todos);
  const roles = rolesIdeales(usuarioId, todos);
  const leetify = urlLeetify(d.steamId);
  const datosRapidos = [
    d.faceit != null ? `🟧 FACEIT **nivel ${d.faceit}**` : null,
    d.winrate != null ? `🏆 **${r(d.winrate * 100)}%** winrate` : null,
    d.partidas != null ? `🎮 **${miles(d.partidas)}** partidas` : null,
  ].filter(Boolean);

  const portada = {
    author: { name: "FICHA DE JUGADOR · BROSSS" },
    title: d.nombre,
    url: leetify ?? undefined,
    description: [
      `<@${usuarioId}>`,
      `## ${EMOJI_PREMIER(d.premier)} ${d.premier != null ? miles(d.premier) : "Sin rango de Premier"}`,
      datosRapidos.join("  ·  "),
    ].join("\n"),
    color: colorPremier(d.premier),
    thumbnail: d.avatar ? { url: d.avatar } : undefined,
  };

  const rendimiento = {
    title: "📊 Rendimiento",
    description: "-# La barra muestra dónde está entre los vinculados del server (🟩 de los mejores · 🟥 de los que más tienen que mejorar)",
    color: 0x22e36b,
    fields: RENDIMIENTO.filter(([k]) => typeof valor(d, k) === "number").map(([k, emoji]) => {
      const p = percentil(usuarioId, todos, k);
      return { name: `${emoji} ${AREAS[k][0]}`, value: `**${AREAS[k][1](valor(d, k))}**${p != null ? `\n${cuadritos(p)}` : ""}`, inline: true };
    }),
  };

  const medallas = ["🥇", "🥈", "🥉"];
  const tarjetaRoles = {
    title: "🎯 Roles ideales",
    description: roles.map((x, i) => `${medallas[i]} ${ROLES[x.rol].emoji} **${ROLES[x.rol].nombre}**\n${barra(x.encaje)}`).join("\n\n"),
    color: ROLES[roles[0].rol].color,
  };

  const resumen = {
    color: 0x22e36b,
    fields: [
      { name: "💪 Puntos fuertes", value: fuertes.join("\n") || "—", inline: true },
      { name: "📉 Para mejorar", value: debiles.join("\n") || "—", inline: true },
    ],
    footer: { text: "Comparado con el resto de los vinculados del server · datos de Leetify" },
  };

  return { embeds: [portada, rendimiento, tarjetaRoles, resumen], allowed_mentions: { parse: [] } };
}

// Las stats que se comparan en /comparar
const COMPARAR = [
  ["📈", "Premier", (d) => d.premier, (v) => miles(v)],
  ["🟧", "FACEIT", (d) => d.faceit, (v) => `Nv ${v}`],
  ["🏆", "Winrate", (d) => d.winrate, (v) => `${r(v * 100)}%`],
  ...[
    ["🎯", "aim"], ["💀", "hs"], ["🔍", "precision"], ["📐", "preaim"], ["⚡", "reaccion"], ["🔫", "spray"], ["🦶", "counterstrafe"],
    ["💨", "utilidad"], ["✨", "flashes"], ["🧭", "posicionamiento"], ["🤝", "tradeKills"], ["🥷", "clutch"], ["🚪", "apertura"], ["💥", "entradaT"],
  ].map(([emoji, k]) => [emoji, AREAS[k][0], (d) => d.areas?.[k], AREAS[k][1], AREAS[k][2]]),
];

const AZUL = 0x5c9dff;
const ROJO = 0xff4d4d;

// La "cinchada": el que gana se queda con más cuadraditos (6 a 9 de 10)
export function cinchada(va, vb, menos = false) {
  if (va === vb) return "🟦".repeat(5) + "🟥".repeat(5);
  const ganaA = menos ? va < vb : va > vb;
  const dif = Math.min(1, Math.abs(va - vb) / Math.max(Math.abs(va), Math.abs(vb), 1e-9));
  const delGanador = 5 + Math.max(1, Math.ceil(dif * 4));
  const a = ganaA ? delGanador : 10 - delGanador;
  return "🟦".repeat(a) + "🟥".repeat(10 - a);
}

export function mensajeComparar(idA, idB, todos) {
  const a = todos[idA];
  const b = todos[idB];
  let ganaA = 0;
  let ganaB = 0;
  const lineas = [];
  for (const [emoji, nombre, sacar, formato, menos] of COMPARAR) {
    const va = sacar(a);
    const vb = sacar(b);
    if (typeof va !== "number" || typeof vb !== "number") continue;
    if (menos ? va < vb : va > vb) ganaA++;
    else if (menos ? vb < va : vb > va) ganaB++;
    lineas.push(`${emoji} **${nombre}**\n\`${formato(va)}\` ${cinchada(va, vb, menos)} \`${formato(vb)}\``);
  }
  const [rolA] = rolesIdeales(idA, todos, 1);
  const [rolB] = rolesIdeales(idB, todos, 1);
  const ficha = (d, rol, color) =>
    `${color} **${d.nombre}**\n${EMOJI_PREMIER(d.premier)} ${d.premier != null ? miles(d.premier) : "Sin rango"}\n${ROLES[rol.rol].emoji} ${ROLES[rol.rol].nombre}`;
  const empate = ganaA === ganaB;
  const ganador = ganaA > ganaB ? a : b;

  return {
    embeds: [
      {
        author: { name: "CARA A CARA · BROSSS" },
        title: `⚔️ ${a.nombre.toUpperCase()} vs ${b.nombre.toUpperCase()}`,
        description: `<@${idA}> 🟦 vs 🟥 <@${idB}>`,
        color: empate ? 0x22e36b : ganaA > ganaB ? AZUL : ROJO,
        fields: [
          { name: "\u200b", value: ficha(a, rolA, "🟦"), inline: true },
          { name: "\u200b", value: "## VS", inline: true },
          { name: "\u200b", value: ficha(b, rolB, "🟥"), inline: true },
        ],
      },
      { title: "📊 Stat por stat", description: lineas.join("\n"), color: 0x22e36b },
      {
        description: empate
          ? `## 🤝 Empate ${ganaA} – ${ganaB}`
          : `## 🏆 ${ganador.nombre} gana ${Math.max(ganaA, ganaB)} – ${Math.min(ganaA, ganaB)}`,
        color: empate ? 0x22e36b : ganaA > ganaB ? AZUL : ROJO,
        footer: { text: "🟦 / 🟥: el que gana cada stat se queda con más cuadraditos · datos de Leetify" },
      },
    ],
    allowed_mentions: { parse: [] },
  };
}
