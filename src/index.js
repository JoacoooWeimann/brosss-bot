// =============================================================
//  BROSSS BOT · Ranking CS2
//  Una vuelta completa (GitHub Actions lo corre cada 15 min):
//   1. Lee #vincular y arma la lista de jugadores.
//   2. Busca a cada uno en Steam y Leetify.
//   3. Le reacciona ✅ o ❌ (y le explica qué falta, una sola vez).
//   4. Edita el mensaje del ranking en #ranking (o lo crea).
// =============================================================

import { fileURLToPath } from "node:url";
import { crearCliente } from "./discord.js";
import { resolverSteamId } from "./steam.js";
import { consultarLeetify } from "./leetify.js";
import { registrosDesdeMensajes, OK, ERROR, MOTIVOS } from "./vincular.js";
import { armarEmbed } from "./ranking.js";
import * as semana from "./semana.js";
import { consultarPartidas, agrupar, embedPartida, yaPublicadas } from "./partidas.js";

const ESPERA_MAXIMA_MS = 8000;
const EN_PARALELO = 4; // para no saturar a Leetify

// Consulta Steam y Leetify. Devuelve { estado, perfil?, steamId? }.
// Si una API falla devuelve "reintentar": no es culpa del jugador.
export async function evaluar(registro, { pedir, claveLeetify }) {
  try {
    const steamId = await resolverSteamId(registro.perfil, pedir);
    if (!steamId) return { estado: "steam-no-existe" };
    return { ...(await consultarLeetify(steamId, pedir, claveLeetify)), steamId };
  } catch (error) {
    console.warn(`${registro.nombre}: ${error.message}`);
    return { estado: "reintentar" };
  }
}

// Pone la reacción que corresponde y saca la que sobra
async function marcar(cliente, canal, registro, estado) {
  if (estado === "reintentar") return;
  if (estado === "ok") {
    if (registro.reaccionError) await cliente.sacarReaccion(canal, registro.mensajeId, ERROR);
    if (!registro.reaccionOk) await cliente.reaccionar(canal, registro.mensajeId, OK);
    return;
  }
  if (registro.reaccionOk) await cliente.sacarReaccion(canal, registro.mensajeId, OK);
  // La explicación va solo la primera vez, así no llena el canal
  if (!registro.reaccionError) {
    await cliente.reaccionar(canal, registro.mensajeId, ERROR);
    await cliente.responder(canal, registro.mensajeId, MOTIVOS[estado]);
  }
}

async function enTandas(items, tamaño, fn) {
  const resultados = [];
  for (let i = 0; i < items.length; i += tamaño) {
    resultados.push(...(await Promise.all(items.slice(i, i + tamaño).map(fn))));
  }
  return resultados;
}

// Publica en #historial las partidas nuevas de los registrados.
// Si algo falla, no frena el ranking: se reintenta en la próxima vuelta.
async function publicarPartidas({ cliente, pedir, canalHistorial, claveLeetify, jugadores, botId, ahora }) {
  try {
    const publicadas = yaPublicadas(await cliente.mensajes(canalHistorial, 100), botId);
    const partidasPorJugador = await enTandas(jugadores, EN_PARALELO, async (jugador) => ({
      jugador,
      partidas: await consultarPartidas(jugador.steamId, pedir, claveLeetify),
    }));
    const nuevas = agrupar(partidasPorJugador, { ahora, publicadas });
    for (const p of nuevas) await cliente.enviar(canalHistorial, { embeds: [embedPartida(p)], allowed_mentions: { parse: [] } });
    return nuevas.length;
  } catch (error) {
    console.warn(`Historial: ${error.message}`);
    return 0;
  }
}

export async function ejecutar({
  cliente, pedir, canalVincular, canalRanking, canalHistorial, claveLeetify, historial = null, ahora = Date.now(),
}) {
  const registros = registrosDesdeMensajes(await cliente.mensajes(canalVincular));
  const resultados = await enTandas(registros, EN_PARALELO, (r) => evaluar(r, { pedir, claveLeetify }));

  const jugadores = [];
  for (const [i, registro] of registros.entries()) {
    const { estado, perfil, steamId } = resultados[i];
    await marcar(cliente, canalVincular, registro, estado);
    // En el ranking se ve el nombre de Discord, no el de Steam
    if (estado === "ok") jugadores.push({ ...perfil, nombre: registro.nombre, steamId, usuarioId: registro.usuarioId });
  }

  // Jugador de la semana: el que más subió desde el viernes
  const historialNuevo = semana.actualizar(historial, jugadores, ahora);
  const datosSemana = { anterior: historialNuevo.anterior, actual: semana.lider(historialNuevo.base, jugadores) };

  const cuerpo = {
    embeds: [armarEmbed(jugadores, { canalVincular, ahora, semana: datosSemana })],
    allowed_mentions: { parse: [] },
  };
  const yo = await cliente.yo();
  const propio = (await cliente.mensajes(canalRanking, 50)).find(
    (m) => m.author?.id === yo.id && m.embeds?.[0]?.title?.startsWith("🏆")
  );
  if (propio) await cliente.editar(canalRanking, propio.id, cuerpo);
  else await cliente.enviar(canalRanking, cuerpo);

  const partidas = canalHistorial
    ? await publicarPartidas({ cliente, pedir, canalHistorial, claveLeetify, jugadores, botId: yo.id, ahora })
    : 0;

  return { registrados: registros.length, enRanking: jugadores.length, partidas, historial: historialNuevo };
}

export const crearPedir = () => (url, cabeceras = {}) =>
  fetch(url, { headers: cabeceras, signal: AbortSignal.timeout(ESPERA_MAXIMA_MS) });

export const idDeCanal = (valor) => /\d{17,20}/.exec(String(valor ?? ""))?.[0] ?? "";

// ---------- Arranque (cuando se corre con `node src/index.js`) ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DISCORD_TOKEN, LEETIFY_API_KEY } = process.env;
  // Acepta el ID solo o como mención (<#123...>), con espacios de más
  const CANAL_VINCULAR = idDeCanal(process.env.CANAL_VINCULAR);
  const CANAL_RANKING = idDeCanal(process.env.CANAL_RANKING);
  const CANAL_HISTORIAL = idDeCanal(process.env.CANAL_HISTORIAL); // opcional
  const faltan = Object.entries({ DISCORD_TOKEN, CANAL_VINCULAR, CANAL_RANKING })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(", ")}. Mirá el README.`);
    process.exit(1);
  }

  const pedir = crearPedir();
  const historial = await semana.leer();
  const resumen = await ejecutar({
    cliente: crearCliente(DISCORD_TOKEN),
    pedir,
    canalVincular: CANAL_VINCULAR,
    canalRanking: CANAL_RANKING,
    canalHistorial: CANAL_HISTORIAL,
    claveLeetify: LEETIFY_API_KEY,
    historial,
  });
  const cambio = await semana.guardar(resumen.historial, historial);
  console.log(
    `Listo: ${resumen.enRanking} de ${resumen.registrados} jugadores en el ranking, ` +
      `${resumen.partidas} partidas nuevas en el historial${cambio ? ", historial de la semana actualizado" : ""}.`
  );
}
