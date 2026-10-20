import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeStats, mensajeComparar, fuertesYDebiles, rolIdeal, urlLeetify } from "../src/stats-jugador.js";
import { mensajeLineups, MAPAS } from "../src/lineups.js";

const areas = (cambios) => ({ aim: 50, hs: 20, precision: 30, preaim: 9, reaccion: 600, spray: 40, counterstrafe: 80, utilidad: 50,
  flashes: 0.4, posicionamiento: 50, tradeKills: 40, clutch: 0.1, apertura: 0, entradaT: 50, utilidadSinUsar: 300, ...cambios });
const todos = {
  kyo: { nombre: "Kyo", premier: 20558, faceit: 7, winrate: 0.66, partidas: 869, steamId: "7656", avatar: "https://x/a.png",
    areas: areas({ aim: 98, hs: 27, precision: 45, preaim: 6.5 }) },
  joa: { nombre: "Joacooo", premier: 18537, faceit: null, winrate: 0.69, partidas: 290, areas: areas({ hs: 14, clutch: 0.2, posicionamiento: 70 }) },
  ela: { nombre: "ELAYAS", premier: 4678, faceit: 4, winrate: 0.6, partidas: 100, areas: areas({ utilidad: 60 }) },
};

test("/stats: rangos, puntos fuertes contra el server, qué mejorar y rol ideal", () => {
  const e = mensajeStats("kyo", todos).embeds[0];
  assert.equal(e.title, "📊 Stats de Kyo");
  assert.equal(e.url, "https://leetify.com/app/profile/7656");
  assert.equal(e.thumbnail.url, "https://x/a.png");
  const campo = (n) => e.fields.find((f) => f.name.includes(n)).value;
  assert.equal(campo("Premier"), "**20.558**");
  assert.equal(campo("FACEIT"), "**Nivel 7**");
  assert.match(campo("Puntos fuertes"), /\*\*Aim\*\* · 98/);
  assert.match(e.fields.at(-1).name, /Rol ideal: AWPer/);
});

test("fuertes y débiles: el preaim bajo es bueno; sin datos no inventa", () => {
  const { fuertes, debiles } = fuertesYDebiles("kyo", todos);
  assert.ok(fuertes.some((t) => t.startsWith("**Preaim**")));
  assert.ok(!debiles.some((t) => t.startsWith("**Preaim**")));
  assert.equal(rolIdeal("joa", todos).rol, "lurker");
  assert.equal(urlLeetify(null), null);
});

test("/comparar: tabla stat por stat, flechas al mejor y quién gana", () => {
  const e = mensajeComparar("kyo", "joa", todos).embeds[0];
  assert.equal(e.title, "⚔️ Kyo vs Joacooo");
  assert.match(e.description, /Aim\s+98 ◀ 50/);
  assert.match(e.description, /Winrate\s+66% ▶ 69%/);
  assert.match(e.description, /Preaim\s+6\.5° ◀ 9\.0°/, "menos preaim es mejor");
  assert.match(e.description, /🏆 \*\*Kyo\*\* gana en \d+ de \d+/);
  assert.ok(!/FACEIT/.test(e.description), "si a uno le falta el dato, esa fila no va");
});

test("/smoke: links a CSNADES, YouTube y Workshop según mapa, tipo y zona", () => {
  const m = mensajeLineups("mirage", "molotovs", "b");
  assert.equal(m.embeds[0].title, "🔥 Molotovs de Mirage · B");
  const [csnades, youtube, workshop] = m.components[0].components;
  assert.equal(csnades.url, "https://csnades.gg/mirage/molotovs");
  assert.match(youtube.url, /search_query=cs2%20Mirage%20B%20molotov%20lineups/);
  assert.match(workshop.url, /searchtext=yprac%20Mirage/);
  assert.equal(mensajeLineups("dust2").embeds[0].title, "💨 Smokes de Dust II");
  assert.equal(MAPAS.length, 9);
});
