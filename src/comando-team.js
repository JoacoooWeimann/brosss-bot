// =============================================================
//  RESPUESTA DE /team y /formacion
//  Lo que hace la función de Netlify con cada pedido de Discord.
//  Separado de la función para poder testearlo sin Netlify.
//
//  - Con jugadores: arma la formación con esos.
//  - Sin jugadores: usa los de tu canal de voz (lo guarda la vuelta
//    de voz cada 5 minutos en datos/voz.json).
//  - Botón "Mezclar": la siguiente mejor formación, en el mismo mensaje.
// =============================================================

import { firmaValida, limpiarClave } from "./firma.js";
import { armarFormacion, mensajeFormacion, jugadoresDelMensaje } from "./formacion.js";
import { mensajeStats, mensajeComparar } from "./stats-jugador.js";
import { mensajeLineups } from "./lineups.js";

const RAW = "https://raw.githubusercontent.com/JoacoooWeimann/brosss-bot/main/datos";
export const DATOS_URL = `${RAW}/jugadores.json`;
export const VOZ_URL = `${RAW}/voz.json`;
export const LINEUPS_URL = `${RAW}/lineups.json`;
export const NOMBRES = ["team", "formacion"];
const EFIMERO = 64; // solo lo ve quien usó el comando

const respuesta = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
const privado = (texto) => respuesta({ type: 4, data: { content: texto, flags: EFIMERO } });

// Los usuarios elegidos en las opciones jugador1..jugador5, sin repetir
export function usuariosElegidos(interaccion) {
  const opciones = interaccion.data?.options ?? [];
  const resueltos = interaccion.data?.resolved?.users ?? {};
  const miembros = interaccion.data?.resolved?.members ?? {};
  const ids = [...new Set(opciones.filter((o) => /^jugador\d$/.test(o.name)).map((o) => o.value))];
  return ids.map((id) => ({
    usuarioId: id,
    nombre: miembros[id]?.nick || resueltos[id]?.global_name || resueltos[id]?.username || "Jugador",
    bot: Boolean(resueltos[id]?.bot),
  }));
}

// Los del canal de voz de quien usó el comando (hasta 5; primero los que tienen stats)
export function delCanalDeVoz(usuarioId, voz, datos) {
  const canal = Object.entries(voz?.canales ?? {}).find(([, lista]) => lista.includes(usuarioId));
  if (!canal) return null;
  const ids = [...canal[1]].sort((a, b) => Number(Boolean(datos[b])) - Number(Boolean(datos[a])));
  return ids.slice(0, 5).map((id) => ({ usuarioId: id, nombre: datos[id]?.nombre ?? "Jugador" }));
}

async function leerJson(url, pedir) {
  try {
    const res = await pedir(url, { signal: AbortSignal.timeout(2000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const conDatos = (lista, datos) =>
  lista.map((u) => ({ ...u, nombre: datos[u.usuarioId]?.nombre ?? u.nombre, datos: datos[u.usuarioId] ?? null }));

export async function atender(peticion, { clavePublica, pedir = fetch } = {}) {
  // Diagnóstico (abrir la URL en el navegador): si la clave está cargada, sin mostrarla
  if (peticion.method === "GET") {
    const largo = limpiarClave(clavePublica).length;
    return respuesta({ funcion: "ok", clavePublica: largo === 64 ? "cargada" : largo ? `mal cargada (${largo} caracteres, tienen que ser 64)` : "falta" });
  }
  const cuerpo = await peticion.text();
  const ok = firmaValida(cuerpo, peticion.headers.get("x-signature-ed25519"), peticion.headers.get("x-signature-timestamp"), clavePublica);
  if (!ok) return new Response("firma inválida", { status: 401 });

  const interaccion = JSON.parse(cuerpo);
  if (interaccion.type === 1) return respuesta({ type: 1 }); // PING de Discord al configurar la URL

  // Botón "Mezclar": la formación siguiente, editando el mismo mensaje
  if (interaccion.type === 3 && String(interaccion.data?.custom_id).startsWith("mezclar:")) {
    const variante = Number(interaccion.data.custom_id.split(":")[1]) || 0;
    const datos = (await leerJson(DATOS_URL, pedir))?.jugadores ?? {};
    const jugadores = conDatos(jugadoresDelMensaje(interaccion.message), datos);
    if (!jugadores.length) return privado("No encontré los jugadores de esa formación. Probá con un /team nuevo.");
    const origen = /de tu canal de voz/.test(interaccion.message?.embeds?.[0]?.description ?? "") ? "de tu canal de voz" : "";
    return respuesta({ type: 7, data: mensajeFormacion(armarFormacion(jugadores, { variante }), { origen }) });
  }

  if (interaccion.type === 2 && NOMBRES.includes(interaccion.data?.name)) {
    const sinJugadores = !interaccion.data?.options?.length;
    const [archivo, voz] = await Promise.all([leerJson(DATOS_URL, pedir), sinJugadores ? leerJson(VOZ_URL, pedir) : null]);
    const datos = archivo?.jugadores ?? {};
    let elegidos = usuariosElegidos(interaccion).filter((u) => !u.bot);
    let origen = "";

    // Sin jugadores: los del canal de voz de quien lo usa
    if (sinJugadores) {
      const yo = interaccion.member?.user?.id ?? interaccion.user?.id;
      elegidos = delCanalDeVoz(yo, voz, datos);
      if (!elegidos) {
        return privado(
          "No te encontré en un canal de voz. Entrá a uno con tu equipo (o elegí los jugadores a mano) y probá de nuevo.\n-# Quién está en cada canal se actualiza cada 5 minutos."
        );
      }
      origen = "de tu canal de voz";
    }
    if (!elegidos.length) return privado("Elegí al menos un jugador (que no sea un bot).");

    return respuesta({ type: 4, data: mensajeFormacion(armarFormacion(conDatos(elegidos, datos)), { origen }) });
  }

  const nombre = interaccion.data?.name;
  const opcion = (n) => interaccion.data?.options?.find((o) => o.name === n)?.value;
  const noVinculado = (id) => privado(`<@${id}> no está vinculado (o todavía no tiene stats). Para aparecer, que pegue su link de Steam en #vincular.`);

  // /stats [jugador]: sin elegir a nadie, las tuyas
  if (interaccion.type === 2 && nombre === "stats") {
    const id = opcion("jugador") ?? interaccion.member?.user?.id ?? interaccion.user?.id;
    const datos = (await leerJson(DATOS_URL, pedir))?.jugadores ?? {};
    if (!datos[id]) return noVinculado(id);
    return respuesta({ type: 4, data: mensajeStats(id, datos) });
  }

  // /comparar jugador1 [jugador2]: sin el segundo, te compara con vos
  if (interaccion.type === 2 && nombre === "comparar") {
    const a = opcion("jugador1");
    const b = opcion("jugador2") ?? interaccion.member?.user?.id ?? interaccion.user?.id;
    if (a === b) return privado("Elegí dos jugadores distintos.");
    const datos = (await leerJson(DATOS_URL, pedir))?.jugadores ?? {};
    for (const id of [a, b]) if (!datos[id]) return noVinculado(id);
    return respuesta({ type: 4, data: mensajeComparar(a, b, datos) });
  }

  // /smoke mapa [tipo] [lado]
  if (interaccion.type === 2 && nombre === "smoke") {
    const lineups = await leerJson(LINEUPS_URL, pedir);
    return respuesta({ type: 4, data: mensajeLineups(opcion("mapa"), opcion("tipo"), opcion("lado"), lineups) });
  }

  return privado("No conozco ese comando.");
}
