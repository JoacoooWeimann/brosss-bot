import { test } from "node:test";
import assert from "node:assert/strict";
import { armarEquipos, statsJugador, svgPartida, nombreMapa } from "../src/partida-imagen.js";
import { embedPartidaConImagen } from "../src/partidas.js";

const s = (steam64_id, name, equipo, k, extra = {}) => ({
  steam64_id, name, initial_team_number: equipo, total_kills: k, total_deaths: 10, total_assists: 3,
  dpr: 80, total_hs_kills: Math.floor(k / 2), leetify_rating: 0.01, mvps: 1,
  rounds_won: equipo === 2 ? 13 : 7, rounds_lost: equipo === 2 ? 7 : 13, ...extra,
});
const detalle = {
  map_name: "de_mirage", data_source: "matchmaking_competitive",
  stats: [
    s("a", "kyo", 2, 19, { leetify_rating: 0.054 }), s("b", "Coqueta Classic", 2, 23, { leetify_rating: 0.093 }),
    s("c", "Galdino", 2, 17), s("x", "Mr_PaPu144", 3, 12), s("y", "<rival>", 3, 13, { leetify_rating: 0.2 }),
  ],
};
const vinculados = [{ steamId: "a", nombre: "Kyo" }, { steamId: "b", nombre: "Joacooo" }];

test("equipos: el de los vinculados es el nuestro, ordenado por kills; MVP el de mejor rating", () => {
  const e = armarEquipos(detalle, vinculados);
  assert.deepEqual(e.nosotros.map((j) => j.nombre), ["Joacooo", "Kyo", "Galdino"]);
  assert.deepEqual(e.nosotros.map((j) => j.vinculado), [true, true, false]);
  assert.deepEqual(e.rivales.map((j) => j.nombre), ["<rival>", "Mr_PaPu144"]);
  assert.equal(e.mvp, "y");
  assert.deepEqual([e.ganados, e.perdidos], [13, 7]);
});

test("stats de cada jugador: ADR, HS% y rating como en Leetify", () => {
  assert.deepEqual(statsJugador(s("a", "kyo", 2, 20, { dpr: 96.4, total_hs_kills: 12, leetify_rating: 0.0538 })), {
    k: 20, d: 10, a: 3, adr: 96, hs: 60, rating: 5.4, mvps: 1,
  });
  assert.equal(nombreMapa("de_dust2"), "DUST II");
  assert.equal(nombreMapa("de_ancient"), "ANCIENT");
});

test("la imagen: mapa, resultado, los dos equipos y nombres escapados", () => {
  const svg = svgPartida(detalle, vinculados);
  for (const t of ["MIRAGE", "COMPETITIVO", "VICTORIA", "NUESTRO EQUIPO", "RIVALES", "Joacooo", "Galdino", "&lt;rival&gt;", "+9.3"]) {
    assert.ok(svg.includes(t), `falta ${t}`);
  }
});

test("el embed con imagen dice quiénes del server jugaron y mantiene el link (para no repetir)", () => {
  const partida = { id: "m1", fin: Date.parse("2026-10-10T03:54:36Z"), mapa: "de_mirage", modo: "matchmaking_competitive",
    jugadores: [{ nombre: "Kyo", stats: { rounds_won: 13, rounds_lost: 7, leetify_rating: 0.05 } }, { nombre: "Joacooo", stats: { leetify_rating: 0.09 } }] };
  const e = embedPartidaConImagen(partida, "partida-m1.png");
  assert.equal(e.title, "🏆 Victoria en Mirage · 13-7");
  assert.equal(e.url, "https://leetify.com/app/match-details/m1");
  assert.match(e.description, /Jugaron: \*\*Kyo\*\*, \*\*Joacooo\*\*/);
  assert.equal(e.image.url, "attachment://partida-m1.png");
});
