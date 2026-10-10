import { test } from "node:test";
import assert from "node:assert/strict";
import { slugDeKick, leerConfigWeb, juntarStreamers, resumirCanal, duracion } from "../src/kick.js";
import { alertasPrevias, revisarStreams, mensajeEnVivo, embedTerminado } from "../src/streams.js";
import { embedsRedes, hayCambios, TITULO, IMAGENES, proximaMeta, barra, compacto } from "../src/redes.js";

// ---------- Kick ----------

test("entiende el canal de Kick en cualquier formato", () => {
  assert.equal(slugDeKick("ibrandou"), "ibrandou");
  assert.equal(slugDeKick("https://kick.com/iBranDou?ref=x"), "ibrandou");
  assert.equal(slugDeKick(" kick.com/ikyooo/ "), "ikyooo");
  assert.equal(slugDeKick(""), null);
  assert.equal(slugDeKick("con espacios"), null);
});

test("lee la lista de streamers del config.js de la página, aislado", () => {
  const codigo = `const CONFIG = { codigoInvitacion: "abc", streamers: [{ nombre: "Joacooo", kick: "joacooow" }] };
if (typeof module !== "undefined") module.exports = CONFIG;`;
  const c = leerConfigWeb(codigo);
  assert.equal(c.codigoInvitacion, "abc");
  assert.equal(c.streamers[0].kick, "joacooow");
  // No tiene acceso a nada de Node
  assert.throws(() => leerConfigWeb("process.exit(1)"));
  assert.throws(() => leerConfigWeb("while (true) {}"));
});

test("junta los de la página con los de KICK_EXTRA, sin repetir", () => {
  const lista = juntarStreamers([{ nombre: "Joacooo", kick: "joacooow" }, { nombre: "Kyo", kick: "ikyooo" }], "nuevo, kick.com/IKYOOO ,, x y");
  assert.deepEqual(lista, [
    { nombre: "Joacooo", slug: "joacooow" },
    { nombre: "Kyo", slug: "ikyooo" },
    { nombre: null, slug: "nuevo" },
  ]);
  assert.deepEqual(juntarStreamers(undefined, ""), []);
});

test("resume la respuesta de Kick como la página", () => {
  const c = resumirCanal({
    slug: "ibrandou", user: { username: "iBranDou", profile_pic: "https://x/p.png" },
    livestream: { id: 77, is_live: true, session_title: "Rankeds", viewer_count: 12, start_time: "2026-10-09 20:00:00",
      categories: [{ name: "Counter-Strike 2" }], thumbnail: { url: "https://x/t.jpg" } },
  });
  assert.equal(c.enVivo, true);
  assert.equal(c.sesion, "77");
  assert.equal(c.categoria, "Counter-Strike 2");
  assert.equal(c.inicio, Date.parse("2026-10-09T20:00:00Z"));
  assert.equal(resumirCanal({ slug: "x", livestream: null }).enVivo, false);
  assert.equal(duracion(0, 135 * 60e3), "2 h 15 min");
  assert.equal(duracion(0, 45 * 60e3), "45 min");
});

// ---------- Alertas ----------

const ibran = { nombre: "iBranDou", slug: "ibrandou" };
const enVivo = (sesion) => ({ nombre: "iBranDou", enVivo: true, sesion, titulo: "Rankeds", categoria: "CS2", inicio: Date.parse("2026-10-09T20:00:00Z"), avatar: "", miniatura: "" });
const offline = { nombre: "iBranDou", enVivo: false, sesion: null };
const alertaDe = (sesion, rolId) => ({ id: `m${sesion}`, author: { id: "bot" }, embeds: mensajeEnVivo(ibran, enVivo(sesion), rolId).embeds });

test("avisa una sola vez por stream", () => {
  assert.equal(revisarStreams([{ streamer: ibran, canal: enVivo("1") }], []).nuevas.length, 1);
  const previas = alertasPrevias([alertaDe("1")], "bot");
  assert.deepEqual(revisarStreams([{ streamer: ibran, canal: enVivo("1") }], previas), { nuevas: [], cerrar: [] });
  // Un stream nuevo (otra sesión) sí avisa, y cierra el anterior
  const r = revisarStreams([{ streamer: ibran, canal: enVivo("2") }], previas);
  assert.equal(r.nuevas.length, 1);
  assert.equal(r.cerrar.length, 1);
});

test("cuando termina, cierra la alerta; si Kick no responde, no toca nada", () => {
  const previas = alertasPrevias([alertaDe("1")], "bot");
  assert.equal(revisarStreams([{ streamer: ibran, canal: offline }], previas).cerrar.length, 1);
  assert.deepEqual(revisarStreams([{ streamer: ibran, canal: null }], previas), { nuevas: [], cerrar: [] });
});

