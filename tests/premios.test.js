import { test } from "node:test";
import assert from "node:assert/strict";
import { fotoDeVoz, quienesCuentan, sumar, semanaParaPremios } from "../src/voz.js";
import { canalesDeChat, contarMensajes, top, horas, mensajePremios, anunciosPrevios, ejecutarPremios } from "../src/premios.js";

const idEn = (ms, n = 0) => String(((BigInt(ms) - 1420070400000n) << 22n) + BigInt(n));

// ---------- Voz ----------

test("la foto de voz: se identifica sin intents privilegiados y devuelve los estados", async () => {
  const enviados = [];
  class WSFalso {
    constructor() { setTimeout(() => this.onmessage({ data: JSON.stringify({ op: 10, d: { heartbeat_interval: 40000 } }) })); }
    send(m) {
      enviados.push(JSON.parse(m));
      if (JSON.parse(m).op === 2) {
        setTimeout(() => this.onmessage({ data: JSON.stringify({ op: 0, t: "GUILD_CREATE", d: {
          id: "g", afk_channel_id: "afk",
          voice_states: [{ user_id: "1", channel_id: "c1" }],
          members: [{ user: { id: "musica", bot: true } }],
        } }) }));
      }
    }
    close() {}
  }
  const foto = await fotoDeVoz("token", "g", { WS: WSFalso });
  assert.equal(enviados[0].d.intents, 129);
  assert.equal(foto.afk, "afk");
  assert.deepEqual([...foto.bots], ["musica"]);
  assert.equal(foto.estados.length, 1);
});

test("cuentan los que están acompañados: no AFK, no solos, no ensordecidos, no bots", () => {
  const estados = [
    { user_id: "a", channel_id: "c1" }, { user_id: "b", channel_id: "c1" },
    { user_id: "solo", channel_id: "c2" },
    { user_id: "dormido", channel_id: "afk" }, { user_id: "dormido2", channel_id: "afk" },
    { user_id: "sordo", channel_id: "c3", self_deaf: true }, { user_id: "c", channel_id: "c3" },
    { user_id: "d", channel_id: "c4" }, { user_id: "musica", channel_id: "c4" },
  ];
  assert.deepEqual(quienesCuentan({ estados, afk: "afk", bots: new Set(["musica"]) }).sort(), ["a", "b"]);
});

test("suma 5 minutos por vuelta, sin contar dos veces la misma vuelta", () => {
  const jueves = Date.parse("2026-10-08T20:00:00Z");
  let r = sumar(null, ["a", "b"], jueves);
  assert.deepEqual(r.minutos, { a: 5, b: 5 });
  // El workflow corrió dos veces seguidas: la segunda no suma
  assert.deepEqual(sumar(r, ["a"], jueves + 30e3).minutos, { a: 5, b: 5 });
  r = sumar(r, ["a"], jueves + 5 * 60e3);
  assert.deepEqual(r.minutos, { a: 10, b: 5 });
  // Nadie en voz: el registro no cambia (así no hay commit)
  assert.equal(sumar(r, [], jueves + 10 * 60e3), r);
});

test("con vueltas de 15 suma 15, y al cambiar de semana guarda la anterior", () => {
  const jueves = Date.parse("2026-10-08T20:00:00Z");
  const sabado = Date.parse("2026-10-10T20:00:00Z");
  let r = sumar(null, ["a", "b"], jueves, 15);
  r = sumar(r, ["a"], jueves + 15 * 60e3, 15);
  assert.deepEqual(r.minutos, { a: 30, b: 15 });
  // Viernes 12:30: la semana ya terminó pero la voz todavía no la cerró → usa la que está
  assert.deepEqual(semanaParaPremios(r, Date.parse("2026-10-09T15:30:00Z")), { a: 30, b: 15 });
  // Antes del viernes a las 12, la última terminada es la anterior (acá no hay)
  assert.deepEqual(semanaParaPremios(r, Date.parse("2026-10-09T14:00:00Z")), {});
  r = sumar(r, ["c"], sabado, 15);
  assert.deepEqual(r.minutos, { c: 15 });
  assert.deepEqual(r.anterior.minutos, { a: 30, b: 15 });
  assert.deepEqual(semanaParaPremios(r, sabado), { a: 30, b: 15 });
  assert.deepEqual(semanaParaPremios(null, sabado), {});
});

// ---------- Chat ----------

test("canales de chat: solo los de texto dentro de COMUNIDAD y COUNTER", () => {
  const canales = [
    { id: "cat1", type: 4, name: "『💬』 COMUNIDAD" }, { id: "cat2", type: 4, name: "『🔘』COUNTER" }, { id: "cat3", type: 4, name: "『🛡』 STAFF" },
    { id: "general", type: 0, parent_id: "cat1" }, { id: "cs", type: 0, parent_id: "cat2" },
    { id: "staff", type: 0, parent_id: "cat3" }, { id: "voz", type: 2, parent_id: "cat1" }, { id: "suelto", type: 0 },
  ];
  assert.deepEqual(canalesDeChat(canales).map((c) => c.id), ["general", "cs"]);
  assert.deepEqual(canalesDeChat(canales, ["staff"]).map((c) => c.id), ["staff"]);
});

