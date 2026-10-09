// =============================================================
//  RECORDATORIO DE BUMP (#bumpeador)
//  DISBOARD deja bumpear cada 2 horas, y solo con /bump hecho por
//  una persona (un bot no puede). El bot mira el último bump en
//  el canal y, cuando se cumplen las 2 horas, avisa una vez.
//  Cuando alguien bumpea, borra el aviso viejo.
// =============================================================

export const DISBOARD = "302050872383242240";
export const ESPERA_MS = 2 * 60 * 60 * 1000;
const MARCA = "⏰"; // así reconoce sus propios avisos

// Fecha de un mensaje a partir de su ID (los snowflakes la llevan adentro)
export const fechaDeMensaje = (id) => Number((BigInt(id) >> 22n) + 1420070400000n);

// ¿Es la respuesta de DISBOARD a un /bump que salió bien?
// Los intentos antes de tiempo DISBOARD los contesta en privado
// (solo los ve quien lo usó), así que no aparecen en el canal.
export function esBump(m) {
  if (m.author?.id !== DISBOARD) return false;
  if (m.interaction?.name === "bump" || m.interaction_metadata?.name === "bump") return true;
  const texto = (m.embeds ?? []).map((e) => `${e.title ?? ""} ${e.description ?? ""}`).join(" ");
  return /bump/i.test(texto) && /👍|:thumbsup:/.test(texto);
}

// Decide qué hacer: { recordar, borrar: [ids de avisos viejos] }
export function revisarBump(mensajes, { botId, ahora }) {
  const ultimoBump = mensajes.filter(esBump).reduce((max, m) => Math.max(max, fechaDeMensaje(m.id)), 0);
  const avisos = mensajes.filter((m) => m.author?.id === botId && String(m.content ?? "").startsWith(MARCA));

  // Avisos de antes del último bump: ya cumplieron
  const borrar = avisos.filter((m) => fechaDeMensaje(m.id) < ultimoBump).map((m) => m.id);
  const yaAvisado = avisos.some((m) => fechaDeMensaje(m.id) >= ultimoBump);
  const disponible = ahora - ultimoBump >= ESPERA_MS;

  return { recordar: disponible && !yaAvisado, borrar };
}

export function mensajeBump(rolId) {
  return {
    content: `${MARCA} **¡Ya se puede bumpear!** Usá \`/bump\` para subir a BROSSS en DISBOARD.${rolId ? ` <@&${rolId}>` : ""}`,
    // Solo menciona al rol de bumpers, nunca a @everyone
    allowed_mentions: { parse: [], roles: rolId ? [rolId] : [] },
  };
}
