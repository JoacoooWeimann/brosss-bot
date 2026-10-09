import { test } from "node:test";
import assert from "node:assert/strict";
import { parsearSteam, leerSteamId } from "../src/steam.js";
import { leerPerfil, consultarLeetify } from "../src/leetify.js";
import { registrosDesdeMensajes } from "../src/vincular.js";
import { ordenar, colorPremier, filaTabla, armarEmbed } from "../src/ranking.js";
import { ejecutar, idDeCanal } from "../src/index.js";

// ---------- Steam ----------

test("reconoce el Steam en cualquier formato y en medio del texto", () => {
  assert.deepEqual(parsearSteam("mi steam https://steamcommunity.com/profiles/76561199100973080/ gracias"), {
    tipo: "profiles",
    valor: "76561199100973080",
  });
  assert.deepEqual(parsearSteam("https://steamcommunity.com/id/DJLucheo"), { tipo: "id", valor: "DJLucheo" });
  assert.deepEqual(parsearSteam("76561199100973080"), { tipo: "profiles", valor: "76561199100973080" });
  assert.equal(parsearSteam("hola, ¿cómo me anoto?"), null);
  assert.equal(parsearSteam("https://steamcommunity.com/profiles/123"), null);
});

test("lee el ID del XML de Steam y no confunde los de los grupos", () => {
  assert.equal(leerSteamId("<profile><steamID64>76561198860991191</steamID64></profile>"), "76561198860991191");
  assert.equal(leerSteamId("<response><error>The specified profile could not be found.</error></response>"), null);
  assert.equal(leerSteamId("<profile><groups><steamID64>76561198000000000</steamID64></groups></profile>"), null);
});

// ---------- Leetify ----------

test("se queda con las stats que usa el ranking y descarta valores raros", () => {
  const p = leerPerfil({
    name: "kyo",
    winrate: 0.5,
    total_matches: 855,
    ranks: { premier: 18604, faceit: 7, faceit_elo: 1629 },
    rating: { aim: 95.9 },
    stats: { accuracy_head: 25.5 },
  });
  const { areas, ...resto } = p;
  assert.deepEqual(resto, { nombre: "kyo", premier: 18604, faceit: 7, faceitElo: 1629, aim: 95.9, hs: 25.5, winrate: 0.5, partidas: 855 });
  assert.equal(areas.aim, 95.9);
  assert.equal(areas.preaim, null);
  const raro = leerPerfil({ ranks: { premier: 0, faceit: 99, faceit_elo: "1000" } });
  assert.equal(raro.premier, null);
  assert.equal(raro.faceit, null);
  assert.equal(raro.faceitElo, null);
});

test("Leetify: 404 es 'sin cuenta', privado es 'privado' y un 500 es error", async () => {
  const respuesta = (status, cuerpo = {}) => async () => ({ status, ok: status < 400, json: async () => cuerpo });
  assert.deepEqual(await consultarLeetify("7656", respuesta(404)), { estado: "sin-cuenta" });
  assert.deepEqual(await consultarLeetify("7656", respuesta(200, { privacy_mode: "private" })), { estado: "privado" });
  assert.equal((await consultarLeetify("7656", respuesta(200, { privacy_mode: "public", ranks: {} }))).estado, "ok");
  await assert.rejects(consultarLeetify("7656", respuesta(500)));
});

// ---------- #vincular ----------

const msg = (id, autor, contenido, extra = {}) => ({
  id,
  content: contenido,
  author: { id: autor, username: `user${autor}`, global_name: `Nombre${autor}`, ...extra.author },
  reactions: extra.reactions,
});

test("un registro por persona: vale el mensaje más nuevo y se ignoran bots y charla", () => {
  const registros = registrosDesdeMensajes([
    msg("300", "1", "https://steamcommunity.com/id/nuevo"),
    msg("100", "1", "https://steamcommunity.com/id/viejo"),
    msg("200", "2", "¿cómo me anoto?"),
    msg("250", "3", "76561199100973080", { author: { bot: true } }),
    msg("400", "4", "76561199100973080", { reactions: [{ me: true, emoji: { name: "✅" } }] }),
  ]);
  assert.equal(registros.length, 2);
  const uno = registros.find((r) => r.usuarioId === "1");
  assert.equal(uno.perfil.valor, "nuevo");
  assert.equal(uno.nombre, "Nombre1");
  assert.equal(registros.find((r) => r.usuarioId === "4").reaccionOk, true);
});

// ---------- Ranking ----------

const j = (nombre, premier, faceitElo = null, extra = {}) => ({
  nombre, premier, faceit: faceitElo ? 5 : null, faceitElo, aim: null, hs: null, winrate: null, partidas: null, ...extra,
});

