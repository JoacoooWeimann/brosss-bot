import { test } from "node:test";
import assert from "node:assert/strict";
import { svgRanking, colorPremier, colorFaceit, escapar, huella, renderizar } from "../src/ranking-imagen.js";

const j = (usuarioId, nombre, premier, extra = {}) => ({
  usuarioId, nombre, premier, faceit: null, faceitElo: null, aim: null, hs: null, winrate: null, partidas: null, ...extra,
});

test("colores de Premier y FACEIT como en el juego", () => {
  assert.equal(colorPremier(16743), "#c166ff");
  assert.equal(colorPremier(31000), "#ffd700");
  assert.equal(colorFaceit(7), "#ffc800");
  assert.equal(colorFaceit(10), "#fe1f00");
});

test("podio para los tres primeros, filas para el resto y destacados", () => {
  const svg = svgRanking(
    [j("1", "Kyo", 18926, { faceit: 7, faceitElo: 1629, aim: 96 }), j("2", "Joacooo", 16743), j("3", "Benja", null), j("4", "ELAYAS", null)],
    { semana: { actual: { nombre: "Kyo", subio: 322 } } }
  );
  for (const t of ["#1", "#2", "#3", "#4", "18,926", "16,743", "1629 ELO", "JUGADOR DE LA SEMANA", "+322", "MEJOR AIM"]) {
    assert.ok(svg.includes(t), `falta ${t}`);
  }
});

test("los nombres se escapan (un < no rompe la imagen)", () => {
  assert.equal(escapar(`<b>&"'`), "&lt;b&gt;&amp;&quot;&apos;");
  assert.ok(svgRanking([j("1", "<script>", 1000)]).includes("&lt;script&gt;"));
});

test("la imagen no lleva la hora: mismos datos, misma huella", () => {
  const datos = [j("1", "Kyo", 18926)];
  assert.equal(huella(svgRanking(datos)), huella(svgRanking(datos)));
  assert.notEqual(huella(svgRanking(datos)), huella(svgRanking([j("1", "Kyo", 18927)])));
});

test("se convierte a PNG", async () => {
  const png = await renderizar(svgRanking([j("1", "Kyo", 18926), j("2", "Joacooo", 16743)]));
  assert.deepEqual([...png.subarray(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
});

test("cambio de la semana, mini stats del podio y SIN RANGO", () => {
  const svg = svgRanking(
    [j("1", "Kyo", 18926, { aim: 96, hs: 27, winrate: 0.5 }), j("2", "Joacooo", 16743), j("3", "Benja", null), j("4", "Valen", 9000)],
    { cambios: { 1: 322, 2: -150, 4: 40 } }
  );
  assert.ok(svg.includes("▲ +322"));
  assert.ok(svg.includes("▼ −150"));
  assert.ok(svg.includes("▲ +40"));
  assert.match(svg, /AIM <tspan[^>]*>96<\/tspan>.*HS <tspan[^>]*>27%<\/tspan>.*WR <tspan[^>]*>50%<\/tspan>/);
  assert.ok(svg.includes("SIN RANGO"));
});
