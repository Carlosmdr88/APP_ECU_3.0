"use strict";
/** APP ECUS 2.0 — Colas reales desde Supabase; sin Auth ni Edge Functions. */
const modo = document.documentElement.dataset.modo;
const esAdmin = modo === "admin";
const ESTADOS = ECUS.ESTADOS,
  DISTRITOS = ECUS.DISTRITOS;
let registros = [],
  registrosVisibles = [],
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
const filtroBusqueda = $("buscar");
const filtroEstado = $("filtroEstado");
const filtroFechaDesde = $("fechaRegistroDesde");
const filtroFechaHasta = $("fechaRegistroHasta");
if (filtroDistrito) {
  DISTRITOS.forEach((d) => {
    const o = document.createElement("option");
    o.value = d;
    o.textContent = d;
    filtroDistrito.append(o);
  });
}
[filtroBusqueda, filtroDistrito, filtroEstado].forEach((filtro) => {
  filtro?.addEventListener("input", renderLista);
});
[filtroFechaDesde, filtroFechaHasta].forEach((filtro) => {
  filtro?.addEventListener("change", renderLista);
});
$("btnSalir").addEventListener("click", () => ECUS.signOut());
const botonExportarExcel = $("exportarExcel");
if (botonExportarExcel) {
  botonExportarExcel.addEventListener("click", exportarRegistrosExcel);
}
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
    "Con expediente NP": "expediente-np",
    "Volver a confirmar": "confirmar",
  })[e] || "";
const etiquetaEstado = (e) =>
  ({
    Aprobado: "SIN EXPEDIENTE",
    Rechazado: "ORDEN DE CAPTURA",
    "Con expediente NP": "CON EXPEDIENTE NP",
  })[e] || e;
