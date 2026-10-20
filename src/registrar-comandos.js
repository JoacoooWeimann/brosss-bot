// =============================================================
//  REGISTRAR LOS COMANDOS CON /
//  Le dice a Discord qué comandos tiene el bot (/team y /formacion).
//  Se corre una vez a mano (Actions → Comandos → Run workflow), y de
//  nuevo solo si cambian las opciones. Se registran en el servidor de
//  BROSSS, así aparecen al instante.
// =============================================================

import { crearCliente } from "./discord.js";
import { idDeCanal } from "./ids.js";

const opcionJugador = (n) => ({
  type: 6, // usuario
  name: `jugador${n}`,
  description: n === 1 ? "Primer jugador" : `Jugador ${n}`,
  required: n === 1,
});

export const COMANDOS = ["team", "formacion"].map((name) => ({
  name,
  type: 1,
  description: "Reparte los roles de CS2 (AWPer, Entry, Support, Lurker, IGL) según las stats de cada uno",
  options: [1, 2, 3, 4, 5].map(opcionJugador),
}));

const { DISCORD_TOKEN } = process.env;
const CANAL_VINCULAR = idDeCanal(process.env.CANAL_VINCULAR);
if (!DISCORD_TOKEN || !CANAL_VINCULAR) {
  console.error("Faltan DISCORD_TOKEN o CANAL_VINCULAR.");
  process.exit(1);
}
const cliente = crearCliente(DISCORD_TOKEN);
const app = await cliente.aplicacion();
const { guild_id } = await cliente.canal(CANAL_VINCULAR);
const registrados = await cliente.registrarComandos(app.id, guild_id, COMANDOS);
console.log(`Listo: comandos registrados en el servidor: ${registrados.map((c) => `/${c.name}`).join(", ")}`);
