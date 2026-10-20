import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { armarFormacion, mensajeFormacion, puntajesRelativos, ROLES } from "../src/formacion.js";
import { firmaValida } from "../src/firma.js";
import { atender, usuariosElegidos } from "../src/comando-team.js";
import { armarDatos } from "../src/jugadores-datos.js";

// Cada uno es claramente el mejor en lo de su rol
const base = { aim: 50, precision: 30, preaim: 9, entradaT: 50, apertura: 0, reaccion: 600, utilidad: 50, flashes: 0.4,
  tradeKills: 40, utilidadSinUsar: 300, clutch: 0.05, posicionamiento: 50 };
const datos = (cambios, extra = {}) => ({ areas: { ...base, ...cambios }, winrate: 0.5, partidas: 300, ...extra });
const jugadores = [
  { usuarioId: "awp", nombre: "A", datos: datos({ aim: 95, precision: 45, preaim: 6 }) },
  { usuarioId: "entry", nombre: "E", datos: datos({ entradaT: 70, apertura: 0.08, reaccion: 480 }) },
  { usuarioId: "sup", nombre: "S", datos: datos({ utilidad: 80, flashes: 0.7, tradeKills: 55, utilidadSinUsar: 150 }) },
  { usuarioId: "lurk", nombre: "L", datos: datos({ clutch: 0.2, posicionamiento: 75 }) },
  { usuarioId: "igl", nombre: "I", datos: datos({ posicionamiento: 62, utilidad: 62 }, { winrate: 0.65, partidas: 1500 }) },
];

test("reparte cada rol al que mejor lo cumple, sin repetir", () => {
  const f = armarFormacion(jugadores);
  assert.deepEqual(Object.fromEntries(f.map((x) => [x.jugador.usuarioId, x.rol])), {
    awp: "awp", entry: "entry", sup: "support", lurk: "lurker", igl: "igl",
  });
  assert.equal(new Set(f.map((x) => x.rol)).size, 5);
  assert.equal(f.find((x) => x.rol === "awp").motivo, "Aim 95");
});

test("las stats se comparan dentro del grupo: sin diferencias, todo da 0", () => {
  const z = puntajesRelativos([{ datos: datos({}) }, { datos: datos({}) }]);
  assert.ok(Object.values(z[0]).every((v) => v === 0));
});

