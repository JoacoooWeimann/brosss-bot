import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";
import { juntarClips, actualizarClipsWeb } from "../src/clips-web.js";
import { leerVideos } from "../src/tiktok.js";

const video = (id, fecha, extra = {}) => ({ id, titulo: `clip ${id}`, fecha, vistas: 10, portadaUrl: `https://p16.tiktokcdn.com/${id}.jpg`, ...extra });

// Carpeta temporal con datos/clips.json y datos/portadas/
async function carpetaTemporal() {
  const dir = await mkdtemp(join(tmpdir(), "clips-web-"));
  return {
    dir,
    archivo: pathToFileURL(join(dir, "clips.json")),
    carpeta: pathToFileURL(join(dir, "portadas") + "/"),
    borrar: () => rm(dir, { recursive: true, force: true }),
  };
}

// Una imagen JPEG de verdad (chiquita) para simular la portada de TikTok
const jpeg = await sharp({ create: { width: 54, height: 96, channels: 3, background: "#22e36b" } }).jpeg().toBuffer();
function pedirFalso({ falla = new Set() } = {}) {
  const pedidos = [];
  const pedir = async (url) => {
    pedidos.push(url);
    const id = /\/(\d+)\.jpg$/.exec(url)?.[1];
    if (falla.has(id)) return { ok: false, status: 403 };
    return { ok: true, status: 200, arrayBuffer: async () => jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength) };
  };
  return { pedir, pedidos };
}

test("leerVideos guarda el link de la portada (solo https)", () => {
  const html = `<script id="__FRONTITY_CONNECT_STATE__">${JSON.stringify({
    videoList: [
      { id: "7461024379594345733", desc: "a", originCoverUrl: "https://p16.tiktokcdn.com/a.jpg", coverUrl: "https://p16.tiktokcdn.com/b.jpg" },
      { id: "7461024379594345734", desc: "b", coverUrl: "javascript:alert(1)" },
    ],
  })}</script>`;
  const [a, b] = leerVideos(html);
  assert.equal(a.portadaUrl, "https://p16.tiktokcdn.com/a.jpg");
  assert.equal(b.portadaUrl, null);
});

test("juntarClips mantiene los viejos, actualiza títulos y ordena del más nuevo al más viejo", () => {
  const anterior = { usuario: "brosss.clips", clips: [{ id: "1", titulo: "viejo", fecha: 100, portada: true }] };
  const datos = juntarClips(anterior, [video("2", 200), video("1", 100, { titulo: "título nuevo" })], "brosss.clips");
  assert.deepEqual(datos.clips.map((c) => [c.id, c.titulo, c.portada]), [["2", "clip 2", false], ["1", "título nuevo", true]]);
  assert.equal(Object.hasOwn(datos.clips[0], "vistas"), false, "las vistas no se guardan");
});

test("si cambia la cuenta de TikTok, no se mezclan los clips de la anterior", () => {
  const datos = juntarClips({ usuario: "otra", clips: [{ id: "9", fecha: 1, portada: true }] }, [video("2", 2)], "brosss.clips");
  assert.deepEqual(datos.clips.map((c) => c.id), ["2"]);
});

test("guarda clips.json y la portada de cada clip en WebP vertical", async () => {
  const t = await carpetaTemporal();
  try {
    const { pedir } = pedirFalso();
    const r = await actualizarClipsWeb({ videos: [video("7694526057206041863", 2000)], usuario: "brosss.clips", pedir, archivo: t.archivo, carpeta: t.carpeta });
    assert.deepEqual(r, { cambio: true, portadas: 1 });

    const datos = JSON.parse(await readFile(t.archivo, "utf8"));
    assert.deepEqual(datos, { usuario: "brosss.clips", clips: [{ id: "7694526057206041863", fecha: 2000, portada: true, titulo: "clip 7694526057206041863" }] });
    const meta = await sharp(join(t.dir, "portadas", "7694526057206041863.webp")).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["webp", 480, 854]);
  } finally {
    await t.borrar();
  }
});

test("si no hay nada nuevo, no reescribe el archivo ni vuelve a bajar portadas", async () => {
  const t = await carpetaTemporal();
  try {
    const { pedir, pedidos } = pedirFalso();
    const videos = [video("1", 100)];
    await actualizarClipsWeb({ videos, usuario: "brosss.clips", pedir, archivo: t.archivo, carpeta: t.carpeta });
    const antes = (await stat(t.archivo)).mtimeMs;

    // Mismos videos, con otras vistas: no es un cambio
    const r = await actualizarClipsWeb({ videos: [{ ...videos[0], vistas: 999 }], usuario: "brosss.clips", pedir, archivo: t.archivo, carpeta: t.carpeta });
    assert.deepEqual(r, { cambio: false, portadas: 0 });
    assert.equal((await stat(t.archivo)).mtimeMs, antes);
    assert.equal(pedidos.length, 1, "la portada se bajó una sola vez");
  } finally {
    await t.borrar();
  }
});

test("si una portada falla, el clip se guarda igual y se reintenta en la próxima vuelta", async () => {
  const t = await carpetaTemporal();
  try {
    const falla = new Set(["2"]);
    const { pedir } = pedirFalso({ falla });
    const videos = [video("1", 100), video("2", 200)];
    let r = await actualizarClipsWeb({ videos, usuario: "brosss.clips", pedir, archivo: t.archivo, carpeta: t.carpeta });
    assert.deepEqual(r, { cambio: true, portadas: 1 });
    let datos = JSON.parse(await readFile(t.archivo, "utf8"));
    assert.deepEqual(datos.clips.map((c) => [c.id, c.portada]), [["2", false], ["1", true]]);

    falla.clear();
    r = await actualizarClipsWeb({ videos, usuario: "brosss.clips", pedir, archivo: t.archivo, carpeta: t.carpeta });
    assert.deepEqual(r, { cambio: true, portadas: 1 });
    datos = JSON.parse(await readFile(t.archivo, "utf8"));
    assert.equal(datos.clips[0].portada, true);
  } finally {
    await t.borrar();
  }
});

test("sin videos (TikTok no respondió) no toca nada", async () => {
  const r = await actualizarClipsWeb({ videos: null, usuario: "brosss.clips", pedir: () => assert.fail("no tiene que pedir nada") });
  assert.deepEqual(r, { cambio: false, portadas: 0 });
});
