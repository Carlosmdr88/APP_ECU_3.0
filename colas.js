"use strict";
/** APP ECUS 2.0 — Colas reales desde Supabase; sin Auth ni Edge Functions. */
const modo = document.documentElement.dataset.modo;
const esAdmin = modo === "admin";
const ESTADOS = ECUS.ESTADOS,
  DISTRITOS = ECUS.DISTRITOS;
let registros = [],
  activo = null,
  ultimoFoco = null,
  permiso = null;
let subiendoFotosAdmin = false;
let indiceFotoAdminSeleccionada = null;
const $ = (id) => document.getElementById(id);
$("roleBadge").textContent = esAdmin
  ? "ADMINISTRADOR"
  : "USUARIO · MIS REGISTROS";
const filtroDistrito = $("filtroDistrito");
DISTRITOS.forEach((d) => {
  const o = document.createElement("option");
  o.value = d;
  o.textContent = d;
  filtroDistrito.append(o);
});
["buscar", "filtroDistrito", "filtroEstado"].forEach((id) =>
  $(id).addEventListener("input", renderLista),
);
$("btnSalir").addEventListener("click", () => ECUS.signOut());
const nodo = (tag, clase = "", valor) => {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (valor !== undefined) el.textContent = String(valor);
  return el;
};
const claseEstado = (e) =>
  ({
    Pendiente: "pendiente",
    Aprobado: "aprobado",
    Rechazado: "rechazado",
    "Volver a confirmar": "confirmar",
  })[e] || "";
