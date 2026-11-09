"use strict";
const modo = document.documentElement.dataset.modo;
const fotos = [null, null, null, null];
let indiceFotoActivo = 0,
  permiso = null;
const form = document.getElementById("registro-form");
const distrito = document.getElementById("distrito");
const otroWrap = document.getElementById("otro-distrito-wrap");
const otroDistrito = document.getElementById("otro_distrito");
const photoInput = document.getElementById("photo-input");
const photoSourceDialog = document.getElementById("photo-source-dialog");
const tiles = [...document.querySelectorAll(".photo-tile")];
ECUS.requireMode(modo)
  .then((x) => {
    permiso = x;
  })
  .catch((e) => mostrarMensaje(ECUS.getMessage(e), true));
function mostrarMensaje(msj, esError = false) {
  const b = document.getElementById("form-message");
  b.textContent = msj;
  b.className = `rounded-xl p-3 text-xs ${esError ? "bg-red-950 text-red-200 border border-red-700" : "bg-sky-950 text-sky-200 border border-sky-700"}`;
}
distrito.addEventListener("change", () => {
  const otro = distrito.value === "OTRO";
  otroWrap.classList.toggle("hidden", !otro);
  otroDistrito.required = otro;
  if (!otro) otroDistrito.value = "";
});
function vistaFoto(i) {
  const tile = tiles[i],
    img = tile.querySelector("img"),
    f = fotos[i];
  if (img.dataset.objectUrl) URL.revokeObjectURL(img.dataset.objectUrl);
  delete img.dataset.objectUrl;
  if (f) {
    const u = URL.createObjectURL(f);
    img.src = u;
    img.dataset.objectUrl = u;
    img.hidden = false;
    tile.classList.add("has-photo");
  } else {
    img.removeAttribute("src");
    img.hidden = true;
    tile.classList.remove("has-photo");
  }
  document.getElementById("photo-count").textContent =
    `${fotos.filter(Boolean).length} / 4`;
}
tiles.forEach((tile, i) => {
  tile.addEventListener("click", (e) => {
    if (!e.target.closest(".remove-photo")) {
      abrirSelectorFoto(i);
    }
  });
  tile.addEventListener("keydown", (e) => {
    if (e.target === tile && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      abrirSelectorFoto(i);
    }
  });
  tile.querySelector(".remove-photo").addEventListener("click", (e) => {
    e.stopPropagation();
    fotos[i] = null;
    vistaFoto(i);
  });
});
function abrirSelectorFoto(i) {
  indiceFotoActivo = i;
  photoInput.value = "";
  photoSourceDialog.classList.add("open");
  photoSourceDialog.querySelector('[data-photo-source="camera"]').focus();
}
function cerrarSelectorFoto() {
  photoSourceDialog.classList.remove("open");
}
photoSourceDialog.addEventListener("click", (e) => {
  if (e.target === photoSourceDialog) cerrarSelectorFoto();
});
photoSourceDialog.querySelectorAll("[data-photo-source]").forEach((button) => {
  button.addEventListener("click", () => {
    const fuente = button.dataset.photoSource;
    cerrarSelectorFoto();
    if (fuente === "cancel") return;
    if (fuente === "camera") photoInput.setAttribute("capture", "environment");
    else photoInput.removeAttribute("capture");
    photoInput.click();
  });
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && photoSourceDialog.classList.contains("open"))
    cerrarSelectorFoto();
});
photoInput.addEventListener("change", () => {
  const f = photoInput.files?.[0];
  if (!f) return;
  try {
    ECUS.assertPhoto(f);
    fotos[indiceFotoActivo] = f;
    vistaFoto(indiceFotoActivo);
  } catch (e) {
    mostrarMensaje(e.message, true);
  }
});
for (const id of [
  "nombre",
  "documento",
  "nacionalidad",
  "otro_distrito",
  "lugar_consulta",
]) {
  document.getElementById(id).addEventListener("blur", (e) => {
    e.target.value = ECUS.upper(e.target.value);
  });
}
document
  .getElementById("btnVerColas")
  .addEventListener("click", () => location.assign(`colas_${modo}.html`));
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!permiso) {
    mostrarMensaje("Acceso no disponible. Volvé al inicio.", true);
    return;
  }
  if (!form.reportValidity()) return;
  const d = distrito.value;
  const v = (id) => ECUS.upper(document.getElementById(id).value);
  const data = {
    p_clave: ECUS.deviceKey(),
    p_nombre: v("nombre"),
    p_identificacion: v("documento"),
    p_fecha: document.getElementById("fecha_nacimiento").value || null,
    p_nacionalidad: v("nacionalidad"),
    p_distrito: d,
    p_otro_distrito: d === "OTRO" ? v("otro_distrito") : null,
    p_lugar: v("lugar_consulta"),
    p_token_admin: modo === "admin" ? ECUS.adminToken() : null,
  };
  if (
    !data.p_nombre ||
    !data.p_identificacion ||
    !data.p_lugar ||
    (d === "OTRO" && !data.p_otro_distrito)
  ) {
    mostrarMensaje("Complete los campos obligatorios.", true);
    return;
  }
  const boton = form.querySelector('[type="submit"]');
  boton.disabled = true;
  try {
    mostrarMensaje("Guardando registro en Supabase...");
    const id = await ECUS.rpc("ecus_crear_registro", data);
    const fallas = [];
    for (let i = 0; i < 4; i++)
      if (fotos[i]) {
        mostrarMensaje(
          `Registro #${id} guardado. Subiendo fotografía ${i + 1}...`,
        );
        try {
          await ECUS.savePhoto({
            file: fotos[i],
            registroId: id,
            origen: "usuario",
            numero: i + 1,
          });
        } catch (ex) {
          fallas.push(`Foto ${i + 1}: ${ECUS.getMessage(ex)}`);
        }
      }
    form.reset();
    distrito.dispatchEvent(new Event("change"));
    fotos.fill(null);
    tiles.forEach((_, i) => vistaFoto(i));
    if (fallas.length)
      mostrarMensaje(
        `Registro #${id} guardado, pero fallaron fotos: ${fallas.join("; ")}. NO reenviar el registro.`,
        true,
      );
    else
      mostrarMensaje(
        `Registro #${id} guardado correctamente. Podés ver la respuesta en VER COLAS.`,
      );
  } catch (err) {
    mostrarMensaje("Error al guardar: " + ECUS.getMessage(err), true);
  } finally {
    boton.disabled = false;
  }
});
