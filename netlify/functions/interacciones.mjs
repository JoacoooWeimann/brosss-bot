// Discord manda acá cada uso de /team y /formacion.
// Configuración en Netlify (Site configuration → Environment variables):
//  - DISCORD_PUBLIC_KEY: la "Public Key" del portal de Discord (General Information)
import { atender } from "../../src/comando-team.js";

export const config = { path: "/interacciones" };

// context.waitUntil: deja terminar tareas después de responder (el aviso
// de "equipo completo" de /jugamos)
export default (peticion, context) =>
  atender(peticion, { clavePublica: process.env.DISCORD_PUBLIC_KEY, despues: context?.waitUntil?.bind(context) ?? null });
