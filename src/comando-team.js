// =============================================================
//  RESPUESTA DE /team y /formacion
//  Lo que hace la función de Netlify con cada pedido de Discord.
//  Separado de la función para poder testearlo sin Netlify.
// =============================================================

import { firmaValida } from "./firma.js";
import { armarFormacion, mensajeFormacion } from "./formacion.js";

export const DATOS_URL = "https://raw.githubusercontent.com/JoacoooWeimann/brosss-bot/main/datos/jugadores.json";
export const NOMBRES = ["team", "formacion"];
const EFIMERO = 64; // solo lo ve quien usó el comando

const respuesta = (cuerpo, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });

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

export async function atender(peticion, { clavePublica, canalVincular, pedir = fetch } = {}) {
  const cuerpo = await peticion.text();
  const ok = firmaValida(cuerpo, peticion.headers.get("x-signature-ed25519"), peticion.headers.get("x-signature-timestamp"), clavePublica);
  if (!ok) return new Response("firma inválida", { status: 401 });

  const interaccion = JSON.parse(cuerpo);
  if (interaccion.type === 1) return respuesta({ type: 1 }); // PING de Discord al configurar la URL

  if (interaccion.type === 2 && NOMBRES.includes(interaccion.data?.name)) {
    const elegidos = usuariosElegidos(interaccion).filter((u) => !u.bot);
    if (!elegidos.length) {
      return respuesta({ type: 4, data: { content: "Elegí al menos un jugador (que no sea un bot).", flags: EFIMERO } });
    }
    let datos = {};
    try {
      const res = await pedir(DATOS_URL, { signal: AbortSignal.timeout(2000) });
      if (res.ok) datos = (await res.json()).jugadores ?? {};
    } catch {
      // Sin datos: igual responde, con todos "sin stats"
    }
    const jugadores = elegidos.map((u) => ({ ...u, datos: datos[u.usuarioId] ?? null }));
    return respuesta({ type: 4, data: mensajeFormacion(armarFormacion(jugadores), { canalVincular }) });
  }

  return respuesta({ type: 4, data: { content: "No conozco ese comando.", flags: EFIMERO } });
}
