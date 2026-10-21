import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { armarFormacion, mensajeFormacion, puntajesRelativos, ROLES, barra, encaje, jugadoresDelMensaje, colorPremier } from "../src/formacion.js";
import { firmaValida } from "../src/firma.js";
import { atender, usuariosElegidos, delCanalDeVoz } from "../src/comando-team.js";
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
  const { asignados, variante, cantidad } = armarFormacion(jugadores);
  assert.deepEqual(Object.fromEntries(asignados.map((x) => [x.jugador.usuarioId, x.rol])), {
    awp: "awp", entry: "entry", sup: "support", lurk: "lurker", igl: "igl",
  });
  assert.equal(new Set(asignados.map((x) => x.rol)).size, 5);
  assert.equal(asignados.find((x) => x.rol === "awp").motivo, "Aim 95");
  assert.ok(asignados.every((x) => x.encaje > 50), "cada uno encaja mejor que el promedio en su rol");
  assert.deepEqual([variante, cantidad], [0, 5]);
});

test("Mezclar: cada variante es otra formación y da la vuelta", () => {
  const roles = (v) => armarFormacion(jugadores, { variante: v }).asignados.map((x) => `${x.jugador.usuarioId}:${x.rol}`).join(",");
  const vistas = new Set([0, 1, 2, 3, 4].map(roles));
  assert.equal(vistas.size, 5);
  assert.equal(roles(5), roles(0));
});

test("las stats se comparan dentro del grupo: sin diferencias, todo da 0", () => {
  const z = puntajesRelativos([{ datos: datos({}) }, { datos: datos({}) }]);
  assert.ok(Object.values(z[0]).every((v) => v === 0));
  assert.equal(encaje(0), 50);
});

test("los que no tienen stats se llevan los roles que sobran y se les avisa", () => {
  const f = armarFormacion([jugadores[0], { usuarioId: "nuevo", nombre: "N", datos: null }]);
  assert.equal(f.asignados.length, 2);
  const nuevo = f.asignados.find((x) => x.jugador.usuarioId === "nuevo");
  assert.ok(nuevo.rol && nuevo.rol !== f.asignados.find((x) => x.jugador.usuarioId === "awp").rol);
  const m = mensajeFormacion(f);
  const tarjeta = m.embeds.find((e) => e.description.startsWith("<@nuevo>"));
  assert.match(tarjeta.description, /Sin stats de Leetify/);
});

test("con más de 5 se usan los primeros 5", () => {
  const seis = [...jugadores, { usuarioId: "extra", nombre: "X", datos: datos({}) }];
  assert.equal(armarFormacion(seis).asignados.length, 5);
});

test("el mensaje: resumen, una tarjeta por jugador con su color, plan de compra y botón Mezclar", () => {
  const m = mensajeFormacion(armarFormacion(jugadores), { origen: "de tu canal de voz" });
  assert.equal(m.embeds.length, 7);
  const [resumen, awp, , , , , compra] = m.embeds;
  assert.match(resumen.description, /\*\*5 jugadores\*\* de tu canal de voz/);
  assert.deepEqual(resumen.fields.map((f) => f.name), ["🏆 Winrate promedio", "🎯 Aim promedio", "🧪 Química del equipo"]);
  assert.equal(awp.title, "🎯 AWPER · A");
  assert.equal(awp.color, ROLES.awp.color);
  assert.match(awp.description, /^<@awp>\n\*.+\*\n\n\*\*Encaje en el rol\*\*\n🟩+⬛* \*\*\d+%\*\*$/u);
  assert.equal(awp.fields[0].name, "Aim");
  assert.match(compra.description, /🎯 \*\*A\*\* — AWP/);
  assert.match(compra.footer.text, /Formación 1 de 5/);
  assert.equal(m.components[0].components[0].custom_id, "mezclar:1");
  assert.deepEqual(m.allowed_mentions, { parse: [] });
});

test("barra de encaje, color por Premier y jugadores del mensaje para Mezclar", () => {
  assert.equal(barra(80, 5), "🟩🟩🟩🟩⬛ **80%**");
  assert.equal(barra(30, 5), "🟥🟥⬛⬛⬛ **30%**");
  assert.equal(colorPremier(16000), 0xc166ff);
  const m = mensajeFormacion(armarFormacion(jugadores));
  assert.deepEqual(jugadoresDelMensaje(m).map((j) => j.usuarioId), ["awp", "entry", "sup", "lurk", "igl"]);
  assert.equal(jugadoresDelMensaje(m)[0].nombre, "A");
});

test("canal de voz: toma a los de tu canal, primero los que tienen stats, hasta 5", () => {
  const voz = { canales: { c1: ["a", "b", "yo", "c", "d", "e"], c2: ["otro"] } };
  const datos = { e: { nombre: "E" }, yo: { nombre: "Yo" } };
  const lista = delCanalDeVoz("yo", voz, datos);
  assert.equal(lista.length, 5);
  assert.deepEqual(lista.slice(0, 2).map((u) => u.usuarioId).sort(), ["e", "yo"]);
  assert.equal(delCanalDeVoz("nadie", voz, datos), null);
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
  const r = await (await atender(peticion(interaccion), { clavePublica, pedir })).json();
  assert.equal(r.type, 4);
  const texto = r.data.embeds.map((e) => e.description).join("\n");
  assert.match(texto, /<@awp>/);
  assert.match(texto, /<@nuevo>\n\*Sin stats/);
  assert.ok(!texto.includes("musica"), "los bots no cuentan");
});

