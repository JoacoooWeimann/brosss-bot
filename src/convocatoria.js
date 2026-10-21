// =============================================================
//  /jugamos
//  Una convocatoria para jugar: hora, modo y cupo, con botones
//  "✅ Me sumo" y "❌ No puedo". El que la crea ya queda anotado.
//  No guarda nada aparte: las listas viven en el mismo mensaje, y
//  cada clic lo vuelve a armar con la persona agregada o sacada.
// =============================================================

export const MODOS = {
  premier: { nombre: "Premier", emoji: "🏆", cupo: 5 },
  faceit: { nombre: "FACEIT", emoji: "🟧", cupo: 5 },
  competitivo: { nombre: "Competitivo", emoji: "🎯", cupo: 5 },
  wingman: { nombre: "Wingman", emoji: "🤝", cupo: 2 },
  casual: { nombre: "Casual", emoji: "🎮", cupo: 10 },
};

const VERDE = 0x22e36b;
const GRIS = 0x5b6670;
const CAMPO_SI = "✅ Se suman";
const CAMPO_NO = "❌ No pueden";

const lista = (ids) => (ids.length ? ids.map((id, i) => `\`${i + 1}.\` <@${id}>`).join("\n") : "—");

// estado: { hora, modo, creador, si: [ids], no: [ids] }
export function mensajeConvocatoria({ hora, modo, creador, si, no }) {
  const m = MODOS[modo] ?? MODOS.premier;
  const completo = si.length >= m.cupo;
  const faltan = m.cupo - si.length;
  return {
    content: completo ? `🎮 **¡Equipo completo!** ${si.map((id) => `<@${id}>`).join(" ")} · a las **${hora}**` : undefined,
    embeds: [
      {
        author: { name: "CONVOCATORIA · BROSSS" },
        title: `${m.emoji} ${m.nombre} a las ${hora}`,
        description: completo
          ? "## ✅ ¡Equipo completo!\nNos vemos en el server de voz. 🔥"
          : `<@${creador}> arma partida. **Faltan ${faltan}** ${faltan === 1 ? "jugador" : "jugadores"}.\nTocá ✅ para sumarte o ❌ si no podés.`,
        color: completo ? VERDE : 0x5c9dff,
        fields: [
          { name: `${CAMPO_SI} (${si.length}/${m.cupo})`, value: lista(si), inline: true },
          { name: CAMPO_NO, value: lista(no), inline: true },
        ],
        footer: { text: `${m.nombre} · ${hora} · tocá de nuevo tu botón para salir de la lista` },
      },
    ],
    components: [
      {
        type: 1,
        components: [
          { type: 2, style: 3, label: "Me sumo", emoji: { name: "✅" }, custom_id: `jugamos:si:${modo}` },
          { type: 2, style: 4, label: "No puedo", emoji: { name: "❌" }, custom_id: `jugamos:no:${modo}` },
        ],
      },
    ],
    // Solo notifica a los anotados cuando se completa
    allowed_mentions: { parse: [], users: completo ? si : [] },
  };
}

// Lee el estado desde el mensaje (para cada clic)
export function leerConvocatoria(mensaje, modo) {
  const e = mensaje?.embeds?.[0] ?? {};
  const ids = (nombre) => [...String(e.fields?.find((f) => f.name.startsWith(nombre))?.value ?? "").matchAll(/<@!?(\d+)>/g)].map((m) => m[1]);
  const hora = /a las (.+)$/.exec(e.title ?? "")?.[1] ?? "?";
  const creador = /^<@!?(\d+)>/.exec(e.description ?? "")?.[1] ?? ids(CAMPO_SI)[0] ?? null;
  return { hora, modo, creador, si: ids(CAMPO_SI), no: ids(CAMPO_NO) };
}

// Un clic: entrar a una lista (y salir de la otra) o salir si ya estaba
export function alternar(estado, usuarioId, boton) {
  const cupo = (MODOS[estado.modo] ?? MODOS.premier).cupo;
  const si = estado.si.filter((id) => id !== usuarioId);
  const no = estado.no.filter((id) => id !== usuarioId);
  const yaEstaba = (boton === "si" ? estado.si : estado.no).includes(usuarioId);
  if (!yaEstaba) {
    if (boton === "si") {
      if (si.length >= cupo) return { ...estado, lleno: true };
      si.push(usuarioId);
    } else no.push(usuarioId);
  }
  return { ...estado, si, no, lleno: false };
}

// "22", "22:00", "22.30", "10pm" → texto prolijo; si no se entiende, tal cual
export function normalizarHora(texto) {
  const t = String(texto ?? "").trim().toLowerCase();
  const m = /^(\d{1,2})(?:[:.h](\d{2}))?\s*(am|pm)?$/.exec(t);
  if (!m) return String(texto ?? "").trim().slice(0, 30) || "ya";
  let h = Number(m[1]);
  if (m[3] === "pm" && h < 12) h += 12;
  if (m[3] === "am" && h === 12) h = 0;
  if (h > 23 || Number(m[2] ?? 0) > 59) return t.slice(0, 30);
  return `${String(h).padStart(2, "0")}:${m[2] ?? "00"}`;
}
