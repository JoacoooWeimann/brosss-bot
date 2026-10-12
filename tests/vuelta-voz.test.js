import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// La vuelta de voz corre sin `npm ci` (para ser rápida): no puede
// depender de sharp ni de nada que lo cargue, como index.js.
function importsDe(archivo, vistos = new Set()) {
  if (vistos.has(archivo)) return vistos;
  vistos.add(archivo);
  const codigo = readFileSync(new URL(`../src/${archivo}`, import.meta.url), "utf8");
  for (const [, ruta] of codigo.matchAll(/^import[^"']*["']([^"']+)["']/gm)) {
    if (ruta.startsWith("./")) importsDe(ruta.slice(2), vistos);
    else vistos.add(ruta);
  }
  return vistos;
}

test("la vuelta de voz no carga sharp ni index.js", () => {
  const todo = [...importsDe("voz-vuelta.js")];
  assert.ok(!todo.includes("sharp"), `importa sharp: ${todo.join(", ")}`);
  assert.ok(!todo.includes("index.js"), `importa index.js: ${todo.join(", ")}`);
});
