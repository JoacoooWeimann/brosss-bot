// Discord manda acá cada uso de /team y /formacion.
// Configuración en Netlify (Site configuration → Environment variables):
//  - DISCORD_PUBLIC_KEY: la "Public Key" del portal de Discord (General Information)
import { atender } from "../../src/comando-team.js";

export const config = { path: "/interacciones" };

export default (peticion) =>
  atender(peticion, { clavePublica: process.env.DISCORD_PUBLIC_KEY });
