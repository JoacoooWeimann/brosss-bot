import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Cloudflare Workers no tiene disco ni la mayoría de los módulos de Node:
// la función de los comandos no puede importar nada de "node:" (ni sharp).
function importsDe(ruta, vistos = new Set()) {
  if (vistos.has(ruta)) return vistos;
  vistos.add(ruta);
  const codigo = readFileSync(new URL(`../${ruta}`, import.meta.url), "utf8");
  const base = ruta.split("/").slice(0, -1).join("/");
  for (const [, imp] of codigo.matchAll(/^(?:import|export)[^"';]*from\s*["']([^"']+)["']/gm)) {
    if (imp.startsWith(".")) {
      const partes = [...base.split("/"), ...imp.split("/")].reduce((acc, p) => (p === ".." ? acc.slice(0, -1) : p === "." || p === "" ? acc : [...acc, p]), []);
      importsDe(partes.join("/"), vistos);
    } else vistos.add(imp);
  }
  return vistos;
}

test("el Worker de los comandos no usa módulos de Node ni sharp", () => {
  const todo = [...importsDe("worker/index.js")];
  const externos = todo.filter((x) => !x.endsWith(".js"));
  assert.deepEqual(externos, [], `importa: ${externos.join(", ")}`);
});