test("cuenta mensajes de la semana, sin bots y juntando las ráfagas", () => {
  const ahora = Date.parse("2026-10-09T15:00:00Z");
  const m = (seg, autor, extra = {}) => ({ id: idEn(ahora - seg * 1000, seg), author: { id: autor, ...extra } });
  const general = [m(100, "a"), m(98, "a"), m(90, "a"), m(50, "b"), m(40, "bot", { bot: true }), m(8 * 86400, "a")];
  const cs = [m(30, "b"), m(20, "b")];
  // a: 100 y 98 son ráfaga (cuentan 1), 90 cuenta; el de hace 8 días no
  assert.deepEqual(contarMensajes([general, cs], { ahora }), { a: 2, b: 3 });
  assert.deepEqual(top({ a: 2, b: 3, c: 0 }), [["b", 3], ["a", 2]]);
  assert.equal(horas(750), "12 h 30 min");
  assert.equal(horas(120), "2 h");
  assert.equal(horas(45), "45 min");
});

// ---------- Anuncio ----------

test("el anuncio: podio de chat y de voz, notifica solo a los ganadores", () => {
  const m = mensajePremios({ chat: [["1", 342], ["2", 200]], voz: [["3", 750]], rolChat: "r1", rolVoz: "r2" });
  assert.match(m.content, /<@1> y <@3>/);
  const [chat, enVoz] = m.embeds[0].fields;
  assert.equal(chat.value, "🥇 <@1> · 342 mensajes\n🥈 <@2> · 200 mensajes");
  assert.equal(enVoz.value, "🥇 <@3> · 12 h 30 min");
  assert.match(m.embeds[0].description, /<@&r1> y <@&r2>/);
  assert.deepEqual(m.allowed_mentions, { parse: [], users: ["1", "3"] });
  assert.match(mensajePremios({ chat: [], voz: [] }).embeds[0].fields[1].value, /Nadie/);
});

test("lee quién ganó la semana pasada y no repite el anuncio", () => {
  const ahora = Date.parse("2026-10-09T16:00:00Z");
  const anuncio = (ms) => ({ id: idEn(ms), author: { id: "bot" }, ...mensajePremios({ chat: [["11", 5]], voz: [["22", 60]] }) });
  assert.deepEqual(anunciosPrevios([anuncio(ahora - 7 * 86400e3)], { botId: "bot", ahora }), { yaAnunciado: false, chatAnterior: "11", vozAnterior: "22" });
  assert.equal(anunciosPrevios([anuncio(ahora - 3600e3)], { botId: "bot", ahora }).yaAnunciado, true);
});

test("vuelta completa: anuncia y pasa las medallas", async () => {
  const ahora = Date.parse("2026-10-09T15:05:00Z");
  const acciones = [];
  const msg = (seg, autor) => ({ id: idEn(ahora - seg * 1000, seg), author: { id: autor } });
  const cliente = {
    yo: async () => ({ id: "bot" }),
    mensajes: async () => [{ id: idEn(ahora - 7 * 86400e3), author: { id: "bot" }, ...mensajePremios({ chat: [["111", 1]], voz: [] }) }],
    canal: async () => ({ guild_id: "g" }),
    canalesDelServidor: async () => [{ id: "cat", type: 4, name: "COMUNIDAD" }, { id: "general", type: 0, parent_id: "cat", name: "general" }],
    mensajesDesde: async () => [msg(100, "222"), msg(50, "222"), msg(10, "333")],
    enviar: async (c, cuerpo) => acciones.push(`anuncia ${cuerpo.embeds[0].fields[0].value.split("\n")[0]}`),
    sacarRol: async (g, u, r) => acciones.push(`saca ${r} ${u}`),
    ponerRol: async (g, u, r) => acciones.push(`pone ${r} ${u}`),
  };
  const registroVoz = { semana: "2026-10-02T15:00:00.000Z", minutos: { 444: 90 }, anterior: null };
  const r = await ejecutarPremios({ cliente, canalPremios: "p", rolChat: "rc", rolVoz: "rv", registroVoz, ahora });
  assert.equal(r.estado, "ok");
  assert.deepEqual(acciones, ["anuncia 🥇 <@222> · 2 mensajes", "saca rc 111", "pone rc 222", "pone rv 444"]);
});

test("modo prueba: cuenta pero no publica ni toca roles, aunque ya haya anuncio", async () => {
  const ahora = Date.parse("2026-10-10T16:00:00Z");
  const acciones = [];
  const cliente = {
    yo: async () => ({ id: "bot" }),
    mensajes: async () => [{ id: idEn(ahora - 3600e3), author: { id: "bot" }, ...mensajePremios({ chat: [["1", 1]], voz: [] }) }],
    canal: async () => ({ guild_id: "g" }),
    canalesDelServidor: async () => [{ id: "cat", type: 4, name: "COUNTER" }, { id: "cs", type: 0, parent_id: "cat", name: "general-conter" }],
    mensajesDesde: async () => [{ id: idEn(ahora - 60e3), author: { id: "7" } }],
    enviar: async () => acciones.push("envia"),
    ponerRol: async () => acciones.push("rol"),
    sacarRol: async () => acciones.push("rol"),
  };
  const r = await ejecutarPremios({ cliente, canalPremios: "p", rolChat: "rc", registroVoz: { minutos: { 9: 20 } }, ahora, prueba: true });
  assert.deepEqual(r, { estado: "prueba", canales: ["general-conter"], chat: [["7", 1]], voz: [["9", 20]] });
  assert.deepEqual(acciones, []);
});
