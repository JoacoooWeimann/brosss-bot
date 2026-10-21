import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeConvocatoria, leerConvocatoria, alternar, normalizarHora } from "../src/convocatoria.js";
import { resumirPartida, recientes, mensajeForma } from "../src/forma.js";
import { jugadasDestacadas, embedDestacadas, actualizarLogros, embedLogro, textoLogros } from "../src/logros.js";

// ---------- /jugamos ----------

test("hora: entiende 22, 22:30, 22.30, 10pm y deja lo demás tal cual", () => {
  assert.equal(normalizarHora("22"), "22:00");
  assert.equal(normalizarHora("22:30"), "22:30");
  assert.equal(normalizarHora("22.30"), "22:30");
  assert.equal(normalizarHora("10pm"), "22:00");
  assert.equal(normalizarHora("ya"), "ya");
  assert.equal(normalizarHora(""), "ya");
});

test("convocatoria: el creador ya está anotado; las listas se leen del mismo mensaje", () => {
  const m = mensajeConvocatoria({ hora: "22:00", modo: "premier", creador: "1", si: ["1"], no: [] });
  assert.equal(m.embeds[0].title, "🏆 Premier a las 22:00");
  assert.match(m.embeds[0].description, /Faltan 4/);
  assert.equal(m.embeds[0].fields[0].name, "✅ Se suman (1/5)");
  assert.deepEqual(m.components[0].components.map((b) => b.custom_id), ["jugamos:si:premier", "jugamos:no:premier"]);
  assert.deepEqual(leerConvocatoria(m, "premier"), { hora: "22:00", modo: "premier", creador: "1", si: ["1"], no: [] });
  assert.deepEqual(m.allowed_mentions.users, []);
});

test("botones: sumarse, cambiar de lista, salir tocando de nuevo y no pasar el cupo", () => {
  let e = { hora: "22:00", modo: "wingman", creador: "1", si: ["1"], no: [] };
  e = alternar(e, "2", "no");
  assert.deepEqual([e.si, e.no], [["1"], ["2"]]);
  e = alternar(e, "2", "si"); // cambia de lista
  assert.deepEqual([e.si, e.no], [["1", "2"], []]);
  assert.equal(alternar(e, "3", "si").lleno, true, "wingman es de a 2");
  e = alternar(e, "2", "si"); // toca de nuevo: sale
  assert.deepEqual(e.si, ["1"]);
});

test("completa: lo dice en grande y notifica a los anotados", () => {
  const m = mensajeConvocatoria({ hora: "22:00", modo: "wingman", creador: "1", si: ["1", "2"], no: [] });
  assert.match(m.embeds[0].description, /Equipo completo/);
  assert.match(m.content, /<@1> <@2>/);
  assert.deepEqual(m.allowed_mentions.users, ["1", "2"]);
  // Leído de vuelta, el creador sigue siendo el primero de la lista
  assert.equal(leerConvocatoria(m, "wingman").creador, "1");
});

// ---------- /forma ----------

const partida = (id, fin, ganados, perdidos, extra = {}) => ({
  id, finished_at: fin, map_name: "de_mirage", data_source: "matchmaking",
  stats: [{ steam64_id: "s1", rounds_won: ganados, rounds_lost: perdidos, total_kills: 20, total_deaths: 15, total_assists: 4,
    total_damage: 1800, rounds_count: 20, total_hs_kills: 10, leetify_rating: 0.05, ...extra }],
});

test("resumen de partidas: las 10 más nuevas primero, con ADR, HS y rating", () => {
  const lista = Array.from({ length: 12 }, (_, i) => partida(`m${i}`, `2026-10-${String(i + 1).padStart(2, "0")}T20:00:00Z`, 13, i % 3 ? 7 : 13 + 1));
  const r = recientes(lista, "s1");
  assert.equal(r.length, 10);
  assert.equal(r[0].id, "m11");
  assert.deepEqual(resumirPartida(lista[0], "s1"), {
    id: "m0", fin: "2026-10-01T20:00:00Z", mapa: "de_mirage", modo: "matchmaking", ganados: 13, perdidos: 14,
    k: 20, d: 15, a: 4, adr: 90, hs: 50, rating: 5,
  });
  assert.equal(resumirPartida(lista[0], "otro"), null);
});

