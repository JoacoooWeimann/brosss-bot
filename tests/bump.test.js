import { test } from "node:test";
import assert from "node:assert/strict";
import { DISBOARD, esBump, revisarBump, mensajeBump, fechaDeMensaje } from "../src/bump.js";

// Un ID de Discord para una fecha dada (al revés de fechaDeMensaje)
const idEn = (iso, n = 0) => String(((BigInt(Date.parse(iso)) - 1420070400000n) << 22n) + BigInt(n));

const bump = (iso) => ({
  id: idEn(iso),
  author: { id: DISBOARD },
  interaction: { name: "bump" },
  embeds: [{ description: "Bump done! :thumbsup:" }],
});
const aviso = (iso) => ({ id: idEn(iso, 1), author: { id: "bot" }, content: "⏰ **¡Ya se puede bumpear!**" });
const charla = (iso) => ({ id: idEn(iso, 2), author: { id: "persona" }, content: "bump bump" });

test("la fecha sale del ID del mensaje", () => {
  assert.equal(fechaDeMensaje(idEn("2026-10-09T10:00:00Z")), Date.parse("2026-10-09T10:00:00Z"));
});

test("reconoce el bump de DISBOARD por el comando o por el texto, no lo de otros", () => {
  assert.ok(esBump(bump("2026-10-09T10:00:00Z")));
  assert.ok(esBump({ id: "1", author: { id: DISBOARD }, embeds: [{ description: "¡Bump hecho! 👍" }] }));
  assert.ok(!esBump({ id: "1", author: { id: DISBOARD }, embeds: [{ description: "Bienvenido a DISBOARD" }] }));
  assert.ok(!esBump({ id: "1", author: { id: "otro" }, interaction: { name: "bump" } }));
});

const ahora = Date.parse("2026-10-09T12:30:00Z");

test("antes de las 2 horas no avisa", () => {
  const r = revisarBump([bump("2026-10-09T11:00:00Z")], { botId: "bot", ahora });
  assert.equal(r.recordar, false);
  assert.deepEqual(r.borrar, []);
  assert.equal(r.ultimoBump, Date.parse("2026-10-09T11:00:00Z"));
});

test("a las 2 horas avisa una sola vez", () => {
  const msgs = [bump("2026-10-09T10:00:00Z"), charla("2026-10-09T11:00:00Z")];
  assert.equal(revisarBump(msgs, { botId: "bot", ahora }).recordar, true);
  assert.equal(revisarBump([...msgs, aviso("2026-10-09T12:15:00Z")], { botId: "bot", ahora }).recordar, false);
});

test("cuando alguien bumpea, borra el aviso viejo", () => {
  const msgs = [aviso("2026-10-09T09:00:00Z"), bump("2026-10-09T11:00:00Z")];
  const r = revisarBump(msgs, { botId: "bot", ahora });
  assert.deepEqual(r.borrar, [msgs[0].id]);
  assert.equal(r.recordar, false);
});

test("si nunca hubo bump, avisa una vez y no repite", () => {
  assert.equal(revisarBump([], { botId: "bot", ahora }).recordar, true);
  assert.equal(revisarBump([aviso("2026-10-09T08:00:00Z")], { botId: "bot", ahora }).recordar, false);
});

test("el aviso menciona solo al rol de bumpers", () => {
  const con = mensajeBump("555");
  assert.match(con.content, /^⏰.*\/bump.*<@&555>$/);
  assert.deepEqual(con.allowed_mentions, { parse: [], roles: ["555"] });
  assert.deepEqual(mensajeBump("").allowed_mentions, { parse: [], roles: [] });
});