const badge = (e) =>
  nodo("span", "badge " + claseEstado(e), etiquetaEstado(e));
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
function fechaRegistroCR(f) {
  if (!f) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(f)) return f;
  const fecha = new Date(f);
  if (Number.isNaN(fecha.getTime())) return "";
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(fecha);
  const parte = (tipo) => partes.find((item) => item.type === tipo)?.value || "";
  return `${parte("year")}-${parte("month")}-${parte("day")}`;
}
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
  $("ordenCaptura").textContent = registros.filter(
    (r) => r.estado === "Rechazado",
  ).length;
  $("expedienteNP").textContent = registros.filter(
    (r) => r.estado === "Con expediente NP",
  ).length;
  $("confirmar").textContent = registros.filter(
    (r) => r.estado === "Volver a confirmar",
  ).length;
  const buscar = filtroBusqueda ? ECUS.upper(filtroBusqueda.value) : "",
    d = filtroDistrito?.value || "",
    e = filtroEstado?.value || "",
    desde = filtroFechaDesde?.value || "",
    hasta = filtroFechaHasta?.value || "",
    rangoValido = !desde || !hasta || desde <= hasta;
  const data = registros.filter((r) => {
    if (
      !rangoValido ||
      (buscar &&
        !`${r.nombre_completo} ${r.identificacion}`.includes(buscar)) ||
      (d && r.distrito !== d) ||
      (e && r.estado !== e)
    ) {
      return false;
    }
    if (!desde && !hasta) return true;
    const fechaRegistro = fechaRegistroCR(r.fecha_registro);
    return (
      fechaRegistro !== "" &&
      (!desde || fechaRegistro >= desde) &&
      (!hasta || fechaRegistro <= hasta)
    );
  });
  const lista = $("lista");
  registrosVisibles = data;
  lista.replaceChildren();
  $("sinRegistros").classList.toggle("hidden", data.length > 0);
  if (!data.length) {
    $("sinRegistros").textContent = rangoValido
      ? "No hay registros que coincidan con los filtros."
      : "La fecha inicial no puede ser posterior a la fecha final.";
  }
  data.forEach((r) => {
    const card = nodo("article", `record ${claseEstado(r.estado)}`);
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
async function exportarRegistrosExcel() {
  const estado = $("estadoExportacion");
  const desde = filtroFechaDesde?.value || "";
  const hasta = filtroFechaHasta?.value || "";
  if (!desde && !hasta) {
    estado.textContent = "Selecciona al menos una fecha de registro.";
    return;
  }
  if (desde && hasta && desde > hasta) {
    estado.textContent = "La fecha inicial no puede ser posterior a la final.";
    return;
  }
  if (!registrosVisibles.length) {
    estado.textContent = "No hay registros en el rango y filtros seleccionados.";
    return;
  }
  if (!window.ExcelJS) {
    estado.textContent =
      "No se pudo cargar el generador de Excel. Revisa la conexión e inténtalo de nuevo.";
    return;
  }

  botonExportarExcel.disabled = true;
  try {
    const libro = new ExcelJS.Workbook();
    libro.creator = "APP ECUS 2.0";
    libro.created = new Date();
    const hoja = libro.addWorksheet("Registros");
    const encabezados = [
      "N.º registro",
      "Nombre completo",
      "Identificación",
      "Fecha de nacimiento",
      "Nacionalidad",
      "Lugar de consulta",
      "Distrito",
      "Fecha de registro",
      "Último estado",
      "Foto de registro 1",
      "Foto de registro 2",
      "Foto de registro 3",
      "Foto de registro 4",
      "Foto administrativa 1",
      "Foto administrativa 2",
      "Foto administrativa 3",
    ];
    const cabecera = hoja.addRow(encabezados);
    cabecera.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cabecera.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17324D" },
    };
    hoja.views = [{ state: "frozen", ySplit: 1 }];
    hoja.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: encabezados.length },
    };
    hoja.columns = encabezados.map((header, i) => ({
      header,
      key: `columna${i}`,
      width: i === 1 || i === 5 ? 28 : i === 8 ? 24 : i >= 9 ? 18 : 20,
    }));

    for (let i = 0; i < registrosVisibles.length; i++) {
      const registro = registrosVisibles[i];
      estado.textContent = `Preparando registro ${i + 1} de ${registrosVisibles.length} y sus fotografías...`;
      if (!registro.fotosCargadas) await cargarFotos(registro);

      const distrito =
        registro.distrito === "OTRO"
          ? registro.otro_distrito || "OTRO"
          : registro.distrito;
      const fila = hoja.addRow([
        registro.id,
        registro.nombre_completo || "",
        registro.identificacion || "",
        registro.fecha_nacimiento || "",
        registro.nacionalidad || "",
        registro.lugar_consulta || "",
        distrito || "",
        fechaCR(registro.fecha_registro),
        etiquetaEstado(registro.estado),
        "",
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      fila.height = 58;
      fila.alignment = { vertical: "middle", wrapText: true };

      const fotos = [...registro.fotosUsuario, ...registro.fotosAdmin];
      fotos.forEach((foto, indice) => {
        if (!foto?.url) return;
        const formato = foto.url.match(/^data:image\/(jpeg|png);base64,/i);
        if (!formato) {
          throw new Error(
            `La foto ${indice + 1} del registro #${registro.id} tiene un formato no compatible con Excel.`,
          );
        }
        const imagenId = libro.addImage({
          base64: foto.url,
          extension: formato[1].toLowerCase(),
        });
        hoja.addImage(imagenId, {
          tl: { col: 9 + indice, row: fila.number - 1 },
          ext: { width: 110, height: 72 },
        });
      });
    }

    estado.textContent = "Generando archivo de Excel...";
    const contenido = await libro.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([contenido], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = `registros_${desde || "inicio"}_${hasta || "hoy"}.xlsx`;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    estado.textContent = `Excel descargado: ${registrosVisibles.length} registros con sus fotografías disponibles.`;
  } catch (err) {
    estado.textContent =
      "No se pudo exportar el Excel: " + ECUS.getMessage(err);
  } finally {
    botonExportarExcel.disabled = false;
  }
}
async function cargar() {
  const data = await ECUS.listRecords(modo);
  registros = (data || []).map((r) => ({
    ...r,
    fotosUsuario: [null, null, null, null],
    fotosAdmin: [null, null, null],
    fotosCargadas: false,
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
    const opt = nodo("option", "", etiquetaEstado(x));
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
  const botonPdf = nodo("button", "btn primary", "DESCARGAR PDF");
  botonPdf.type = "button";
  botonPdf.disabled = !r.fotosCargadas;
  botonPdf.title = r.fotosCargadas
    ? "Imprimir o guardar este registro como PDF"
    : "Espere a que terminen de cargar las fotografías";
  botonPdf.addEventListener("click", () => generarPdf(r));
  estado.append(botonPdf);
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
async function generarPdf(r) {
  const ventana = window.open("", "_blank");
  if (!ventana) {
    alert(
      "El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes para este sitio e inténtalo de nuevo.",
    );
    return;
  }

  ventana.document.open();
  ventana.document.write(
    `<!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Registro</title>
          <style>
            body { font: 14px/1.5 Arial, sans-serif; color: #172033; margin: 28px; }
            h1 { font-size: 22px; margin: 0 0 4px; }
            .meta { color: #596579; margin: 0 0 20px; }
            .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; margin: 0; }
            .fields div { border-bottom: 1px solid #d5dbe5; padding: 0 0 8px; break-inside: avoid; }
            .fields dt { font-size: 11px; text-transform: uppercase; color: #596579; font-weight: bold; }
            .fields dd { margin: 2px 0 0; overflow-wrap: anywhere; }
            .status { display: inline-block; padding: 4px 10px; border-radius: 20px; font-weight: bold; background: #e8edf3; }
            .status.aprobado { color: #14532d; background: #dcfce7; }
            .status.rechazado { color: #991b1b; background: #fee2e2; }
            .status.expediente-np { color: #854d0e; background: #fef3c7; }
            .status.confirmar { color: #1e40af; background: #dbeafe; }
            .photos { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 12px; }
            .photo { border: 1px solid #d5dbe5; border-radius: 8px; padding: 8px; break-inside: avoid; }
            .photo img { display: block; width: 100%; height: 220px; object-fit: contain; }
            .photo p { font-size: 12px; color: #596579; margin: 4px 0 0; }
            h2 { font-size: 16px; margin: 22px 0 8px; }
            .empty { color: #596579; }
            @page { size: A4; margin: 16mm; }
            @media print {
              body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .photo img { height: 190px; }
            }
          </style>
        </head>
        <body></body>
      </html>`,
  );
  ventana.document.close();
  ventana.document.title = `Registro_${r.id}`;

  const doc = ventana.document;
  const titulo = doc.createElement("h1");
  titulo.textContent = "Registro de persona";
  doc.body.append(titulo);
  const numero = doc.createElement("p");
  numero.className = "meta";
  numero.textContent = `Número de registro: ${r.id}`;
  doc.body.append(numero);

  const estado = doc.createElement("p");
  const etiqueta = doc.createElement("span");
  etiqueta.className = `status ${claseEstado(r.estado)}`;
  etiqueta.textContent = etiquetaEstado(r.estado);
  estado.append("Último estado: ", etiqueta);
  doc.body.append(estado);

  const datos = [
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
  ];
  const lista = doc.createElement("dl");
  lista.className = "fields";
  datos.forEach(([nombre, valor]) => {
    const item = doc.createElement("div");
    const termino = doc.createElement("dt");
    termino.textContent = nombre;
    const detalle = doc.createElement("dd");
    detalle.textContent = valor || "—";
    item.append(termino, detalle);
    lista.append(item);
  });
  doc.body.append(lista);

  const tituloFotos = doc.createElement("h2");
  tituloFotos.textContent = "Fotografías";
  doc.body.append(tituloFotos);
  const fotos = doc.createElement("div");
  fotos.className = "photos";
  const imagenes = [
    ...r.fotosUsuario.map((foto, i) => ({
      foto,
      nombre: `Foto de registro ${i + 1}`,
    })),
    ...r.fotosAdmin.map((foto, i) => ({
      foto,
      nombre: `Foto administrativa ${i + 1}`,
    })),
  ].filter(({ foto }) => foto?.url);

  if (imagenes.length) {
    const cargas = [];
    imagenes.forEach(({ foto, nombre }) => {
      const item = doc.createElement("div");
      item.className = "photo";
      const imagen = doc.createElement("img");
      imagen.src = foto.url;
      imagen.alt = nombre;
      const pie = doc.createElement("p");
      pie.textContent = nombre;
      item.append(imagen, pie);
      fotos.append(item);
      cargas.push(imagen.decode());
    });
    doc.body.append(fotos);
    try {
      await Promise.all(cargas);
    } catch (err) {
      ventana.close();
      alert(
        "No se pudieron preparar todas las fotografías para el PDF: " +
          ECUS.getMessage(err),
      );
      return;
    }
  } else {
    const sinFotos = doc.createElement("p");
    sinFotos.className = "empty";
    sinFotos.textContent = "Este registro no tiene fotografías.";
    doc.body.append(sinFotos);
  }

  ventana.focus();
  ventana.print();
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
  r.fotosCargadas = true;
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
          `${fechaCR(h.fecha_cambio)} · ${etiquetaEstado(h.estado_anterior || "NUEVO")} → ${etiquetaEstado(h.estado_nuevo)}${h.observacion ? " · " + h.observacion : ""}`,
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
