"use strict";
/* APP ECUS 2.0 — Sin Auth, correos ni Edge Functions.
 * La API pública solo puede ejecutar RPC autorizadas por la base de datos.
 * Usuario: clave de navegador aleatoria; admin: código de 6 dígitos -> sesión temporal.
 */
(function () {
  const config = window.ECUS_CONFIG;
  if (!config || !window.supabase?.createClient) {
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<p style="background:#7f1d1d;color:white;padding:14px">No se pudo cargar la biblioteca de Supabase. Revise Internet.</p>',
    );
    return;
  }
  const db = window.supabase.createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const DISPOSITIVO = "ecus2_dispositivo_v3",
    ADMIN = "ecus2_admin_token_v3";
  const DISTRITOS = [
    "CARMEN",
    "MERCED",
    "HOSPITAL",
    "CATEDRAL",
    "ZAPOTE",
    "SAN FRANCISCO DE DOS RÍOS",
    "URUCA",
    "MATA REDONDA",
    "PAVAS",
    "HATILLO",
    "SAN SEBASTIÁN",
    "OTRO",
  ];
  const ESTADOS = [
    "Pendiente",
    "Aprobado",
    "Rechazado",
    "Con expediente NP",
    "Volver a confirmar",
  ];
  const upper = (v) =>
    String(v ?? "")
      .trim()
      .toLocaleUpperCase("es-CR");
  const errorText = (e) => e?.message || String(e || "Error desconocido");
  async function rpc(nombre, params) {
    const { data, error } = await db.rpc(nombre, params);
    if (error) throw new Error(error.message || `Error en ${nombre}`);
    return data;
  }
  function deviceKey() {
    let val = localStorage.getItem(DISPOSITIVO);
    if (!/^[0-9a-f]{64}$/.test(val || "")) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      val = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      localStorage.setItem(DISPOSITIVO, val);
    }
    return val;
  }
  function adminToken() {
    return sessionStorage.getItem(ADMIN) || null;
  }
  async function requireMode(modo) {
    const key = deviceKey();
    if (modo === "admin") {
      const token = adminToken();
      if (!token) {
        location.replace("index.html");
        return null;
      }
      const valido = await rpc("ecus_validar_admin", { p_token: token });
      if (!valido) {
        sessionStorage.removeItem(ADMIN);
        location.replace("index.html");
        return null;
      }
      return { deviceKey: key, adminToken: token, mode: "admin" };
    }
    return { deviceKey: key, adminToken: null, mode: "usuario" };
  }
  async function enterUser() {
    const token = adminToken();
    if (token) {
      sessionStorage.removeItem(ADMIN);
      try {
        await rpc("ecus_cerrar_admin", { p_token: token });
      } catch (e) {
        console.warn(e.message);
      }
    }
    deviceKey();
    location.assign("registro_usuario.html");
  }
  async function enterAdmin(codigo) {
    if (!/^\d{6}$/.test(codigo))
      throw new Error("Ingrese exactamente seis dígitos.");
    const result = await rpc("ecus_entrar_admin", { p_codigo: codigo });
    if (!result?.token)
      throw new Error("Código incorrecto, inactivo o temporalmente bloqueado.");
    sessionStorage.setItem(ADMIN, result.token);
    deviceKey();
    location.assign("registro_admin.html");
  }
  async function signOut() {
    const token = adminToken();
    sessionStorage.removeItem(ADMIN);
    if (token) {
      try {
        await rpc("ecus_cerrar_admin", { p_token: token });
      } catch (e) {
        console.warn(e.message);
      }
    }
    location.replace("index.html");
  }
  function assertPhoto(file) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Solo fotos JPG, PNG o WEBP.");
    if (file.size > 10 * 1024 * 1024)
      throw new Error("La foto original no debe superar 10 MB.");
  }
  async function encodePhoto(file) {
    assertPhoto(file);
    const bitmap = await createImageBitmap(file);
    try {
      let lado = 1100,
        calidad = 0.8;
      for (let intento = 0; intento < 4; intento++) {
        const ratio = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
        const cv = document.createElement("canvas");
        cv.width = Math.max(1, Math.round(bitmap.width * ratio));
        cv.height = Math.max(1, Math.round(bitmap.height * ratio));
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, cv.width, cv.height);
        ctx.drawImage(bitmap, 0, 0, cv.width, cv.height);
        const dataUrl = cv.toDataURL("image/jpeg", calidad);
        const base64 = dataUrl.split(",")[1];
        if (base64.length < 2700000)
          return { p_mime: "image/jpeg", p_base64: base64 };
        lado = Math.round(lado * 0.78);
        calidad -= 0.1;
      }
      throw new Error("No fue posible comprimir la imagen a 2 MB.");
    } finally {
      bitmap.close();
    }
  }
  async function savePhoto({ file, registroId, origen, numero }) {
    const img = await encodePhoto(file);
    return rpc("ecus_subir_foto", {
      p_clave: deviceKey(),
      p_registro: registroId,
      p_origen: origen,
      p_numero: numero,
      p_mime: img.p_mime,
      p_base64: img.p_base64,
      p_token_admin: origen === "administrador" ? adminToken() : null,
    });
  }
  async function listRecords(modo) {
    return rpc("ecus_listar_registros", {
      p_clave: deviceKey(),
      p_token_admin: modo === "admin" ? adminToken() : null,
    });
  }
  async function listPhotos(id, modo) {
    return rpc("ecus_listar_fotos", {
      p_clave: deviceKey(),
      p_registro: id,
      p_token_admin: modo === "admin" ? adminToken() : null,
    });
  }
  async function listHistory(id, modo) {
    return rpc("ecus_listar_historial", {
      p_clave: deviceKey(),
      p_registro: id,
      p_token_admin: modo === "admin" ? adminToken() : null,
    });
  }
  window.ECUS = {
    config,
    db,
    upper,
    DISTRITOS,
    ESTADOS,
    rpc,
    deviceKey,
    adminToken,
    requireMode,
    enterUser,
    enterAdmin,
    signOut,
    assertPhoto,
    encodePhoto,
    savePhoto,
    listRecords,
    listPhotos,
    listHistory,
    getMessage: errorText,
  };
})();
