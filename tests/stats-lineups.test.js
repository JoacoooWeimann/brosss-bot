import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeStats, mensajeComparar, fuertesYDebiles, rolIdeal, rolesIdeales, urlLeetify, cinchada } from "../src/stats-jugador.js";
import { mensajeLineups, porDestino, MAPAS, bannerMapa } from "../src/lineups.js";
import { leerLineups, actualizarLineups } from "../src/csnades.js";

const areas = (cambios) => ({ aim: 50, hs: 20, precision: 30, preaim: 9, reaccion: 600, spray: 40, counterstrafe: 80, utilidad: 50,
  flashes: 0.4, posicionamiento: 50, tradeKills: 40, clutch: 0.1, apertura: 0, entradaT: 50, utilidadSinUsar: 300, ...cambios });
const todos = {
  kyo: { nombre: "Kyo", premier: 20558, faceit: 7, winrate: 0.66, partidas: 869, steamId: "7656", avatar: "https://x/a.png",
    areas: areas({ aim: 98, hs: 27, precision: 45, preaim: 6.5 }) },
  joa: { nombre: "Joacooo", premier: 18537, faceit: null, winrate: 0.69, partidas: 290, areas: areas({ hs: 14, clutch: 0.2, posicionamiento: 70 }) },
  ela: { nombre: "ELAYAS", premier: 4678, faceit: 4, winrate: 0.6, partidas: 100, areas: areas({ utilidad: 60 }) },
};

// ---------- /stats ----------

