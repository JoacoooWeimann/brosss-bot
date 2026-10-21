// =============================================================
//  CONSEJOS SEMANALES (#tips)
//  Una vez por semana, a cada jugador de #vincular le busca su
//  punto más flojo en Leetify y le recomienda qué practicar.
//
//  Los objetivos son valores de "buen nivel" aproximados, no la
//  media oficial de Leetify: sirven para comparar áreas entre sí.
// =============================================================

import { fileURLToPath } from "node:url";
import { crearCliente } from "./discord.js";
import { registrosDesdeMensajes } from "./vincular.js";
import { evaluar, idDeCanal, crearPedir } from "./index.js";
import { enVentanaDelViernes, esDeEstaSemana } from "./semana.js";
import { AREAS, distancia, puntoFlojo } from "./consejos-def.js";

export { AREAS, distancia, puntoFlojo };

const VERDE = 0x22e36b;
const POR_MENSAJE = 10; // un embed por jugador; Discord acepta hasta 10 por mensaje
const TITULO = "Consejos de la semana";

const fechaDeMensaje = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

// ¿El bot ya publicó los consejos esta semana (desde el viernes a las 12)?
// El workflow lo pueden lanzar cron-job.org, el reloj de GitHub o alguien a mano.
export function yaPublicados(mensajes, { botId, ahora }) {
  return mensajes.some(
    (m) => m.author?.id === botId && String(m.content ?? "").includes(TITULO) && esDeEstaSemana(fechaDeMensaje(m.id), ahora)
  );
}

export function embedJugador(jugador) {
  const flojo = puntoFlojo(jugador.areas);
  if (!flojo) return null;
  const a = AREAS[flojo.area];
  const valor = a.formato(flojo.valor);

  if (flojo.bien) {
    return {
      color: VERDE,
      description: `👑 <@${jugador.usuarioId}> está arriba del objetivo en todo. Lo mejor: **${a.titulo.slice(2).trim()}** (${valor}). ¡Seguí así!`,
    };
  }
  const links = [a.practica && `🗺 [${a.practica[0]}](${a.practica[1]})`, `▶️ [Videos](${a.video})`].filter(Boolean).join(" · ");
  return {
    color: VERDE,
    description: [
      `<@${jugador.usuarioId}> · **${a.titulo}**`,
      `Tenés **${valor}** (objetivo: ${a.formato(a.objetivo)})`,
      a.consejo,
      links,
    ].join("\n"),
  };
}

export function armarMensajes(jugadores, { canalVincular } = {}) {
  const embeds = jugadores.map(embedJugador).filter(Boolean);
  const comoEntrar = canalVincular ? `\n-# ¿No aparecés? Pegá tu Steam en <#${canalVincular}>. Datos de Leetify.` : "";
  const mensajes = [];
  for (let i = 0; i < embeds.length; i += POR_MENSAJE) {
    mensajes.push({
      content: i === 0 ? `## 📚 ${TITULO}\nUn área para practicar, según tus partidas.${comoEntrar}` : undefined,
      embeds: embeds.slice(i, i + POR_MENSAJE),
      // Menciona sin notificar: no queremos un ping por semana
      allowed_mentions: { parse: [] },
    });
  }
  return mensajes;
}

export async function ejecutarConsejos({ cliente, pedir, canalVincular, canalTips, claveLeetify, ahora = Date.now(), forzar = false }) {
  if (!forzar && !enVentanaDelViernes(ahora)) return { jugadores: 0, mensajes: 0, repetido: false, fueraDeHorario: true };
  const yo = await cliente.yo();
  if (yaPublicados(await cliente.mensajes(canalTips, 50), { botId: yo.id, ahora })) {
    return { jugadores: 0, mensajes: 0, repetido: true };
  }
  const registros = registrosDesdeMensajes(await cliente.mensajes(canalVincular));
  const jugadores = [];
  for (const r of registros) {
    const { estado, perfil } = await evaluar(r, { pedir, claveLeetify });
    if (estado === "ok") jugadores.push({ usuarioId: r.usuarioId, nombre: r.nombre, areas: perfil.areas });
  }
  const mensajes = armarMensajes(jugadores, { canalVincular });
  for (const m of mensajes) await cliente.enviar(canalTips, m);
  return { jugadores: jugadores.length, mensajes: mensajes.length, repetido: false };
}

// ---------- Arranque (`node src/consejos.js`) ----------

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { DISCORD_TOKEN, LEETIFY_API_KEY } = process.env;
  const CANAL_VINCULAR = idDeCanal(process.env.CANAL_VINCULAR);
  const CANAL_TIPS = idDeCanal(process.env.CANAL_TIPS);
  const faltan = Object.entries({ DISCORD_TOKEN, CANAL_VINCULAR, CANAL_TIPS })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (faltan.length) {
    console.error(`Faltan variables: ${faltan.join(", ")}. Mirá el README.`);
    process.exit(1);
  }
  const resumen = await ejecutarConsejos({
    cliente: crearCliente(DISCORD_TOKEN),
    pedir: crearPedir(),
    canalVincular: CANAL_VINCULAR,
    canalTips: CANAL_TIPS,
    claveLeetify: LEETIFY_API_KEY,
    forzar: process.env.FORZAR === "true",
  });
  console.log(
    resumen.fueraDeHorario
      ? "Fuera de horario: los consejos salen entre el viernes a las 12 y el sábado a las 12."
      : resumen.repetido
      ? "Los consejos de esta semana ya estaban publicados: no se repiten."
      : `Listo: consejos para ${resumen.jugadores} jugadores en ${resumen.mensajes} mensajes.`
  );
}