test("ordena por Premier y, a los que no tienen, por ELO de FACEIT", () => {
  const orden = ordenar([j("C", null, 900), j("A", 18000), j("D", null), j("B", 20000), j("E", null, 1500)]).map((x) => x.nombre);
  assert.deepEqual(orden, ["B", "A", "E", "C", "D"]);
});

test("color de Premier en los cortes del juego", () => {
  assert.equal(colorPremier(null), "⚫\uFE0F");
  assert.equal(colorPremier(4999), "⚪\uFE0F");
  assert.equal(colorPremier(15000), "🟣");
  assert.equal(colorPremier(30000), "🟡");
});

test("las filas quedan alineadas y un ` en el nombre no rompe la tabla", () => {
  const a = filaTabla(j("kyo", 18604, 1629), 1);
  const b = filaTabla(j("un nombre larguísimo`", 4200), 10);
  assert.equal(a.indexOf("18.604") + 6, b.indexOf("4.200") + 5);
  assert.ok(!b.includes("`"));
  assert.ok(b.includes("…"));
});

test("el embed tiene la tabla, el canal para anotarse y los destacados", () => {
  const embed = armarEmbed(
    [j("kyo", 18604, 1629, { aim: 95.9, hs: 25.5, winrate: 0.5, partidas: 855 }), j("Lazza", 12000)],
    { canalVincular: "123", ahora: 1_700_000_000_000 }
  );
  assert.match(embed.description, /```[\s\S]*kyo[\s\S]*Lazza[\s\S]*```/);
  assert.match(embed.description, /<#123>/);
  assert.match(embed.description, /<t:1700000000:R>/);
  assert.equal(embed.fields[0].value, "**kyo** · 96");
  assert.ok(embed.description.length < 4096);
  assert.equal(armarEmbed([], {}).fields.length, 0);
});

// ---------- Vuelta completa ----------

function clienteFalso(mensajesVincular, mensajesRanking = []) {
  const acciones = [];
  return {
    acciones,
    yo: async () => ({ id: "bot" }),
    mensajes: async (canal) => (canal === "vincular" ? mensajesVincular : mensajesRanking),
    reaccionar: async (c, m, e) => acciones.push(`+${e} ${m}`),
    sacarReaccion: async (c, m, e) => acciones.push(`-${e} ${m}`),
    responder: async (c, m) => acciones.push(`responde ${m}`),
    enviar: async (c, cuerpo) => acciones.push(`envia ${cuerpo.embeds[0].title}`),
    editar: async (c, m) => acciones.push(`edita ${m}`),
  };
}

// Leetify falso: el ID que termina en 1 está ok, en 2 no tiene cuenta, en 3 falla
async function pedirFalso(url) {
  const id = /steam64_id=(\d+)/.exec(url)?.[1] ?? "";
  if (id.endsWith("1"))
    return { status: 200, ok: true, json: async () => ({ privacy_mode: "public", ranks: { premier: 15000 } }) };
  if (id.endsWith("2")) return { status: 404, ok: false };
  return { status: 503, ok: false };
}

test("vuelta completa: ✅ al que está, ❌ con explicación al que no, y nada si Leetify falla", async () => {
  const cliente = clienteFalso([
    msg("10", "1", "76561190000000001"),
    msg("20", "2", "76561190000000002"),
    msg("30", "3", "76561190000000003"),
  ]);
  const r = await ejecutar({ cliente, pedir: pedirFalso, canalVincular: "vincular", canalRanking: "ranking" });
  assert.deepEqual(r, { registrados: 3, enRanking: 1 });
  assert.deepEqual(cliente.acciones, ["+✅ 10", "+❌ 20", "responde 20", "envia 🏆 RANKING CS2 · BROSSS"]);
});

test("no repite reacciones ni respuestas, corrige el ❌ cuando se arregla y edita el mismo mensaje", async () => {
  const cliente = clienteFalso(
    [
      msg("10", "1", "76561190000000001", { reactions: [{ me: true, emoji: { name: "❌" } }] }),
      msg("20", "2", "76561190000000002", { reactions: [{ me: true, emoji: { name: "❌" } }] }),
    ],
    [{ id: "99", author: { id: "bot" }, embeds: [{ title: "🏆 RANKING CS2 · BROSSS" }] }]
  );
  await ejecutar({ cliente, pedir: pedirFalso, canalVincular: "vincular", canalRanking: "ranking" });
  assert.deepEqual(cliente.acciones, ["-❌ 10", "+✅ 10", "edita 99"]);
});

test("el ID del canal sirve solo, como mención o con espacios", () => {
  assert.equal(idDeCanal("1234567890123456789"), "1234567890123456789");
  assert.equal(idDeCanal(" <#1234567890123456789> "), "1234567890123456789");
  assert.equal(idDeCanal("#ranking"), "");
  assert.equal(idDeCanal(undefined), "");
});