test("los que no tienen stats se llevan los roles que sobran y se les avisa", () => {
  const f = armarFormacion([jugadores[0], { usuarioId: "nuevo", nombre: "N", datos: null }]);
  assert.equal(f.length, 2);
  const nuevo = f.find((x) => x.jugador.usuarioId === "nuevo");
  assert.ok(nuevo.rol && nuevo.rol !== f.find((x) => x.jugador.usuarioId === "awp").rol);
  const m = mensajeFormacion(f, { canalVincular: "123" });
  assert.match(m.embeds[0].description, /<@nuevo> — sin stats de Leetify/);
  assert.match(m.embeds[0].description, /vinculá tu Steam en <#123>/);
  assert.deepEqual(m.allowed_mentions, { parse: [] });
});

test("con más de 5 se usan los primeros 5", () => {
  const seis = [...jugadores, { usuarioId: "extra", nombre: "X", datos: datos({}) }];
  assert.equal(armarFormacion(seis).length, 5);
});

test("el mensaje: un renglón por rol con emoji, mención y motivo", () => {
  const m = mensajeFormacion(armarFormacion(jugadores));
  const lineas = m.embeds[0].description.split("\n");
  assert.equal(lineas.length, 5);
  assert.match(lineas[0], /^🎯 \*\*AWPer\*\* · <@awp> — Aim 95$/);
  assert.equal(Object.keys(ROLES).length, 5);
});

test("datos para /team: si Leetify falló para alguien vinculado, conserva lo anterior", () => {
  const previo = { jugadores: { viejo: { nombre: "V", areas: { aim: 70 } }, fuera: { nombre: "F" } } };
  const d = armarDatos([{ usuarioId: "b", nombre: "B", premier: 1, areas: { aim: 50 } }], { previo, registrados: ["b", "viejo"] });
  assert.deepEqual(Object.keys(d.jugadores), ["b", "viejo"]);
  assert.equal(d.jugadores.viejo.areas.aim, 70);
});

// ---------- Firma y función ----------

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const clavePublica = publicKey.export({ format: "der", type: "spki" }).subarray(12).toString("hex");
const firmar = (cuerpo, ts = "1700000000") => sign(null, Buffer.from(ts + cuerpo), privateKey).toString("hex");
const peticion = (obj, { firma, ts = "1700000000" } = {}) => {
  const cuerpo = JSON.stringify(obj);
  return new Request("https://x/interacciones", {
    method: "POST",
    body: cuerpo,
    headers: { "x-signature-ed25519": firma ?? firmar(cuerpo, ts), "x-signature-timestamp": ts },
  });
};

test("firma: acepta la de Discord y rechaza cualquier otra", () => {
  assert.equal(firmaValida("hola", firmar("hola"), "1700000000", clavePublica), true);
  assert.equal(firmaValida("hola!", firmar("hola"), "1700000000", clavePublica), false);
  assert.equal(firmaValida("hola", "00", "1700000000", clavePublica), false);
  assert.equal(firmaValida("hola", firmar("hola"), "1700000000", ""), false);
});

test("función: 401 sin firma válida y responde el PING de Discord", async () => {
  assert.equal((await atender(peticion({ type: 1 }, { firma: "ab" }), { clavePublica })).status, 401);
  const r = await atender(peticion({ type: 1 }), { clavePublica });
  assert.deepEqual(await r.json(), { type: 1 });
});

test("función: /team arma la formación con los datos del bot", async () => {
  const interaccion = {
    type: 2,
    data: {
      name: "team",
      options: [{ name: "jugador1", value: "awp" }, { name: "jugador2", value: "nuevo" }, { name: "jugador3", value: "musica" }],
      resolved: { users: { awp: { username: "a" }, nuevo: { username: "n" }, musica: { username: "m", bot: true } } },
    },
  };
  const pedir = async () => ({ ok: true, json: async () => ({ jugadores: { awp: jugadores[0].datos } }) });
  const r = await (await atender(peticion(interaccion), { clavePublica, pedir, canalVincular: "9" })).json();
  assert.equal(r.type, 4);
  const texto = r.data.embeds[0].description;
  assert.match(texto, /<@awp>/);
  assert.match(texto, /<@nuevo> — sin stats/);
  assert.ok(!texto.includes("musica"), "los bots no cuentan");
});

test("función: sin jugadores válidos responde en privado", async () => {
  const interaccion = { type: 2, data: { name: "formacion", options: [{ name: "jugador1", value: "b" }], resolved: { users: { b: { bot: true } } } } };
  const r = await (await atender(peticion(interaccion), { clavePublica, pedir: async () => ({ ok: false }) })).json();
  assert.equal(r.data.flags, 64);
});

test("usuarios elegidos: sin repetir y con el apodo del server si tiene", () => {
  const u = usuariosElegidos({ data: { options: [{ name: "jugador1", value: "1" }, { name: "jugador2", value: "1" }],
    resolved: { users: { 1: { username: "user" } }, members: { 1: { nick: "Apodo" } } } } });
  assert.deepEqual(u, [{ usuarioId: "1", nombre: "Apodo", bot: false }]);
});

test("la clave se limpia (espacios, comillas) y el GET dice si está cargada", async () => {
  assert.equal(firmaValida("hola", firmar("hola"), "1700000000", ` "${clavePublica}" \n`), true);
  const estado = async (clave) => (await (await atender(new Request("https://x/interacciones"), { clavePublica: clave })).json()).clavePublica;
  assert.equal(await estado(clavePublica), "cargada");
  assert.equal(await estado(""), "falta");
  assert.match(await estado("abc"), /mal cargada/);
});
