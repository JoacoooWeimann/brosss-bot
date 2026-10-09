import { test } from "node:test";
import assert from "node:assert/strict";
import { leerVideos, limpiarTitulo, fechaDeId, videosNuevos, mensajeVideo, urlVideo } from "../src/tiktok.js";

const pagina = (lista) =>
  `<html><script id="__FRONTITY_CONNECT_STATE__" type="application/json">${JSON.stringify({
    source: { data: { "/embed/@brosss.clips?lang=es": { userInfo: {}, videoList: lista } } },
  })}</script></html>`;

test("la fecha sale del ID del video", () => {
  // 7461024379594345733 → enero de 2025 (el primer clip de @brosss.clips)
  assert.equal(new Date(fechaDeId("7461024379594345733")).toISOString().slice(0, 10), "2025-01-17");
});

test("lee la lista de la página de embed y descarta privados e IDs raros", () => {
  const videos = leerVideos(
    pagina([
      { id: "7461024379594345733", desc: "se desubicó  https://www.twitch.tv/1kyox . . . #csgo #fyp " },
      { id: "7461024379594345734", desc: "privado", privateItem: true },
      { id: "abc", desc: "roto" },
    ])
  );
  assert.equal(videos.length, 1);
  assert.equal(videos[0].titulo, "se desubicó");
  assert.equal(leerVideos("<html>otra cosa</html>"), null);
  assert.equal(leerVideos('<script id="__FRONTITY_CONNECT_STATE__">{roto</script>'), null);
});

test("el título sin hashtags ni links, y cortado si es largo", () => {
  assert.equal(limpiarTitulo("#cs2 #fyp"), "");
  assert.equal(limpiarTitulo("x".repeat(150)).length, 100);
});

test("publica solo los recientes y no repetidos, del más viejo al más nuevo", () => {
  const ahora = Date.parse("2026-10-09T12:00:00Z");
  const seg = (iso) => BigInt(Date.parse(iso) / 1000) << 32n;
  const v = (iso, n) => ({ id: String(seg(iso) + BigInt(n)), titulo: "", fecha: fechaDeId(String(seg(iso) + BigInt(n))) });
  const nuevo = v("2026-10-09T10:00:00Z", 1);
  const anterior = v("2026-10-08T10:00:00Z", 2);
  const yaPublicado = v("2026-10-09T09:00:00Z", 3);
  const viejo = v("2026-09-01T10:00:00Z", 4);
  const lista = videosNuevos([nuevo, viejo, yaPublicado, anterior], {
    ahora,
    publicados: new Set([`🎬 **Clip nuevo**\n${urlVideo("brosss.clips", yaPublicado.id)}`]),
  });
  assert.deepEqual(lista.map((x) => x.id), [anterior.id, nuevo.id]);
});

test("el mensaje lleva el link solo, para que Discord muestre el video", () => {
  const m = mensajeVideo("brosss.clips", { id: "123", titulo: "Humos chidos" });
  assert.equal(m.content, "🎬 **Clip nuevo** · Humos chidos\nhttps://www.tiktok.com/@brosss.clips/video/123");
  assert.equal(mensajeVideo("brosss.clips", { id: "1", titulo: "" }).content.split("\n")[0], "🎬 **Clip nuevo**");
});

test("reintenta si TikTok corta y avisa si sigue fallando", async () => {
  const { consultarTiktok } = await import("../src/tiktok.js");
  const respuestas = [{ status: 503 }, { status: 429 }, { status: 200, ok: true, text: async () => pagina([{ id: "7461024379594345733", desc: "hola" }]) }];
  let n = 0;
  const videos = await consultarTiktok("brosss.clips", async () => respuestas[n++], { espera: 1 });
  assert.equal(n, 3);
  assert.equal(videos[0].titulo, "hola");
  await assert.rejects(consultarTiktok("brosss.clips", async () => ({ status: 503 }), { espera: 1 }), /503/);
});
