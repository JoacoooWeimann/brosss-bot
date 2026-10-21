import { test } from "node:test";
import assert from "node:assert/strict";
import { mensajeTips, areasOrdenadas, cercania } from "../src/tips.js";

const datos = (areas) => ({ nombre: "Joa", avatar: "https://x/a.png", areas });

test("ordena de la más floja a la mejor y calcula qué tan cerca está del objetivo", () => {
  const orden = areasOrdenadas({ hs: 11, aim: 59, flashAmigos: 0.2 });
  assert.deepEqual(orden.map((x) => x.area), ["hs", "aim", "flashAmigos"]);
  assert.equal(cercania(orden[0].distancia), 50);
  assert.equal(cercania(-0.3), 100);
});

test("/tips: portada, las 3 más flojas con valor, objetivo, consejo y links, y lo que hace bien", () => {
  const m = mensajeTips("1", datos({ hs: 14, spray: 31, utilidadSinUsar: 353, aim: 70, flashAmigos: 0.32, tradeos: 48 }));
  const [portada, uno, dos, tres, bien] = m.embeds;
  assert.equal(portada.title, "📚 Qué practicar · Joa");
  assert.equal(m.embeds.length, 5);
  assert.match(uno.title, /^1️⃣ /u);
  assert.match(uno.description, /Tenés \*\*.+\*\* · el objetivo es \*\*.+\*\*/);
  assert.match(uno.description, /💡 /u);
  assert.match(uno.description, /\[Videos\]\(https:\/\/www\.youtube\.com/);
  assert.ok([uno, dos, tres].some((e) => /Practicar en Aim Botz/.test(e.description)));
  assert.match(bien.description, /🙈 Casi no flasheás a tu equipo/u, "en positivo");
  assert.ok(!/Flasheás a tu equipo/.test(bien.description));
});

test("arriba del objetivo en todo: lo felicita; sin stats: aviso privado", () => {
  const m = mensajeTips("1", datos({ aim: 90, hs: 30 }));
  assert.match(m.embeds[0].description, /arriba del objetivo en todo/);
  assert.equal(m.embeds.length, 2);
  assert.equal(mensajeTips("1", datos({})).flags, 64);
});