test("/stats: portada con Premier grande, rendimiento con barras, 3 roles ideales y fuertes/débiles", () => {
  const [portada, rendimiento, roles, resumen] = mensajeStats("kyo", todos).embeds;
  assert.equal(portada.title, "Kyo");
  assert.equal(portada.url, "https://leetify.com/app/profile/7656");
  assert.match(portada.description, /## 🩷 20\.558/);
  assert.match(portada.description, /FACEIT \*\*nivel 7\*\*/);
  assert.equal(rendimiento.fields.length, 9);
  assert.match(rendimiento.fields[0].value, /^\*\*98\*\*\n🟩+⬛*$/u, "el mejor aim del server: barra verde llena");
  const lineas = roles.description.split("\n\n");
  assert.equal(lineas.length, 3);
  assert.match(lineas[0], /^🥇 🎯 \*\*AWPer\*\*/);
  assert.match(resumen.fields[0].value, /\*\*Aim\*\* · 98/);
});

test("roles ideales ordenados; fuertes y débiles respetan 'menos es mejor'", () => {
  const roles = rolesIdeales("joa", todos);
  assert.equal(roles.length, 3);
  assert.ok(roles[0].encaje >= roles[1].encaje && roles[1].encaje >= roles[2].encaje);
  assert.equal(rolIdeal("joa", todos).rol, "lurker");
  const { fuertes, debiles } = fuertesYDebiles("kyo", todos);
  assert.ok(fuertes.some((t) => t.startsWith("**Preaim**")));
  assert.ok(!debiles.some((t) => t.startsWith("**Preaim**")));
  assert.equal(urlLeetify(null), null);
});

// ---------- /comparar ----------

test("cinchada: el que gana se queda con más cuadraditos; 'menos es mejor' se invierte", () => {
  const azules = (t) => (t.match(/🟦/gu) ?? []).length;
  assert.equal(azules(cinchada(98, 49)), 7); // la mitad de diferencia
  assert.equal(azules(cinchada(98, 30)), 8);
  assert.equal(azules(cinchada(49, 98)), 3);
  assert.equal(azules(cinchada(7, 9.6, true)), 7, "menos preaim gana");
  assert.equal(azules(cinchada(5, 5)), 5);
  assert.equal(azules(cinchada(7.8, -0.6)), 9);
});

test("/comparar: cara a cara, stat por stat y marcador", () => {
  const [cara, stats, final] = mensajeComparar("kyo", "joa", todos).embeds;
  assert.equal(cara.title, "⚔️ KYO vs JOACOOO");
  assert.match(cara.fields[0].value, /🟦 \*\*Kyo\*\*\n🩷 20\.558\n🎯 AWPer/);
  assert.match(stats.description, /🎯 \*\*Aim\*\*\n`98` 🟦+🟥+ `50`/u);
  assert.ok(!/FACEIT/.test(stats.description), "si a uno le falta el dato, esa fila no va");
  assert.match(final.description, /^## 🏆 Kyo gana \d+ – \d+$/);
});

// ---------- /smoke ----------

const lineups = [
  { slug: "window-1", lado: "t", desde: "T Spawn", hacia: "Window", tecnica: "left_jump", movimiento: "stationary", principiante: false },
  { slug: "window-2", lado: "t", desde: "Tetris", hacia: "Window", tecnica: "left", movimiento: "stationary", principiante: true },
  { slug: "jungle-1", lado: "t", desde: "Tetris", hacia: "Jungle", tecnica: "left", movimiento: "running", principiante: false },
  { slug: "short-ct", lado: "ct", desde: "Market", hacia: "Short", tecnica: "right", movimiento: "stationary", principiante: false },
];

test("por destino: uno por destino, primero el fácil, los destinos con más lineups arriba", () => {
  const g = porDestino(lineups);
  assert.deepEqual(g.map((x) => x.hacia), ["Window", "Jungle", "Short"]);
  assert.equal(g[0].lineup.slug, "window-2");
  assert.equal(g[0].cantidad, 2);
});

test("/smoke: banner del mapa, lineups por destino con link y técnica, filtro por lado", () => {
  const datos = { mapas: { mirage: { smokes: lineups } } };
  const m = mensajeLineups("mirage", "smokes", null, datos);
  assert.equal(m.embeds[0].title, "💨 SMOKES DE MIRAGE");
  assert.equal(m.embeds[0].image.url, bannerMapa("mirage"));
  assert.match(m.embeds[0].description, /\*\*4 lineups\*\* a \*\*3 destinos\*\*/);
  assert.match(m.embeds[1].description, /⭐ \*\*Window\*\* — \[desde Tetris\]\(https:\/\/csnades\.gg\/mirage\/smokes\/window-2\) · \*clic izq\., quieto\* · \+1/);
  const ct = mensajeLineups("mirage", "smokes", "ct", datos);
  assert.equal(ct.embeds[0].title, "💨 SMOKES DE MIRAGE · LADO CT");
  assert.match(ct.embeds[1].description, /Short/);
  assert.ok(!/Window/.test(ct.embeds[1].description));
  // Sin datos: igual responde con los links
  const sin = mensajeLineups("nuke", "molotovs");
  assert.equal(sin.embeds.length, 2);
  assert.equal(sin.components[0].components[0].url, "https://csnades.gg/nuke/molotovs");
  assert.equal(MAPAS.length, 9);
  assert.ok(MAPAS.some(([n]) => n === "Cache") && !MAPAS.some(([n]) => n === "Train"));
});

test("csnades: lee los lineups de la página y los baja una vez por día", async () => {
  const html = `x{\\"id\\":\\"nade_1\\",\\"slug\\":\\"top-mid\\",\\"team\\":\\"t\\",\\"technique\\":\\"left\\",\\"movement\\":\\"stationary\\",\\"titleFrom\\":\\"T Spawn\\",\\"titleTo\\":\\"Top Mid\\",\\"beginner\\":true},{\\"id\\":\\"nade_2\\",\\"slug\\":\\"roto\\"}`;
  assert.deepEqual(leerLineups(html), [
    { slug: "top-mid", lado: "t", desde: "T Spawn", hacia: "Top Mid", tecnica: "left", movimiento: "stationary", principiante: true },
  ]);
  const hoy = Date.parse("2026-10-20T12:00:00Z");
  const completo = { dia: "2026-10-20", mapas: Object.fromEntries(MAPAS.map(([, m]) => [m, {}])) };
  assert.equal(await actualizarLineups(completo, async () => assert.fail("no debería pedir"), hoy), null);
  // Si entra un mapa nuevo a la lista, lo baja en el momento aunque sea el mismo día
  const sinCache = { ...completo, mapas: { ...completo.mapas } };
  delete sinCache.mapas.cache;
  assert.ok(await actualizarLineups(sinCache, async () => ({ ok: true, text: async () => html }), hoy));
  const nuevo = await actualizarLineups(null, async () => ({ ok: true, text: async () => html }), hoy);
  assert.equal(nuevo.dia, "2026-10-20");
  assert.equal(nuevo.mapas.mirage.smokes[0].hacia, "Top Mid");
});