test("/forma: racha, victorias, tendencia del rating y mejor partida", () => {
  const lista = [
    ...Array.from({ length: 5 }, (_, i) => ({ id: `n${i}`, mapa: "de_mirage", ganados: 13, perdidos: 7, k: 20, d: 10, a: 3, adr: 100, rating: 8 })),
    ...Array.from({ length: 5 }, (_, i) => ({ id: `v${i}`, mapa: "de_nuke", ganados: 5, perdidos: 13, k: 10, d: 18, a: 2, adr: 60, rating: -4 })),
  ];
  const e = mensajeForma("1", { nombre: "Kyo", recientes: lista }).embeds[0];
  assert.match(e.description, /## 🟥🟥🟥🟥🟥🟩🟩🟩🟩🟩/u, "de la más vieja a la más nueva");
  assert.match(e.description, /\*\*5V – 5D\*\*/);
  assert.match(e.fields[0].value, /📈 Subiendo: \*\*\+8\.0\*\*/);
  assert.match(e.fields[1].value, /Mirage\*\* 13-7/);
  assert.equal(mensajeForma("1", { nombre: "X", recientes: [] }).flags, 64);
});

// ---------- Jugadas destacadas y logros ----------

const jugada = (nombre, stats) => ({ usuarioId: nombre, nombre, avatar: null, stats: { rounds_won: 13, rounds_lost: 7, total_kills: 18, ...stats } });

test("jugadas destacadas: ACE, 4K, 30 kills y barrida", () => {
  const p = { mapa: "de_mirage", jugadores: [jugada("Kyo", { multi5k: 1, multi4k: 2, total_kills: 31, rounds_won: 13, rounds_lost: 0 }), jugada("Joa", {})] };
  const lineas = jugadasDestacadas(p);
  assert.deepEqual(lineas, ["💥 **¡ACE de Kyo!**", "🔥 **Kyo** hizo 2 veces 4K", "🎯 **Kyo** la rompió con **31 kills**", "🧹 **¡Barrida 13-0!**"]);
  assert.equal(embedDestacadas({ jugadores: [jugada("Joa", {})] }), null);
});

test("logros: la primera vez se anotan en silencio; después, solo los nuevos y una sola vez", () => {
  const jugadores = [{ usuarioId: "1", nombre: "Kyo", partidas: 869, premier: 18900, faceit: 7 }];
  const primera = actualizarLogros(null, jugadores);
  assert.deepEqual(primera.anunciar, []);
  assert.deepEqual(primera.registro["1"], ["partidas100", "partidas500", "premier10k", "premier15k"]);

  // Sube a 20K y hace un ACE: se anuncian los dos
  const p = { mapa: "de_nuke", jugadores: [jugada("1", { multi5k: 1 })] };
  const segunda = actualizarLogros(primera.registro, [{ ...jugadores[0], premier: 20100 }], [p]);
  assert.deepEqual(segunda.anunciar.map((a) => a.codigo).sort(), ["ace", "premier20k"]);

  // Otro ACE: ya lo tenía, no se repite
  const tercera = actualizarLogros(segunda.registro, [{ ...jugadores[0], premier: 20100 }], [p]);
  assert.deepEqual(tercera.anunciar, []);

  // Alguien nuevo: se anota en silencio lo que ya tenía
  const nuevo = actualizarLogros(tercera.registro, [{ usuarioId: "2", nombre: "Nuevo", partidas: 150 }]);
  assert.deepEqual(nuevo.anunciar, []);
  assert.deepEqual(nuevo.registro["2"], ["partidas100"]);
});

test("el aviso de logro y el texto para /stats", () => {
  const e = embedLogro({ usuarioId: "1", nombre: "Kyo", avatar: "https://x/a.png", codigo: "ace" });
  assert.equal(e.title, "💥 Primer ACE");
  assert.match(e.description, /<@1> · \*\*Kyo\*\*\n\*5 kills en una ronda\.\*/);
  assert.equal(textoLogros(["ace", "premier15k", "inventado"]), "💥 Primer ACE\n🟣 15K de Premier");
});