test("función: sin jugadores válidos responde en privado", async () => {
  const interaccion = { type: 2, data: { name: "team", options: [{ name: "jugador1", value: "b" }], resolved: { users: { b: { bot: true } } } } };
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

test("función: /team sin jugadores usa tu canal de voz, o te avisa si no estás en ninguno", async () => {
  const pedir = async (url) => ({
    ok: true,
    json: async () => (url.endsWith("voz.json") ? { canales: { c1: ["awp", "entry", "yo"] } } : { jugadores: { awp: jugadores[0].datos, entry: jugadores[1].datos } }),
  });
  const conVoz = { type: 2, member: { user: { id: "yo" } }, data: { name: "team" } };
  const r = await (await atender(peticion(conVoz), { clavePublica, pedir })).json();
  assert.match(r.data.embeds[0].description, /\*\*3 jugadores\*\* de tu canal de voz/);
  const sinVoz = { ...conVoz, member: { user: { id: "ausente" } } };
  const r2 = await (await atender(peticion(sinVoz), { clavePublica, pedir })).json();
  assert.equal(r2.data.flags, 64);
  assert.match(r2.data.content, /canal de voz/);
});

test("función: Mezclar edita el mismo mensaje con la formación siguiente", async () => {
  const pedir = async () => ({ ok: true, json: async () => ({ jugadores: Object.fromEntries(jugadores.map((j) => [j.usuarioId, j.datos])) }) });
  const anterior = mensajeFormacion(armarFormacion(jugadores));
  const click = { type: 3, data: { custom_id: "mezclar:1" }, message: { embeds: anterior.embeds } };
  const r = await (await atender(peticion(click), { clavePublica, pedir })).json();
  assert.equal(r.type, 7);
  assert.match(r.data.embeds.at(-1).footer.text, /Formación 2 de 5/);
  assert.equal(r.data.components[0].components[0].custom_id, "mezclar:2");
});

test("función: /stats, /comparar y /smoke", async () => {
  const datos = Object.fromEntries(jugadores.map((j) => [j.usuarioId, { ...j.datos, nombre: j.nombre }]));
  const pedir = async () => ({ ok: true, json: async () => ({ jugadores: datos }) });
  const llamar = async (data, extra = {}) => (await (await atender(peticion({ type: 2, data, ...extra }), { clavePublica, pedir })).json()).data;
  assert.equal((await llamar({ name: "stats", options: [{ name: "jugador", value: "awp" }] })).embeds[0].title, "A");
  // Sin elegir: las tuyas
  assert.equal((await llamar({ name: "stats" }, { member: { user: { id: "sup" } } })).embeds[0].title, "S");
  assert.match((await llamar({ name: "stats", options: [{ name: "jugador", value: "nadie" }] })).content, /no está vinculado/);
  const c = await llamar({ name: "comparar", options: [{ name: "jugador1", value: "awp" }, { name: "jugador2", value: "igl" }] });
  assert.equal(c.embeds[0].title, "⚔️ A vs I");
  assert.equal(c.embeds.length, 3);
  assert.match((await llamar({ name: "comparar", options: [{ name: "jugador1", value: "awp" }] }, { member: { user: { id: "awp" } } })).content, /distintos/);
  assert.equal((await llamar({ name: "smoke", options: [{ name: "mapa", value: "nuke" }] })).embeds[0].title, "💨 SMOKES DE NUKE");
});

test("función: /forma, /jugamos y sus botones (el aviso de completo va aparte)", async () => {
  const datos = { awp: { ...jugadores[0].datos, nombre: "A", recientes: [{ id: "m", mapa: "de_mirage", ganados: 13, perdidos: 2, k: 20, d: 5, a: 1, adr: 120, rating: 9 }] } };
  const pedir = async () => ({ ok: true, json: async () => ({ jugadores: datos }) });
  const llamar = async (obj, extra = {}) => (await (await atender(peticion(obj), { clavePublica, pedir, ...extra })).json());
  assert.equal((await llamar({ type: 2, data: { name: "forma" }, member: { user: { id: "awp" } } })).data.embeds[0].title, "📈 A");

  const conv = await llamar({ type: 2, data: { name: "jugamos", options: [{ name: "hora", value: "22" }, { name: "modo", value: "wingman" }] }, member: { user: { id: "1" } } });
  assert.equal(conv.data.embeds[0].title, "🤝 Wingman a las 22:00");

  const avisos = [];
  const click = { type: 3, application_id: "app", token: "tok", data: { custom_id: "jugamos:si:wingman" }, member: { user: { id: "2" } }, message: conv.data };
  const r = await llamar(click, { despues: (promesa) => avisos.push(promesa), pedir: async (url, opciones) => (url.includes("/webhooks/") ? (avisos.push(url), { ok: true }) : pedir()) });
  assert.equal(r.type, 7);
  assert.match(r.data.embeds[0].description, /Equipo completo/);
  assert.ok(avisos.some((a) => typeof a === "string" && a.endsWith("/webhooks/app/tok")), "manda el aviso que notifica");

  // Un tercero en wingman: ya está completo, le avisa solo a él
  const lleno = await llamar({ ...click, member: { user: { id: "3" } }, message: r.data });
  assert.equal(lleno.data.flags, 64);
});
