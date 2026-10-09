// =============================================================
//  RANKING
//  Arma el embed de #ranking. Son funciones puras: reciben los
//  jugadores y devuelven el mensaje, así se testean sin internet.
// =============================================================

const VERDE = 0x22e36b;
const ICONO = "https://brosssdiscord.netlify.app/img/icono.png";
const MAXIMO = 30; // más filas no entran bien en el celular
const ANCHO_NOMBRE = 12;

// Colores del CS Rating de Premier (los mismos que muestra el juego)
export function colorPremier(premier) {
  if (premier === null) return "⚫\uFE0F";
  if (premier < 5000) return "⚪\uFE0F";
  if (premier < 10000) return "🩵";
  if (premier < 15000) return "🔵";
  if (premier < 20000) return "🟣";
  if (premier < 25000) return "🩷";
  if (premier < 30000) return "🔴";
  return "🟡";
}

// Primero por Premier; los que no tienen, por ELO de FACEIT
export function ordenar(jugadores) {
  const valor = (n) => n ?? -1;
  return [...jugadores].sort(
    (a, b) => valor(b.premier) - valor(a.premier) || valor(b.faceitElo) - valor(a.faceitElo) || a.nombre.localeCompare(b.nombre)
  );
}

const miles = (n) => n.toLocaleString("es-AR");

// Dentro de un bloque de código, un ` del nombre cortaría la tabla
function limpiarNombre(nombre) {
  const limpio = String(nombre).replace(/[`\n\r]/g, "'").trim() || "Jugador";
  return limpio.length > ANCHO_NOMBRE ? limpio.slice(0, ANCHO_NOMBRE - 1) + "…" : limpio.padEnd(ANCHO_NOMBRE);
}

export function filaTabla(jugador, puesto) {
  const premier = jugador.premier === null ? "—" : miles(jugador.premier);
  const faceit = jugador.faceit === null ? "—" : `${jugador.faceit}·${jugador.faceitElo ?? "?"}`;
  return `${colorPremier(jugador.premier)} ${String(puesto).padStart(2)} ${limpiarNombre(jugador.nombre)} ${premier.padStart(7)}  ${faceit}`;
}

// El mejor en cada stat, para la parte de "Destacados"
function mejor(jugadores, campo) {
  const con = jugadores.filter((j) => j[campo] !== null);
  return con.length ? con.reduce((a, b) => (b[campo] > a[campo] ? b : a)) : null;
}

function destacados(jugadores) {
  const items = [
    ["🎯 Mejor aim", mejor(jugadores, "aim"), (j) => Math.round(j.aim)],
    ["💀 Más HS", mejor(jugadores, "hs"), (j) => `${Math.round(j.hs)}%`],
    ["📈 Mejor winrate", mejor(jugadores, "winrate"), (j) => `${Math.round(j.winrate * 100)}%`],
    ["🎮 Más partidas", mejor(jugadores, "partidas"), (j) => miles(j.partidas)],
  ];
  return items
    .filter(([, j]) => j)
    .map(([nombre, j, valor]) => ({ name: nombre, value: `**${j.nombre.slice(0, 32)}** · ${valor(j)}`, inline: true }));
}

// "⭐ Jugador de la semana": el ganador de la pasada y quién va primero en esta
export function campoSemana({ anterior, actual } = {}) {
  const lineas = [];
  if (anterior) lineas.push(`🏅 Semana pasada: **${anterior.nombre}** (+${miles(anterior.subio)})`);
  lineas.push(actual ? `📈 Esta semana va primero: **${actual.nombre}** (+${miles(actual.subio)})` : "📈 Esta semana todavía nadie subió. ¡A jugar!");
  return { name: "⭐ Jugador de la semana", value: lineas.join("\n"), inline: false };
}

export function armarEmbed(jugadores, { canalVincular, ahora = Date.now(), semana } = {}) {
  const lista = ordenar(jugadores).slice(0, MAXIMO);
  const unix = Math.floor(ahora / 1000);
  const comoEntrar = canalVincular ? `Para entrar, pegá tu link de Steam en <#${canalVincular}>.` : "";

  const cuerpo = lista.length
    ? ["```", `    # ${"Jugador".padEnd(ANCHO_NOMBRE)} Premier  FACEIT`, ...lista.map((j, i) => filaTabla(j, i + 1)), "```"].join("\n")
    : "Todavía no hay nadie. ¡Sé el primero!";

  return {
    title: "🏆 RANKING CS2 · BROSSS",
    description: `${cuerpo}\n${comoEntrar}\nActualizado <t:${unix}:R>`,
    color: VERDE,
    thumbnail: { url: ICONO },
    fields: [...(semana ? [campoSemana(semana)] : []), ...destacados(lista)],
    footer: { text: "Datos de Leetify · se actualiza solo cada 15 min · la semana arranca los viernes a las 12", icon_url: ICONO },
  };
}