const badge = (e) => nodo("span", "badge " + claseEstado(e), e);
const campo = (nombre, valor) => {
  const e = nodo("div", "detail-item");
  e.append(nodo("small", "", nombre), nodo("span", "", valor || "—"));
  return e;
};
const seccion = (t) => {
  const s = nodo("section", "section");
  s.append(nodo("h3", "", t));
  return s;
};
const fechaCR = (f) =>
  f
    ? new Date(f).toLocaleString("es-CR", {
        timeZone: "America/Costa_Rica",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "—";
function aviso(msj) {
  $("sinRegistros").textContent = msj;
  $("sinRegistros").classList.remove("hidden");
}
function renderLista() {
  $("total").textContent = registros.length;
  $("pendientes").textContent = registros.filter(
    (r) => r.estado === "Pendiente",
  ).length;
  $("aprobados").textContent = registros.filter(
    (r) => r.estado === "Aprobado",
  ).length;
  $("otrosEstados").textContent = registros.filter(
    (r) => !["Pendiente", "Aprobado"].includes(r.estado),
  ).length;
  const buscar = ECUS.upper($("buscar").value),
    d = $("filtroDistrito").value,
    e = $("filtroEstado").value;
  const data = registros.filter(
    (r) =>
      (!buscar ||
        `${r.nombre_completo} ${r.identificacion}`.includes(buscar)) &&
      (!d || r.distrito === d) &&
      (!e || r.estado === e),
  );
  const lista = $("lista");
  lista.replaceChildren();
  $("sinRegistros").classList.toggle("hidden", data.length > 0);
  if (!data.length)
    $("sinRegistros").textContent =
      "No hay registros que coincidan con los filtros.";
  data.forEach((r) => {
    const card = nodo("article", "record");
    const head = nodo("div", "record-head");
    head.append(nodo("span", "sub", `Registro #${r.id}`), badge(r.estado));
    card.append(head);
    const body = nodo("div", "record-body"),
      avatar = nodo("div", "avatar", "◉"),
      info = nodo("div");
    if (r.fotosUsuario[0]?.url) {
      avatar.replaceChildren();
      const img = nodo("img");
      img.src = r.fotosUsuario[0].url;
      img.alt = "Foto principal";
      avatar.append(img);
    }
    info.append(
      nodo("h3", "", r.nombre_completo),
      nodo("p", "", `Identificación: ${r.identificacion}`),
      nodo("p", "", `Distrito: ${r.distrito}`),
    );
    body.append(avatar, info);
    card.append(body);
    const boton = nodo("button", "btn primary", "VER DETALLES");
    boton.type = "button";
    boton.addEventListener("click", () => abrirDetalle(r.id));
    card.append(boton);
    lista.append(card);
  });
}
async function cargar() {
  const data = await ECUS.listRecords(modo);
  registros = (data || []).map((r) => ({
    ...r,
    fotosUsuario: [null, null, null, null],
    fotosAdmin: [null, null, null],
  }));
  renderLista();
}
function miniFoto(foto, label, alSeleccionarVacia = null) {
  const b = nodo("button", "thumb");
  b.type = "button";
  b.setAttribute("aria-label", label);
  if (foto?.url) {
    const img = nodo("img");
    img.src = foto.url;
    img.alt = label;
    b.append(img);
    b.addEventListener("click", () => abrirFoto(foto.url));
  } else if (alSeleccionarVacia) {
    b.classList.add("empty-admin-photo");
    b.textContent = "Pegar aquí";
    b.title = "Haz clic en esta casilla y pega una imagen con Ctrl+V";
    b.addEventListener("click", alSeleccionarVacia);
  } else {
    b.disabled = true;
    b.textContent = "Sin foto";
  }
  return b;
}
function fotosUsuario(r) {
  const s = seccion("Fotografías de registro (máximo 4)");
  const grande = miniFoto(r.fotosUsuario[0], "Fotografía principal");
  grande.className = "photo-main";
  s.append(grande);
  const mini = nodo("div", "thumbs");
  for (let i = 1; i < 4; i++)
    mini.append(miniFoto(r.fotosUsuario[i], `Foto ${i + 1}`));
  s.append(mini);
  return s;
}
function fotosAdmin(r) {
  const s = seccion("Fotografías administrativas (máximo 3)");
  const g = nodo("div", "admin-photos");
  for (let i = 0; i < 3; i++) {
    const item = nodo("div");
    const mini = miniFoto(
      r.fotosAdmin[i],
      `Foto administrativa ${i + 1}`,
      () => {
        indiceFotoAdminSeleccionada = i;
        g.querySelectorAll(".empty-admin-photo").forEach((casilla) => {
          casilla.classList.remove("selected-admin-photo");
        });
        mini.classList.add("selected-admin-photo");
        const estadoActual = $("detailContent").querySelector(
          "[data-admin-photo-status]",
        );
        if (estadoActual) {
          estadoActual.textContent = `Casilla ${i + 1} seleccionada. Ahora pega la foto con Ctrl+V.`;
        }
      },
    );
    item.append(mini);
    if (esAdmin && r.fotosAdmin[i]) {
      const quitar = nodo("button", "btn ghost photo-remove", "Eliminar");
      quitar.type = "button";
      quitar.addEventListener("click", async () => {
        if (!confirm("¿Eliminar fotografía administrativa?")) return;
        quitar.disabled = true;
        try {
          await ECUS.rpc("ecus_eliminar_foto_admin", {
            p_token_admin: ECUS.adminToken(),
            p_registro: r.id,
            p_foto: r.fotosAdmin[i].id,
          });
          r.fotosAdmin[i] = null;
          renderDetalle(r);
        } catch (err) {
          alert(ECUS.getMessage(err));
          quitar.disabled = false;
        }
      });
      item.append(quitar);
    }
    g.append(item);
  }
  s.append(g);
  if (esAdmin) {
    const input = nodo("input", "control");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.multiple = true;
    const estado = nodo("p", "toast");
    estado.dataset.adminPhotoStatus = "true";
    input.addEventListener("change", async () => {
      const archivos = Array.from(input.files || []);
      if (!archivos.length) return;
      input.value = "";
      await subirFotosAdmin(
        r,
        archivos,
        estado,
        input,
        indiceFotoAdminSeleccionada,
      );
    });
    s.append(
      nodo(
        "p",
        "note",
        "Solo Administrador. Seleccione varias fotos o péguelas con Ctrl+V mientras este detalle esté abierto. Se comprimen automáticamente.",
      ),
      input,
      estado,
    );
  }
  return s;
}
async function subirFotosAdmin(
  r,
  archivos,
  estado,
  input = null,
  indiceInicial = null,
) {
  if (subiendoFotosAdmin) {
    estado.textContent = "Ya hay fotografías en proceso de carga.";
    return;
  }
  const libres = r.fotosAdmin.map((f, i) => (f ? -1 : i)).filter((i) => i >= 0);
  if (indiceInicial !== null && !libres.includes(indiceInicial)) {
    estado.textContent = "La casilla seleccionada ya no está disponible.";
    return;
  }
  const destinos =
    indiceInicial === null
      ? libres
      : [indiceInicial, ...libres.filter((i) => i !== indiceInicial)];
  if (archivos.length > destinos.length) {
    estado.textContent = `Solo quedan ${libres.length} espacios.`;
    return;
  }
  try {
    archivos.forEach(ECUS.assertPhoto);
  } catch (err) {
    estado.textContent = ECUS.getMessage(err);
    return;
  }
  subiendoFotosAdmin = true;
  if (input) input.disabled = true;
  let resultado = "Fotografías guardadas.";
  try {
    for (let i = 0; i < archivos.length; i++) {
      estado.textContent = `Subiendo foto ${i + 1} de ${archivos.length}...`;
      await ECUS.savePhoto({
        file: archivos[i],
        registroId: r.id,
        origen: "administrador",
        numero: destinos[i] + 1,
      });
    }
  } catch (err) {
    resultado = "No se pudo guardar: " + ECUS.getMessage(err);
  }
  try {
    await cargarFotos(r);
  } catch (err) {
    resultado +=
      " No se pudieron actualizar las fotos: " + ECUS.getMessage(err);
  } finally {
    subiendoFotosAdmin = false;
    indiceFotoAdminSeleccionada = null;
    if (input) {
      input.disabled = false;
      input.value = "";
    }
  }
  if (activo?.id === r.id) renderDetalle(r);
  const estadoActual =
    activo?.id === r.id
      ? $("detailContent").querySelector("[data-admin-photo-status]")
      : estado;
  if (estadoActual) estadoActual.textContent = resultado;
}
function fotosDelPortapapeles(evento) {
  const datos = evento.clipboardData;
  if (!datos) return [];
  const imagenes = Array.from(datos.items || [])
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  return imagenes.length
    ? imagenes
    : Array.from(datos.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );
}
function editor(label, valor, tipo = "text", max = 180) {
  const wrap = nodo("label", "field", label),
    ctl = nodo("input", "control");
  ctl.type = tipo;
  ctl.value = valor ?? "";
  if (tipo !== "date") ctl.maxLength = max;
  wrap.append(ctl);
  return { wrap, ctl };
}
function edicion(r) {
  const s = seccion("Modificar registro · ADMINISTRADOR"),
    g = nodo("div", "admin-fields");
  const nombre = editor("Nombre completo", r.nombre_completo, "text", 150);
  const id = editor("Identificación", r.identificacion, "text", 50);
  const fecha = editor("Fecha de nacimiento", r.fecha_nacimiento, "date");
  const nacionalidad = editor("Nacionalidad", r.nacionalidad, "text", 80);
  const lugar = editor("Lugar de consulta", r.lugar_consulta, "text", 180);
  const labelD = nodo("label", "field", "Distrito"),
    dist = nodo("select", "control");
  DISTRITOS.forEach((x) => {
    const opt = nodo("option", "", x);
    opt.value = x;
    dist.append(opt);
  });
  dist.value = r.distrito;
  labelD.append(dist);
  const otro = editor("Otro distrito", r.otro_distrito || "", "text", 100);
  const toggle = () => (otro.wrap.hidden = dist.value !== "OTRO");
  dist.addEventListener("change", toggle);
  toggle();
  const labelE = nodo("label", "field", "Estado"),
    est = nodo("select", "control");
  ESTADOS.forEach((x) => {
    const opt = nodo("option", "", x);
    opt.value = x;
    est.append(opt);
  });
  est.value = r.estado;
  labelE.append(est);
  const labelObs = nodo("label", "field", "Respuesta / observaciones"),
    obs = nodo("textarea", "control");
  obs.rows = 3;
  obs.value = r.observaciones || "";
  labelObs.append(obs);
  const boton = nodo("button", "btn primary", "GUARDAR CAMBIOS"),
    mensaje = nodo("p", "toast");
  boton.type = "button";
  boton.addEventListener("click", async () => {
    const params = {
      p_token_admin: ECUS.adminToken(),
      p_registro: r.id,
      p_nombre: ECUS.upper(nombre.ctl.value),
      p_identificacion: ECUS.upper(id.ctl.value),
      p_fecha: fecha.ctl.value || null,
      p_nacionalidad: ECUS.upper(nacionalidad.ctl.value),
      p_distrito: dist.value,
      p_otro_distrito:
        dist.value === "OTRO" ? ECUS.upper(otro.ctl.value) : null,
      p_lugar: ECUS.upper(lugar.ctl.value),
      p_estado: est.value,
      p_observaciones: ECUS.upper(obs.value),
    };
    if (
      !params.p_nombre ||
      !params.p_identificacion ||
      !params.p_lugar ||
      (dist.value === "OTRO" && !params.p_otro_distrito)
    ) {
      mensaje.textContent = "Faltan campos obligatorios.";
      return;
    }
    boton.disabled = true;
    mensaje.textContent = "Guardando...";
    try {
      await ECUS.rpc("ecus_editar_registro", params);
      Object.assign(r, {
        nombre_completo: params.p_nombre,
        identificacion: params.p_identificacion,
        fecha_nacimiento: params.p_fecha,
        nacionalidad: params.p_nacionalidad,
        distrito: params.p_distrito,
        otro_distrito: params.p_otro_distrito,
        lugar_consulta: params.p_lugar,
        estado: params.p_estado,
        observaciones: params.p_observaciones,
      });
      renderLista();
      renderDetalle(r);
      await cargarHistorial(r);
    } catch (err) {
      mensaje.textContent = "Error: " + ECUS.getMessage(err);
      boton.disabled = false;
    }
  });
  g.append(
    nombre.wrap,
    id.wrap,
    fecha.wrap,
    nacionalidad.wrap,
    labelD,
    otro.wrap,
    lugar.wrap,
    labelE,
    labelObs,
    boton,
    mensaje,
  );
  s.append(g);
  return s;
}
function renderDetalle(r) {
  const content = $("detailContent");
  content.replaceChildren();
  const estado = seccion("Estado actual");
  estado.append(badge(r.estado));
  content.append(estado);
  const dat = seccion("Información del registro"),
    g = nodo("div", "detail-grid");
  [
    ["Nombre completo", r.nombre_completo],
    ["Identificación", r.identificacion],
    ["Fecha de nacimiento", r.fecha_nacimiento],
    ["Nacionalidad", r.nacionalidad],
    ["Lugar de consulta", r.lugar_consulta],
    [
      "Distrito",
      r.distrito === "OTRO" ? r.otro_distrito || "OTRO" : r.distrito,
    ],
    ["Fecha de registro", fechaCR(r.fecha_registro)],
    ["Número de registro", r.id],
  ].forEach(([a, b]) => g.append(campo(a, b)));
  dat.append(g);
  content.append(dat, fotosUsuario(r), fotosAdmin(r));
  const obs = seccion("Respuesta del Administrador");
  obs.append(nodo("p", "sub", r.observaciones || "Sin respuesta registrada."));
  content.append(obs);
  if (esAdmin) content.append(edicion(r));
  else
    content.append(
      nodo(
        "p",
        "readonly",
        "Solo lectura: puede consultar sus registros y la respuesta del Administrador.",
      ),
    );
}
async function cargarFotos(r) {
  const data = await ECUS.listPhotos(r.id, modo);
  r.fotosUsuario = [null, null, null, null];
  r.fotosAdmin = [null, null, null];
  for (const f of data || []) {
    const arr = f.origen === "administrador" ? r.fotosAdmin : r.fotosUsuario;
    const i = f.numero_foto - 1;
    if (i >= 0 && i < arr.length)
      arr[i] = {
        id: f.id,
        url: `data:${f.mime || "image/jpeg"};base64,${f.base64}`,
      };
  }
}
async function cargarHistorial(r) {
  const s = seccion("Historial de estados"),
    info = nodo("p", "sub", "Cargando historial...");
  s.append(info);
  $("detailContent").append(s);
  try {
    const lista = await ECUS.listHistory(r.id, modo);
    if (activo?.id !== r.id) return;
    info.replaceChildren();
    if (!lista?.length) {
      info.textContent = "Sin historial disponible.";
      return;
    }
    lista.forEach((h) =>
      info.append(
        nodo(
          "p",
          "",
          `${fechaCR(h.fecha_cambio)} · ${h.estado_anterior || "NUEVO"} → ${h.estado_nuevo}${h.observacion ? " · " + h.observacion : ""}`,
        ),
      ),
    );
  } catch (e) {
    info.textContent = "No se pudo cargar el historial: " + ECUS.getMessage(e);
  }
}
async function abrirDetalle(id) {
  const r = registros.find((x) => x.id === id);
  if (!r) return;
  indiceFotoAdminSeleccionada = null;
  activo = r;
  ultimoFoco = document.activeElement;
  renderDetalle(r);
  $("detailOverlay").classList.add("open");
  document.body.style.overflow = "hidden";
  $("cerrarDetalle").focus();
  const info = nodo("p", "note", "Cargando fotografías...");
  $("detailContent").append(info);
  try {
    await cargarFotos(r);
    if (activo?.id === id) {
      renderDetalle(r);
      await cargarHistorial(r);
    }
  } catch (err) {
    info.textContent =
      "No se pudieron cargar las fotos: " + ECUS.getMessage(err);
    await cargarHistorial(r);
  }
}
function cerrarDetalle() {
  $("detailOverlay").classList.remove("open");
  document.body.style.overflow = "";
  activo = null;
  indiceFotoAdminSeleccionada = null;
  ultimoFoco?.focus();
}
function abrirFoto(url) {
  $("fotoAmpliada").src = url;
  $("photoOverlay").classList.add("open");
  $("cerrarFoto").focus();
}
function cerrarFoto() {
  $("photoOverlay").classList.remove("open");
  $("fotoAmpliada").removeAttribute("src");
}
$("cerrarDetalle").addEventListener("click", cerrarDetalle);
$("cerrarFoto").addEventListener("click", cerrarFoto);
$("detailOverlay").addEventListener("click", (e) => {
  if (e.target === $("detailOverlay")) cerrarDetalle();
});
$("photoOverlay").addEventListener("click", (e) => {
  if (e.target === $("photoOverlay")) cerrarFoto();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if ($("photoOverlay").classList.contains("open")) cerrarFoto();
    else if ($("detailOverlay").classList.contains("open")) cerrarDetalle();
  }
});
document.addEventListener("paste", (evento) => {
  if (!esAdmin || !activo || !$("detailOverlay").classList.contains("open"))
    return;
  const archivos = fotosDelPortapapeles(evento);
  if (!archivos.length) return;
  evento.preventDefault();
  const estado = $("detailContent").querySelector("[data-admin-photo-status]");
  if (estado) {
    subirFotosAdmin(
      activo,
      archivos,
      estado,
      null,
      indiceFotoAdminSeleccionada,
    );
  }
});
ECUS.requireMode(modo)
  .then(async (x) => {
    if (!x) return;
    permiso = x;
    try {
      aviso("Consultando registros...");
      await cargar();
    } catch (err) {
      aviso("No fue posible cargar registros: " + ECUS.getMessage(err));
    }
  })
  .catch((e) => aviso("Error de acceso: " + ECUS.getMessage(e)));
