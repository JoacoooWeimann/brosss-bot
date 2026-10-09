import { test } from "node:test";
import assert from "node:assert/strict";
import { publicadosAntes, tocaPublicar, elegirMeme, mensajeMeme, buscarMeme } from "../src/memes.js";
import {
  esMeme, puntajeRapido, candidatos, contarValidas, anunciosPrevios, mensajeGanador, ejecutarMemeSemana,
} from "../src/meme-semana.js";

const idEn = (iso, n = 0) => String(((BigInt(Date.parse(iso)) - 1420070400000n) << 22n) + BigInt(n));
const meme = (extra = {}) => ({
  title: "Como avanza la tecnologia", postLink: "https://redd.it/a", url: "https://i.redd.it/abc.png",
  subreddit: "MemesEnEspanol", ups: 81, nsfw: false, spoiler: false, ...extra,
});

// ---------- Reddit ----------

test("reconoce sus memes y la hora del último", () => {
  const propio = { id: idEn("2026-10-09T12:00:00Z"), author: { id: "bot" }, embeds: mensajeMeme(meme()).embeds };
  const r = publicadosAntes([propio, { id: idEn("2026-10-09T13:00:00Z"), author: { id: "x" }, embeds: [] }], "bot");
  assert.deepEqual([...r.links], ["https://redd.it/a"]);
  assert.equal(r.ultimo, Date.parse("2026-10-09T12:00:00Z"));
});

test("publica cada 6 horas y nunca de madrugada", () => {
  const ultimo = Date.parse("2026-10-09T12:00:00Z"); // 9 hs en Argentina
  assert.equal(tocaPublicar({ ultimo, ahora: Date.parse("2026-10-09T17:00:00Z") }), false); // 5 h después
  assert.equal(tocaPublicar({ ultimo, ahora: Date.parse("2026-10-09T18:00:00Z") }), true); // 15 hs AR
  assert.equal(tocaPublicar({ ultimo: 0, ahora: Date.parse("2026-10-10T07:00:00Z") }), false); // 4 hs AR
  assert.equal(tocaPublicar({ ultimo: 0, ahora: Date.parse("2026-10-10T04:30:00Z") }), true); // 1:30 AR
});

test("con 15 minutos publica en cada vuelta, aunque llegue unos segundos antes", () => {
  const ultimo = Date.parse("2026-10-09T23:00:17Z");
  assert.equal(tocaPublicar({ ultimo, ahora: Date.parse("2026-10-09T23:15:05Z"), cada: 15 * 60e3 }), true);
  assert.equal(tocaPublicar({ ultimo, ahora: Date.parse("2026-10-09T23:05:00Z"), cada: 15 * 60e3 }), false);
});

test("elige el más votado apto: sin NSFW, spoilers, pocos votos, videos ni repetidos", () => {
  const lista = [
    meme({ postLink: "1", ups: 5000, nsfw: true }),
    meme({ postLink: "2", ups: 4000, spoiler: true }),
    meme({ postLink: "3", ups: 10 }),
    meme({ postLink: "4", ups: 3000, url: "https://v.redd.it/video" }),
    meme({ postLink: "5", ups: 2000 }),
    meme({ postLink: "6", ups: 900 }),
  ];
  assert.equal(elegirMeme(lista, new Set()).postLink, "5");
  assert.equal(elegirMeme(lista, new Set(["5"])).postLink, "6");
  assert.equal(elegirMeme([], new Set()), null);
});

test("si un subreddit no tiene nada nuevo, prueba el otro", async () => {
  const pedir = async (url) => ({
    ok: true,
    json: async () => ({ memes: url.includes("csgomemes") ? [meme({ postLink: "cs", subreddit: "csgomemes" })] : [] }),
  });
  const m = await buscarMeme(["MemesEnEspanol", "csgomemes"], new Set(), pedir, () => 0.9);
  assert.equal(m.postLink, "cs");
});

test("el embed lleva título, imagen, link y la marca en el pie", () => {
  const e = mensajeMeme(meme()).embeds[0];
  assert.equal(e.url, "https://redd.it/a");
  assert.equal(e.image.url, "https://i.redd.it/abc.png");
  assert.match(e.footer.text, /^📥 Meme del día · r\/MemesEnEspanol · 81 ⬆$/);
});

// ---------- Meme de la semana ----------

const ahora = Date.parse("2026-10-09T15:00:00Z");
const subido = (n, iso, reacciones, extra = {}) => ({
  id: idEn(iso, n), author: { id: `u${n}`, username: `user${n}` },
  attachments: [{ content_type: "image/png" }], reactions: reacciones, content: "", ...extra,
});
const r = (name, count) => ({ emoji: { name }, count });

