import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inicioSemana, lider, actualizar, leer, guardar } from "../src/semana.js";
import { agrupar, embedPartida, lineaJugador, nombreMapa, urlPartida, yaPublicadas } from "../src/partidas.js";
import { campoSemana } from "../src/ranking.js";

// ---------- Jugador de la semana ----------

test("la semana arranca el viernes a las 15 UTC (12 en Argentina)", () => {
  // jueves 8/10 → viernes anterior (2/10)
  assert.equal(inicioSemana(Date.parse("2026-10-08T20:00:00Z")), "2026-10-02T15:00:00.000Z");
  // viernes 9/10 a las 14:59 UTC → todavía es la semana anterior
  assert.equal(inicioSemana(Date.parse("2026-10-09T14:59:00Z")), "2026-10-02T15:00:00.000Z");
  // viernes 9/10 a las 15:00 UTC → arranca la nueva
  assert.equal(inicioSemana(Date.parse("2026-10-09T15:00:00Z")), "2026-10-09T15:00:00.000Z");
  // domingo
  assert.equal(inicioSemana(Date.parse("2026-10-11T03:00:00Z")), "2026-10-09T15:00:00.000Z");
});

const j = (steamId, nombre, premier) => ({ steamId, nombre, premier });

test("el líder es el que más subió; bajar o no tener Premier no cuenta", () => {
  const base = { a: { premier: 10000 }, b: { premier: 15000 }, c: { premier: null } };
  assert.deepEqual(lider(base, [j("a", "Ana", 10500), j("b", "Beto", 15200), j("c", "Caro", 9000)]), { nombre: "Ana", subio: 500 });
  assert.equal(lider(base, [j("a", "Ana", 9000)]), null);
});

test("al cambiar de semana guarda al ganador y arranca una base nueva", () => {
  const jueves = Date.parse("2026-10-08T20:00:00Z");
  const sabado = Date.parse("2026-10-10T20:00:00Z");
  let h = actualizar(null, [j("a", "Ana", 10000)], jueves);
  assert.equal(h.anterior, null);
  // Entra Beto a mitad de semana: se suma a la base sin cambiar la de Ana
  h = actualizar(h, [j("a", "Ana", 10300), j("b", "Beto", 20000)], jueves);
  assert.deepEqual(h.base, { a: { premier: 10000 }, b: { premier: 20000 } });
  // Pasa el viernes: gana Ana (+600) y la base nueva es la de ahora
  h = actualizar(h, [j("a", "Ana", 10600), j("b", "Beto", 20100)], sabado);
  assert.deepEqual(h.anterior, { nombre: "Ana", subio: 600 });
  assert.deepEqual(h.base, { a: { premier: 10600 }, b: { premier: 20100 } });
  assert.equal(h.semana, "2026-10-09T15:00:00.000Z");
});

test("el historial se guarda solo si cambió, y si no existe arranca de cero", async () => {
  const dir = await mkdtemp(join(tmpdir(), "brosss-"));
  const archivo = join(dir, "datos", "historial.json");
  assert.equal(await leer(archivo), null);
  const h = { semana: "x", base: {}, anterior: null };
  assert.equal(await guardar(h, null, archivo), true);
  assert.deepEqual(JSON.parse(await readFile(archivo, "utf8")), h);
  assert.equal(await guardar(h, structuredClone(h), archivo), false);
});

test("el campo del ranking muestra la semana pasada y quién va primero", () => {
  const c = campoSemana({ anterior: { nombre: "Ana", subio: 1200 }, actual: { nombre: "Beto", subio: 300 } });
  assert.match(c.value, /Semana pasada: \*\*Ana\*\* \(\+1\.200\)/);
  assert.match(c.value, /va primero: \*\*Beto\*\* \(\+300\)/);
  assert.match(campoSemana({}).value, /todavía nadie subió/);
});

// ---------- #historial ----------

const ahora = Date.parse("2026-10-08T06:00:00Z");
const stats = (steam64_id, extra = {}) => ({
  steam64_id, total_kills: 18, total_deaths: 7, total_assists: 5, total_damage: 1888, rounds_count: 15,
  total_hs_kills: 9, leetify_rating: 0.0904, rounds_won: 13, rounds_lost: 2, mvps: 3, ...extra,
});
const partida = (id, steamId, fin, extra = {}) => ({
  id, finished_at: fin, map_name: "de_dust2", data_source: "matchmaking", stats: [stats(steamId, extra)],
});

test("junta en una sola partida a los registrados que jugaron juntos", () => {
  const kyo = { steamId: "1", nombre: "Kyo" };
  const joaco = { steamId: "2", nombre: "Joaco" };
  const lista = agrupar(
    [
      { jugador: kyo, partidas: [partida("m1", "1", "2026-10-08T04:00:00Z"), partida("m0", "1", "2026-10-06T05:00:00Z")] },
      { jugador: joaco, partidas: [partida("m1", "2", "2026-10-08T04:00:00Z", { leetify_rating: 0.2 }), partida("m2", "2", "2026-10-08T05:00:00Z")] },
    ],
    { ahora, publicadas: new Set([urlPartida("m2")]) }
  );
  // m0 es de hace más de 48 horas y m2 ya estaba publicada
  assert.deepEqual(lista.map((p) => p.id), ["m1"]);
  assert.deepEqual(lista[0].jugadores.map((x) => x.nombre), ["Kyo", "Joaco"]);
});

test("el resumen: resultado, mapa, modo, link y el MVP del server primero", () => {
  const p = {
    id: "m1", fin: ahora, mapa: "de_dust2", modo: "matchmaking",
    jugadores: [
      { nombre: "Kyo", stats: stats("1") },
      { nombre: "Joaco", stats: stats("2", { leetify_rating: 0.2, mvps: 0 }) },
    ],
  };
  const e = embedPartida(p);
  assert.equal(e.title, "🏆 Victoria en Dust II · 13-2");
  assert.equal(e.url, "https://leetify.com/app/match-details/m1");
  assert.match(e.description, /^Premier · <t:\d+:R>$/);
  assert.equal(e.fields[0].name, "⭐ Joaco");
  assert.equal(e.fields[1].name, "Kyo · 3 MVP");
  assert.equal(embedPartida({ ...p, jugadores: [{ nombre: "Kyo", stats: stats("1", { rounds_won: 5, rounds_lost: 13 }) }] }).title, "💀 Derrota en Dust II · 5-13");
});

test("la línea de stats: K/D/A, ADR, HS y rating", () => {
  assert.equal(lineaJugador(stats("1")), "18/7/5 · ADR 126 · HS 50% · Rating +9");
  assert.equal(lineaJugador({ total_kills: 0, total_deaths: 3 }), "0/3/0");
});

test("nombres de mapa y partidas ya publicadas", () => {
  assert.equal(nombreMapa("de_mirage"), "Mirage");
  assert.equal(nombreMapa("de_dust2"), "Dust II");
  assert.equal(nombreMapa(""), "Mapa desconocido");
  const set = yaPublicadas(
    [
      { author: { id: "bot" }, embeds: [{ url: urlPartida("a") }] },
      { author: { id: "otro" }, embeds: [{ url: urlPartida("b") }] },
    ],
    "bot"
  );
  assert.deepEqual([...set], [urlPartida("a")]);
});
