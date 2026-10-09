import { test } from "node:test";
import assert from "node:assert/strict";
import { AREAS, distancia, puntoFlojo, embedJugador, armarMensajes, ejecutarConsejos } from "../src/consejos.js";

test("cada área tiene todo lo que necesita el mensaje", () => {
  for (const [nombre, a] of Object.entries(AREAS)) {
    assert.ok(a.titulo && a.consejo && a.video.startsWith("https://www.youtube.com/"), nombre);
    assert.ok(String(a.formato(a.objetivo)).length > 0, nombre);
    if (a.practica) assert.ok(a.practica[1].startsWith("https://steamcommunity.com/workshop/"), nombre);
  }
});

test("la distancia respeta si más es mejor o peor", () => {
  assert.ok(distancia("hs", 11) > 0); // 11% de HS: le falta
  assert.ok(distancia("hs", 30) < 0);
  assert.ok(distancia("reaccion", 700) > 0); // 700 ms: lento
  assert.ok(distancia("reaccion", 400) < 0);
});

test("elige el área más lejos del objetivo e ignora las que no tienen dato", () => {
  // HS al 50% del objetivo, aim al 90%: el flojo es HS
  const f = puntoFlojo({ aim: 54, hs: 11, preaim: null });
  assert.equal(f.area, "hs");
  assert.equal(f.bien, false);
  assert.equal(puntoFlojo({}), null);
});

test("si está bien en todo, lo felicita por su mejor área", () => {
  const f = puntoFlojo({ aim: 95, hs: 23 });
  assert.equal(f.bien, true);
  assert.equal(f.area, "aim");
  assert.match(embedJugador({ usuarioId: "1", areas: { aim: 95, hs: 23 } }).description, /Seguí así/);
});

test("el consejo menciona al jugador, muestra su valor, el objetivo y los links", () => {
  const e = embedJugador({ usuarioId: "42", areas: { hs: 16 } });
  assert.match(e.description, /<@42>/);
  assert.match(e.description, /16%.*objetivo: 22%/);
  assert.match(e.description, /\[Aim Botz\]\(https:\/\/steamcommunity\.com/);
  assert.match(e.description, /\[Videos\]\(https:\/\/www\.youtube\.com/);
  assert.equal(embedJugador({ usuarioId: "1", areas: {} }), null);
});

test("de a 10 por mensaje, sin notificar a nadie y con el título solo en el primero", () => {
  const jugadores = Array.from({ length: 12 }, (_, i) => ({ usuarioId: String(i), areas: { hs: 10 } }));
  const m = armarMensajes(jugadores, { canalVincular: "7" });
  assert.equal(m.length, 2);
  assert.equal(m[0].embeds.length, 10);
  assert.equal(m[1].embeds.length, 2);
  assert.match(m[0].content, /Consejos de la semana[\s\S]*<#7>/);
  assert.equal(m[1].content, undefined);
  assert.deepEqual(m[0].allowed_mentions, { parse: [] });
  assert.deepEqual(armarMensajes([]), []);
});

test("vuelta completa: solo los que están en Leetify reciben consejo", async () => {
  const enviados = [];
  const cliente = {
    mensajes: async () => [
      { id: "1", content: "76561190000000001", author: { id: "a", username: "a" } },
      { id: "2", content: "76561190000000002", author: { id: "b", username: "b" } },
    ],
    enviar: async (canal, cuerpo) => enviados.push({ canal, cuerpo }),
  };
  const pedir = async (url) =>
    url.includes("0000001")
      ? { status: 200, ok: true, json: async () => ({ privacy_mode: "public", ranks: {}, stats: { accuracy_head: 12 } }) }
      : { status: 404, ok: false };
  const r = await ejecutarConsejos({ cliente, pedir, canalVincular: "v", canalTips: "t" });
  assert.deepEqual(r, { jugadores: 1, mensajes: 1 });
  assert.equal(enviados[0].canal, "t");
  assert.match(enviados[0].cuerpo.embeds[0].description, /<@a>.*Headshots/);
});