test("un meme es una imagen, video, GIF o link a uno, subido por una persona", () => {
  assert.ok(esMeme(subido(1, "2026-10-08T10:00:00Z", [])));
  assert.ok(esMeme({ author: {}, embeds: [{ type: "gifv" }] }));
  assert.ok(esMeme({ author: {}, content: "mirá https://tenor.com/view/xyz" }));
  assert.ok(!esMeme({ author: {}, content: "jajaja" }));
  assert.ok(!esMeme({ author: { bot: true }, embeds: [{ type: "image" }] }));
});

test("candidatos: solo los últimos 7 días, con reacciones de risa, ordenados", () => {
  const lista = candidatos(
    [
      subido(1, "2026-10-08T10:00:00Z", [r("😂", 3), r("💀", 2)]),
      subido(2, "2026-10-07T10:00:00Z", [r("🤣", 9)]),
      subido(3, "2026-09-30T10:00:00Z", [r("😂", 50)]), // de hace más de 7 días
      subido(4, "2026-10-08T11:00:00Z", [r("❤️", 20)]), // otra reacción
    ],
    { ahora }
  );
  assert.deepEqual(lista.map((m) => m.author.id), ["u2", "u1"]);
  assert.equal(puntajeRapido(lista[1]), 5);
});

test("no cuentan las reacciones del autor ni de bots", () => {
  assert.equal(contarValidas("autor", [[{ id: "autor" }, { id: "a" }, { id: "b", bot: true }], [{ id: "c" }]]), 2);
});

test("sabe si ya anunció esta semana y quién ganó la anterior", () => {
  const anuncio = (iso, uid) => ({ id: idEn(iso), author: { id: "bot" }, content: `🏆 **¡Meme de la semana!** Felicitaciones <@${uid}>: **5**` });
  const vieja = anunciosPrevios([anuncio("2026-10-02T15:10:00Z", "111")], { botId: "bot", ahora });
  assert.deepEqual(vieja, { yaAnunciado: false, ganadorAnterior: "111" });
  assert.equal(anunciosPrevios([anuncio("2026-10-09T15:01:00Z", "222")], { botId: "bot", ahora: ahora + 3600e3 }).yaAnunciado, true);
});

test("el anuncio responde al meme y notifica solo al ganador", () => {
  const m = mensajeGanador({ id: "99", author: { id: "7" } }, 12, "55");
  assert.match(m.content, /Meme de la semana.*<@7>.*\*\*12\*\*[\s\S]*<@&55>/);
  assert.equal(m.message_reference.message_id, "99");
  assert.deepEqual(m.allowed_mentions.users, ["7"]);
  assert.deepEqual(m.allowed_mentions.parse, []);
});

test("vuelta completa: gana el de más reacciones válidas y la medalla cambia de dueño", async () => {
  const acciones = [];
  const mensajes = [
    // u1 tiene más 😂 en el contador, pero 3 son suyas o de bots
    subido(1, "2026-10-08T10:00:00Z", [r("😂", 4)]),
    subido(2, "2026-10-07T10:00:00Z", [r("💀", 3)]),
    { id: idEn("2026-10-02T15:10:00Z"), author: { id: "bot" }, content: "🏆 **¡Meme de la semana!** Felicitaciones <@111>: **2**" },
  ];
  const reactores = {
    [mensajes[0].id]: [{ id: "u1" }, { id: "b", bot: true }, { id: "c", bot: true }, { id: "x" }],
    [mensajes[1].id]: [{ id: "x" }, { id: "y" }, { id: "z" }],
  };
  const cliente = {
    yo: async () => ({ id: "bot" }),
    mensajes: async () => mensajes,
    reacciones: async (c, m) => reactores[m],
    enviar: async (c, cuerpo) => acciones.push(`envia ${cuerpo.message_reference.message_id}`),
    canal: async () => ({ guild_id: "g" }),
    sacarRol: async (g, u) => acciones.push(`saca ${u}`),
    ponerRol: async (g, u) => acciones.push(`pone ${u}`),
  };
  const res = await ejecutarMemeSemana({ cliente, canalMemes: "m", rolMeme: "rol", ahora });
  assert.equal(res.estado, "ok");
  assert.equal(res.puntos, 3);
  assert.deepEqual(acciones, [`envia ${mensajes[1].id}`, "saca 111", "pone u2"]);
});

test("sin memes con reacciones no hay ganador", async () => {
  const cliente = { yo: async () => ({ id: "bot" }), mensajes: async () => [] };
  assert.deepEqual(await ejecutarMemeSemana({ cliente, canalMemes: "m", ahora }), { estado: "sin-memes" });
});
