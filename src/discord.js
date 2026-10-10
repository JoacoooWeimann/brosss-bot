// =============================================================
//  DISCORD
//  Cliente mínimo de la API REST. No necesita estar conectado
//  todo el tiempo: hace sus pedidos y termina.
// =============================================================

const API = "https://discord.com/api/v10";

export function crearCliente(token, fetchFn = fetch) {
  async function pedir(metodo, ruta, cuerpo, intento = 0) {
    const res = await fetchFn(`${API}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bot ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/JoacoooWeimann/brosss-bot, 1.0)",
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    // Límite de pedidos: Discord dice cuánto esperar
    if (res.status === 429 && intento < 3) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000) + 100));
      return pedir(metodo, ruta, cuerpo, intento + 1);
    }
    if (!res.ok) throw new Error(`Discord ${metodo} ${ruta} → ${res.status} ${await res.text()}`);
    return res.status === 204 ? null : res.json();
  }

  // Mensaje con archivos adjuntos (multipart): el JSON va en payload_json
  async function pedirConArchivos(metodo, ruta, cuerpo, archivos, intento = 0) {
    const form = new FormData();
    form.append("payload_json", JSON.stringify({ ...cuerpo, attachments: archivos.map((a, i) => ({ id: i, filename: a.nombre })) }));
    archivos.forEach((a, i) => form.append(`files[${i}]`, new Blob([a.datos], { type: a.tipo ?? "image/png" }), a.nombre));
    const res = await fetchFn(`${API}${ruta}`, {
      method: metodo,
      headers: { Authorization: `Bot ${token}`, "User-Agent": "DiscordBot (https://github.com/JoacoooWeimann/brosss-bot, 1.0)" },
      body: form,
    });
    if (res.status === 429 && intento < 3) {
      const { retry_after = 1 } = await res.json().catch(() => ({}));
      await new Promise((r) => setTimeout(r, Math.ceil(retry_after * 1000) + 100));
      return pedirConArchivos(metodo, ruta, cuerpo, archivos, intento + 1);
    }
    if (!res.ok) throw new Error(`Discord ${metodo} ${ruta} → ${res.status} ${await res.text()}`);
    return res.json();
  }

  const emoji = (e) => encodeURIComponent(e);

  return {
    yo: () => pedir("GET", "/users/@me"),

    // Todos los mensajes del canal, de a 100 (tope de seguridad: 1000)
    async mensajes(canal, tope = 1000) {
      const todos = [];
      let antes = "";
      while (todos.length < tope) {
        const pagina = await pedir("GET", `/channels/${canal}/messages?limit=100${antes ? `&before=${antes}` : ""}`);
        todos.push(...pagina);
        if (pagina.length < 100) break;
        antes = pagina[pagina.length - 1].id;
      }
      return todos;
    },

    // Quiénes reaccionaron con un emoji (hasta 100)
    reacciones: (canal, mensaje, e) => pedir("GET", `/channels/${canal}/messages/${mensaje}/reactions/${emoji(e)}?limit=100`),
    canal: (canal) => pedir("GET", `/channels/${canal}`),
    ponerRol: (servidor, usuario, rol) => pedir("PUT", `/guilds/${servidor}/members/${usuario}/roles/${rol}`),
    sacarRol: (servidor, usuario, rol) => pedir("DELETE", `/guilds/${servidor}/members/${usuario}/roles/${rol}`),

    reaccionar: (canal, mensaje, e) => pedir("PUT", `/channels/${canal}/messages/${mensaje}/reactions/${emoji(e)}/@me`),
    sacarReaccion: (canal, mensaje, e) => pedir("DELETE", `/channels/${canal}/messages/${mensaje}/reactions/${emoji(e)}/@me`),

    responder: (canal, mensaje, texto) =>
      pedir("POST", `/channels/${canal}/messages`, {
        content: texto,
        message_reference: { message_id: mensaje, fail_if_not_exists: false },
        allowed_mentions: { replied_user: true, parse: [] },
      }),

    enviar: (canal, cuerpo) => pedir("POST", `/channels/${canal}/messages`, cuerpo),
    borrar: (canal, mensaje) => pedir("DELETE", `/channels/${canal}/messages/${mensaje}`),
    enviarConArchivos: (canal, cuerpo, archivos) => pedirConArchivos("POST", `/channels/${canal}/messages`, cuerpo, archivos),
    editarConArchivos: (canal, mensaje, cuerpo, archivos) =>
      pedirConArchivos("PATCH", `/channels/${canal}/messages/${mensaje}`, cuerpo, archivos),
    editar: (canal, mensaje, cuerpo) => pedir("PATCH", `/channels/${canal}/messages/${mensaje}`, cuerpo),
  };
}