test("la alerta: título, link, categoría, sesión y solo el rol de streams", () => {
  const m = mensajeEnVivo(ibran, enVivo("9"), "555");
  assert.match(m.content, /iBranDou.*prendió.*<@&555>/);
  assert.equal(m.embeds[0].title, "🔴 iBranDou está en vivo en Kick");
  assert.equal(m.embeds[0].url, "https://kick.com/ibrandou");
  assert.match(m.embeds[0].description, /\*\*Rankeds\*\*\nCS2\n👉 https:\/\/kick\.com\/ibrandou/);
  assert.equal(m.embeds[0].footer.text, "Kick · sesión 9");
  assert.deepEqual(m.allowed_mentions, { parse: [], roles: ["555"] });
});

test("la alerta terminada dice cuánto duró y ya no cuenta como abierta", () => {
  const [a] = alertasPrevias([alertaDe("1")], "bot");
  const e = embedTerminado(a, Date.parse("2026-10-09T22:15:00Z"));
  assert.equal(e.title, "⚫ iBranDou terminó el stream");
  assert.match(e.description, /\*\*Rankeds\*\*\nDuró 2 h 15 min/);
  const cerrada = alertasPrevias([{ id: "m1", author: { id: "bot" }, embeds: [e] }], "bot");
  assert.equal(cerrada[0].terminada, true);
});

// ---------- #redes ----------

test("la tarjeta de redes: portada, página, TikTok, Kick e invitación, cada una con su color", () => {
  const embeds = embedsRedes({
    streamers: [
      { streamer: { nombre: "Joacooo", slug: "joacooow" }, canal: { enVivo: false } },
      { streamer: ibran, canal: { ...enVivo("1"), espectadores: 12, miniatura: "https://x/t.jpg" } },
      { streamer: { nombre: null, slug: "nuevo" }, canal: null },
    ],
    tiktok: {
      usuario: "brosss.clips",
      videos: [{ id: "123", titulo: "tomatomatoma", vistas: 1500 }],
      perfil: { seguidores: 15400, meGusta: 202500 },
    },
    invitacion: "th8xGPTBDX",
    stats: { miembros: 147, conectados: 19 },
  });
  assert.equal(embeds.length, 5);
  const [portada, web, tiktok, kick, inv] = embeds;
  assert.equal(portada.title, TITULO);
  assert.equal(portada.image.url, IMAGENES.banner);
  assert.match(portada.description, /\*\*147\*\* miembros.*\*\*19\*\* conectados/);
  assert.equal(web.url, "https://brosssdiscord.netlify.app");
  assert.deepEqual(tiktok.fields.map((f) => f.value), [
    "## 15,4K",
    "## 202,5K",
    "[tomatomatoma](https://www.tiktok.com/@brosss.clips/video/123) · 👀 1.500",
  ]);
  assert.match(tiktok.description, /Vamos por los 20\.000\*\* · faltan 4\.600\n▰+▱+ \*\*77%\*\*/);
  // Kick: el que está en vivo es el destacado, va primero y muestra su directo
  assert.equal(kick.title, "🔴 iBranDou está en vivo");
  assert.equal(kick.image.url, "https://x/t.jpg");
  assert.deepEqual(kick.fields.map((f) => f.name), ["🔴 iBranDou", "⚫ Joacooo", "▫️ nuevo"]);
  assert.match(kick.fields[0].value, /EN VIVO.*12 👀/);
  assert.equal(inv.url, "https://discord.gg/th8xGPTBDX");
  assert.equal(new Set(embeds.map((e) => e.color)).size, 4);
  // Si dos tarjetas tienen el mismo link, Discord las junta en una
  const links = embeds.map((e) => e.url).filter(Boolean);
  assert.equal(new Set(links).size, links.length);
});

test("sin nadie en vivo, Kick no tiene imagen; sin stats, la portada igual sale", () => {
  const [portada, , kick] = embedsRedes({ streamers: [{ streamer: ibran, canal: { enVivo: false } }] });
  assert.ok(!/miembros/.test(portada.description));
  assert.equal(kick.title, "Nuestros streamers");
  assert.equal(kick.image, undefined);
});

test("solo edita si cambió algo visible", () => {
  const embeds = embedsRedes({ invitacion: "abc", stats: { miembros: 1, conectados: 1 } });
  assert.equal(hayCambios({ embeds: structuredClone(embeds) }, embeds), false);
  assert.equal(hayCambios({ embeds }, embedsRedes({ invitacion: "abc", stats: { miembros: 2, conectados: 1 } })), true);
  assert.equal(hayCambios(null, embeds), true);
});

test("números cortos, próxima meta y barra de progreso", () => {
  assert.equal(compacto(15400), "15,4K");
  assert.equal(compacto(202500), "202,5K");
  assert.equal(compacto(1250000), "1,3M");
  assert.equal(compacto(950), "950");
  assert.deepEqual([800, 15400, 20000, 21000, 60000, 99000].map(proximaMeta), [1000, 20000, 25000, 25000, 75000, 100000]);
  assert.equal(barra(15400, 20000, 10), "▰▰▰▰▰▰▰▰▱▱ **77%**");
  assert.equal(barra(30000, 20000, 4), "▰▰▰▰ **100%**");
});
