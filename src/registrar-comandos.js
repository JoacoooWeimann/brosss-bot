// =============================================================
//  REGISTRAR LOS COMANDOS CON /
//  Le dice a Discord qué comandos tiene el bot (/team, /stats,
//  /comparar, /forma, /jugamos y /smoke). Los que no están en la lista
//  se borran del server (así se sacó /formacion).
//  Se corre una vez a mano (Actions → Comandos → Run workflow), y de
//  nuevo solo si cambian las opciones. Se registran en el servidor de
//  BROSSS, así aparecen al instante.
// =============================================================

import { crearCliente } from "./discord.js";
import { idDeCanal } from "./ids.js";
import { MAPAS, TIPOS, LADOS } from "./lineups.js";
import { MODOS } from "./convocatoria.js";

// Todos opcionales: sin ninguno, usa a los de tu canal de voz
const opcionJugador = (n) => ({
  type: 6, // usuario
  name: `jugador${n}`,
  description: n === 1 ? "Primer jugador (sin elegir a nadie, usa a los de tu canal de voz)" : `Jugador ${n}`,
  required: false,
});

const eleccion = (lista) => lista.map(([name, value]) => ({ name, value }));

export const COMANDOS = [
  {
    name: "team",
    type: 1,
    description: "Roles de CS2 según las stats de cada uno. Sin elegir jugadores, usa a los de tu canal de voz",
    options: [1, 2, 3, 4, 5].map(opcionJugador),
  },
  {
    name: "forma",
    type: 1,
    description: "Las últimas 10 partidas de un jugador: racha, rating y su mejor partida",
    options: [{ type: 6, name: "jugador", description: "De quién (sin elegir, la tuya)", required: false }],
  },
  {
    name: "jugamos",
    type: 1,
    description: "Arma una partida: los demás se suman con un botón",
    options: [
      { type: 3, name: "hora", description: "A qué hora (ej. 22, 22:30, ya)", required: true, max_length: 30 },
      { type: 3, name: "modo", description: "Premier (por defecto), FACEIT, Competitivo, Wingman o Casual", required: false,
        choices: eleccion(Object.entries(MODOS).map(([v, m]) => [m.nombre, v])) },
    ],
  },
  {
    name: "stats",
    type: 1,
    description: "La ficha de CS2 de un jugador: rangos, puntos fuertes, qué mejorar y su rol ideal",
    options: [{ type: 6, name: "jugador", description: "De quién (sin elegir, las tuyas)", required: false }],
  },
  {
    name: "comparar",
    type: 1,
    description: "Compara las stats de CS2 de dos jugadores, una por una",
    options: [
      { type: 6, name: "jugador1", description: "Primer jugador", required: true },
      { type: 6, name: "jugador2", description: "Segundo jugador (sin elegir, vos)", required: false },
    ],
  },
  {
    name: "smoke",
    type: 1,
    description: "Lineups de un mapa (smokes, molotovs o flashes) con el video de cada uno",
    options: [
      { type: 3, name: "mapa", description: "Mapa", required: true, choices: eleccion(MAPAS) },
      { type: 3, name: "tipo", description: "Smokes (por defecto), molotovs o flashes", required: false,
        choices: eleccion(Object.entries(TIPOS).map(([v, t]) => [t.nombre, v])) },
      { type: 3, name: "lado", description: "T o CT (sin elegir, los dos)", required: false, choices: eleccion(Object.entries(LADOS).map(([v, n]) => [n, v])) },
    ],
  },
];

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
