// =============================================================
//  CLOUDFLARE WORKER: los comandos con / (/team, /stats, /comparar,
//  /forma, /jugamos, /smoke)
//  Discord manda acá cada comando y cada botón. Es la misma lógica
//  que usaba la función de Netlify (src/comando-team.js).
//  Se publica solo con el workflow "Worker" cuando cambia el código.
//  Secreto en Cloudflare: DISCORD_PUBLIC_KEY (lo carga el workflow).
// =============================================================

import { atender } from "../src/comando-team.js";

export default {
  fetch(peticion, env, ctx) {
    // ctx.waitUntil: deja terminar tareas después de responder (el aviso de "equipo completo")
    return atender(peticion, { clavePublica: env.DISCORD_PUBLIC_KEY, despues: (promesa) => ctx.waitUntil(promesa) });
  },
};
