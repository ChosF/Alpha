/* Networking Night: registro, boleto descargable y calendario. Lo usan la página móvil y la de escritorio. */
(function () {
  "use strict";

  var CALENDARIO =
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Networking%20Night%20%C2%B7%20Alpha&dates=20261105T230000Z%2F20261106T013000Z&details=Networking%20Night%20de%20Alpha.%20Registro%20desde%20las%204%3A40%20p.m.%20Business%20casual.%20Lleva%20tu%20boleto%20con%20c%C3%B3digo%20QR%20y%20%2470%20MXN%20en%20efectivo.&location=Claustro%20CEDETEC%2C%20Tecnol%C3%B3gico%20de%20Monterrey%20Campus%20Ciudad%20de%20M%C3%A9xico&ctz=America%2FMexico_City";
  var CLAVE = "alpha-nn-boleto";
  var CLAVE_SOLICITUD = "alpha-nn-solicitud";
  var token = null;

  var GAFETES = {
    estudiante: { etiqueta: "Estudiante", gafete: "Gafete Blanco", rol: "ASISTENTE · GAFETE BLANCO", hex: "#0066ff" },
    exatec: { etiqueta: "Exatec", gafete: "Gafete Plata", rol: "EXATEC · GAFETE PLATA", hex: "#64748b" },
    ponente: { etiqueta: "Ponente", gafete: "Gafete Dorado", rol: "PONENTE · GAFETE DORADO", hex: "#b08b3e" },
    aliado: { etiqueta: "Aliado Alpha", gafete: "Gafete Azul", rol: "ALIADO ALPHA · GAFETE AZUL", hex: "#194270" },
  };

  var PARTICULAS = {
    de: 1, del: 1, la: 1, las: 1, los: 1, y: 1, e: 1,
    san: 1, santa: 1, van: 1, von: 1, da: 1, das: 1, do: 1, dos: 1, mc: 1, mac: 1,
  };

  var NOMBRES_PILA_M = {
    juan: 1, luis: 1, jose: 1, miguel: 1, carlos: 1, jorge: 1, marco: 1, jesus: 1,
    victor: 1, hector: 1, oscar: 1, cesar: 1, julio: 1, francisco: 1, pedro: 1,
    diego: 1, erick: 1, erik: 1, alan: 1, edgar: 1, christian: 1, cristian: 1,
    angel: 1, gabriel: 1, aaron: 1, alejandro: 1, antonio: 1, eduardo: 1,
    fernando: 1, roberto: 1, daniel: 1, david: 1, emilio: 1, sebastian: 1,
    santiago: 1, mateo: 1, manuel: 1, javier: 1, arturo: 1, enrique: 1,
    mauricio: 1, rodrigo: 1, patricio: 1, hugo: 1, ivan: 1, sergio: 1, raul: 1,
    ricardo: 1, andres: 1, adrian: 1, mario: 1, armando: 1, alberto: 1,
  };

  var SEGUNDOS_NOMBRES_M = {
    pablo: 1, pa: 1, carlos: 1, luis: 1, fernando: 1, angel: 1, antonio: 1,
    eduardo: 1, alberto: 1, roberto: 1, alejandro: 1, daniel: 1, david: 1,
    emilio: 1, sebastian: 1, santiago: 1, mateo: 1, manuel: 1, javier: 1,
    arturo: 1, enrique: 1, mauricio: 1, rodrigo: 1, patricio: 1, cesar: 1,
    victor: 1, hugo: 1, ivan: 1, gael: 1, iker: 1, bruno: 1, diego: 1,
    emiliano: 1, leonardo: 1, andres: 1, adrian: 1, nicolas: 1, salvador: 1,
    gerardo: 1, guillermo: 1, gustavo: 1, ignacio: 1, jaime: 1, lorenzo: 1,
    omar: 1, rafael: 1, ramon: 1, rene: 1, ruben: 1, saul: 1, ulises: 1,
    maria: 1, jose: 1, jesus: 1, francisco: 1,
  };

  var NOMBRES_PILA_F = {
    maria: 1, ana: 1, luz: 1, flor: 1, alma: 1, dulce: 1, rosa: 1, perla: 1,
    blanca: 1, claudia: 1, laura: 1, martha: 1, marta: 1, carmen: 1, silvia: 1,
    diana: 1, karla: 1, carla: 1, paola: 1, andrea: 1, daniela: 1, gabriela: 1,
    valeria: 1, camila: 1, sofia: 1, ximena: 1, regina: 1, fernanda: 1,
    mariana: 1, alejandra: 1, natalia: 1, lucia: 1, elena: 1, Victoria: 1,
    victoria: 1, paulina: 1, renata: 1, romina: 1, sara: 1, elisa: 1, eva: 1,
  };

  var SEGUNDOS_NOMBRES_F = {
    jose: 1, sofia: 1, fernanda: 1, paola: 1, paulina: 1, daniela: 1,
    gabriela: 1, alejandra: 1, natalia: 1, lucia: 1, elena: 1, isabel: 1,
    carmen: 1, guadalupe: 1, victoria: 1, valeria: 1, camila: 1, regina: 1,
    ximena: 1, andrea: 1, laura: 1, claudia: 1, patricia: 1, veronica: 1,
    monica: 1, silvia: 1, adriana: 1, beatriz: 1, cecilia: 1, cristina: 1,
    diana: 1, estela: 1, fabiola: 1, gloria: 1, irene: 1, julieta: 1,
    karla: 1, leticia: 1, liliana: 1, lorena: 1, lourdes: 1, marcela: 1,
    margarita: 1, mariana: 1, marisol: 1, mayra: 1, miriam: 1, nadia: 1,
    norma: 1, olga: 1, pilar: 1, raquel: 1, rocio: 1, rosa: 1, rosario: 1,
    sandra: 1, sara: 1, susana: 1, teresa: 1, vanessa: 1, wendy: 1,
    yolanda: 1, zoe: 1, mia: 1, lia: 1, renata: 1, romina: 1, constanza: 1,
    catalina: 1, ines: 1, belen: 1, abril: 1, fatima: 1, paula: 1, carla: 1,
    karen: 1, luisa: 1, mercedes: 1, jesus: 1,
  };

  function sinAcentos(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function capitalizarPalabra(w, esParticula) {
    if (!w) return "";
    if (/^[A-Z]{2,5}$/.test(w)) return w;
    var limpia = w.toLowerCase();
    var norm = sinAcentos(limpia);
    if (esParticula && norm !== "san" && norm !== "santa" && norm !== "mc" && norm !== "mac") {
      return limpia;
    }
    return limpia
      .split("-")
      .map(function (parte) {
        return parte ? parte.charAt(0).toUpperCase() + parte.slice(1) : "";
      })
      .join("-");
  }

  /**
   * Compacta el nombre para que luzca editorial y equilibrado en el gafete:
   * - "Aarón Flores Mendoza" -> "Aarón Flores\u00A0M."
   * - "Juan Pablo Acosta Ramírez" -> "Juan Pablo Acosta\u00A0R."
   * - "Juan Pablo Acosta" -> "Juan Pablo Acosta" (dos nombres + primer apellido)
   * - "María del Carmen López Hernández" -> "María del Carmen López\u00A0H."
   */
  function compactarNombre(raw) {
    if (!raw) return "";
    var texto = String(raw).trim().replace(/\s+/g, " ");
    if (!texto) return "";

    var sufijo = "";
    var comaIdx = texto.indexOf(",");
    if (comaIdx > -1) {
      sufijo = texto.slice(comaIdx).trim();
      texto = texto.slice(0, comaIdx).trim();
    }

    var palabras = texto.split(" ").filter(Boolean);
    if (palabras.length === 1) {
      return capitalizarPalabra(palabras[0], false) + (sufijo ? " " + sufijo : "");
    }

    var bloques = [];
    var buffer = [];
    for (var i = 0; i < palabras.length; i++) {
      var p = palabras[i];
      var norm = sinAcentos(p);
      if (PARTICULAS[norm] && i < palabras.length - 1) {
        buffer.push(capitalizarPalabra(p, bloques.length > 0 || buffer.length > 0));
      } else {
        buffer.push(capitalizarPalabra(p, false));
        bloques.push({
          texto: buffer.join(" "),
          nucleo: capitalizarPalabra(p, false),
          norm: norm,
        });
        buffer = [];
      }
    }
    if (buffer.length) {
      var ult = buffer[buffer.length - 1];
      bloques.push({
        texto: buffer.join(" "),
        nucleo: capitalizarPalabra(ult, false),
        norm: sinAcentos(ult),
      });
    }

    if (bloques.length === 1) {
      return bloques[0].texto + (sufijo ? " " + sufijo : "");
    }

    if (bloques.length === 2) {
      return bloques[0].texto + " " + bloques[1].texto + (sufijo ? " " + sufijo : "");
    }

    if (bloques.length === 3) {
      var n0 = bloques[0].norm, n1 = bloques[1].norm;
      var esCompuesto =
        (NOMBRES_PILA_M[n0] && SEGUNDOS_NOMBRES_M[n1]) ||
        (NOMBRES_PILA_F[n0] && SEGUNDOS_NOMBRES_F[n1]);
      if (esCompuesto) {
        return bloques[0].texto + " " + bloques[1].texto + " " + bloques[2].texto + (sufijo ? " " + sufijo : "");
      }
      var ini3 = bloques[2].nucleo.charAt(0).toUpperCase();
      return bloques[0].texto + " " + bloques[1].texto + "\u00A0" + (ini3 ? ini3 + "." : "") + (sufijo ? " " + sufijo : "");
    }

    var penultimo = bloques[bloques.length - 2];
    var ultimo = bloques[bloques.length - 1];
    var iniUlt = ultimo.nucleo.charAt(0).toUpperCase();
    return (
      bloques[0].texto +
      " " +
      bloques[1].texto +
      " " +
      penultimo.texto +
      "\u00A0" +
      (iniUlt ? iniUlt + "." : "") +
      (sufijo ? " " + sufijo : "")
    );
  }

  /** Calcula el tamaño de fuente óptimo (en em) según longitud y palabra más larga. */
  function escalaNombre(compacto, modo) {
    var s = String(compacto || "").trim();
    var len = s.length;
    var maxPalabra = 0;
    s.split(/\s+/).forEach(function (w) { if (w.length > maxPalabra) maxPalabra = w.length; });
    if (modo === "movil") {
      if (!len || len <= 13) return "14.5px";
      if (len <= 17 && maxPalabra <= 10) return "13px";
      if (len <= 22) return "11.8px";
      return "10.8px";
    }
    if (!len || len <= 13) return "1.68em";
    if (len <= 16 && maxPalabra <= 10) return "1.52em";
    if (len <= 21 && maxPalabra <= 11) return "1.38em";
    if (len <= 26) return "1.26em";
    return "1.14em";
  }

  function pedirToken() {
    token = fetch("/api/registro/token", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
      .then(function (d) { return d.token; });
    token.catch(function () { token = null; });
    return token;
  }

  function post(url, cuerpo) {
    return fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) { d.status = r.status; return d; });
      });
  }

  /** Reintenta una vez con un token nuevo si el anterior caducó. */
  function conToken(url, cuerpo) {
    return (token || pedirToken()).then(function (t) {
      return post(url, Object.assign({}, cuerpo, { token: t })).then(function (d) {
        if (d.token !== "renovar") return d;
        return pedirToken().then(function (n) { return post(url, Object.assign({}, cuerpo, { token: n })); });
      });
    });
  }

  function subirCv(archivo) {
    return conToken("/api/eventos/n-night/cv", {}).then(function (d) {
      if (!d.url) throw new Error(d.error || "No pudimos subir tu CV. Intenta de nuevo o continúa sin él.");
      return fetch(d.url, { method: "POST", headers: { "Content-Type": "application/pdf" }, body: archivo })
        .then(function (r) { if (!r.ok) throw new Error("No pudimos subir tu CV. Intenta de nuevo o continúa sin él."); return r.json(); })
        .then(function (s) { return s.storageId; });
    });
  }

  /** Envía los datos del registro (discriminados por `tipo`) y sube el CV si se adjuntó. */
  function enviar(datos, cv) {
    var cvId = cv ? subirCv(cv) : Promise.resolve(undefined);
    return cvId.then(function (id) {
      var cuerpo = Object.assign({}, datos);
      if (id) cuerpo.cvStorageId = id;
      return conToken("/api/eventos/n-night/registro", cuerpo);
    }).then(function (d) {
      if (d.ok) return d;
      throw new Error(d.error || "No pudimos guardar tu registro. Intenta de nuevo.");
    }, function (e) {
      throw e instanceof Error && e.message ? e : new Error("Sin conexión. Revisa tu internet e intenta de nuevo.");
    });
  }

  function pago(p, tipo) {
    if (tipo && tipo !== "estudiante") {
      return {
        valor: "Cortesía",
        nota: "Tu acceso es cortesía de Alpha. Solo muestra tu QR en la entrada.",
        corto: "Cortesía",
      };
    }
    var monto = "$" + ((p && p.montoMxn) || 70) + " MXN";
    if (p && p.estado === "pagado") return { valor: "Pagado", nota: "Tu cuota ya está pagada. Solo muestra tu QR en la entrada.", corto: "Pagado" };
    if (p && p.metodo === "stripe") return { valor: monto, nota: "Tu pago en línea no se ha confirmado. Si no se completa, pagas " + monto + " en efectivo en la entrada.", corto: monto };
    return { valor: monto + " efectivo", nota: "Lleva " + monto + " en efectivo. Se cobran en la entrada cuando escaneamos tu QR.", corto: monto };
  }

  function guardar(boleto) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(boleto));
      localStorage.removeItem(CLAVE_SOLICITUD);
    } catch (e) {}
  }
  function leer() {
    try { var b = JSON.parse(localStorage.getItem(CLAVE) || "null"); return b && b.qr && b.nombre ? b : null; } catch (e) { return null; }
  }
  function olvidar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

  function guardarSolicitud(solicitud) {
    try {
      localStorage.setItem(CLAVE_SOLICITUD, JSON.stringify(solicitud));
    } catch (e) {}
  }
  function leerSolicitud() {
    try {
      var s = JSON.parse(localStorage.getItem(CLAVE_SOLICITUD) || "null");
      return s && s.nombre && s.tipo ? s : null;
    } catch (e) { return null; }
  }
  function olvidarSolicitud() {
    try { localStorage.removeItem(CLAVE_SOLICITUD); } catch (e) {}
  }

  function imagen(src) {
    return new Promise(function (ok, mal) { var i = new Image(); i.onload = function () { ok(i); }; i.onerror = mal; i.src = src; });
  }

  function lineas(ctx, texto, ancho) {
    var palabras = texto.split(/\s+/), out = [], l = "";
    palabras.forEach(function (p) { var t = l ? l + " " + p : p; if (ctx.measureText(t).width > ancho && l) { out.push(l); l = p; } else l = t; });
    if (l) out.push(l);
    return out;
  }

  /** Dibuja el boleto en un PNG y lo descarga. */
  function descargar(boleto) {
    var W = 1080, H = 1680, pad = 84;
    var c = document.createElement("canvas"); c.width = W; c.height = H;
    var x = c.getContext("2d");
    var fd = '"Poppins", "Montserrat", system-ui, sans-serif', fb = '"Montserrat", system-ui, sans-serif';
    var listo = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return listo.then(function () {
      return Promise.all([imagen(boleto.qr), imagen("/n-night/assets/alpha-mark-white.png").catch(function () { return null; })]);
    }).then(function (img) {
      var qr = img[0], logo = img[1], p = pago(boleto.pago, boleto.tipo);
      var g = GAFETES[boleto.tipo] || GAFETES.estudiante;
      var nombreGafete = compactarNombre(boleto.nombre).replace(/\u00A0/g, " ");
      x.fillStyle = "#0c2149"; x.fillRect(0, 0, W, H);
      x.fillStyle = "#ffffff"; x.fillRect(48, 48, W - 96, H - 96);
      x.fillStyle = g.hex; x.fillRect(48, 48, W - 96, 150);
      x.fillStyle = "#ffffff"; x.font = "700 46px " + fd; x.textBaseline = "middle";
      x.fillText("NETWORKING NIGHT", pad + 10, 123);
      if (logo) { var lh = 58, lw = logo.width * lh / logo.height; x.drawImage(logo, W - pad - 10 - lw, 123 - lh / 2, lw, lh); }

      x.textBaseline = "alphabetic";
      x.fillStyle = g.hex; x.font = "700 26px " + fb; x.fillText(g.rol, pad + 10, 290);
      x.fillStyle = "#0d2140"; x.font = "600 72px " + fd;
      var y = 370;
      lineas(x, nombreGafete, W - 2 * pad - 20).slice(0, 2).forEach(function (l) { x.fillText(l, pad + 10, y); y += 78; });
      if (boleto.sub) { x.fillStyle = "#4b5b73"; x.font = "600 30px " + fb; x.fillText(boleto.sub, pad + 10, y - 16); y += 30; }

      var q = 560, qy = Math.max(y + 10, 560);
      x.drawImage(qr, (W - q) / 2, qy, q, q);
      x.fillStyle = "#6b7c93"; x.font = "500 26px " + fb; x.textAlign = "center";
      x.fillText("Preséntalo en la entrada", W / 2, qy + q + 44);
      x.textAlign = "left";

      var dy = qy + q + 96;
      x.strokeStyle = "#c9d4e3"; x.lineWidth = 3; x.setLineDash([14, 12]);
      x.beginPath(); x.moveTo(pad, dy); x.lineTo(W - pad, dy); x.stroke(); x.setLineDash([]);
      var celdas = [["FECHA", "Jue 5 nov 2026"], ["HORA", "5:00 a 7:30 p.m."], ["LUGAR", "Claustro CEDETEC"], ["ACCESO", p.valor]];
      celdas.forEach(function (cel, i) {
        var cx = pad + 10 + (i % 2) * ((W - 2 * pad) / 2), cy = dy + 70 + Math.floor(i / 2) * 120;
        x.fillStyle = "#6b7c93"; x.font = "700 22px " + fb; x.fillText(cel[0], cx, cy);
        x.fillStyle = "#0d2140"; x.font = "700 36px " + fd; x.fillText(cel[1], cx, cy + 48);
      });
      x.fillStyle = "#6b7c93"; x.font = "700 22px " + fb; x.fillText("ADMITE 1 · BOLETO PERSONAL", pad + 10, H - 92);
      x.fillStyle = "#194270"; x.font = "700 28px " + fd; x.textAlign = "right"; x.fillText(boleto.folio || "", W - pad - 10, H - 92);
      x.textAlign = "left";

      return new Promise(function (ok) { c.toBlob(ok, "image/png"); });
    }).then(function (blob) {
      var url = URL.createObjectURL(blob), a = document.createElement("a");
      a.href = url; a.download = "boleto-networking-night.png";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    });
  }

  var api = {
    calendario: CALENDARIO,
    preparar: function () { if (!token) pedirToken(); },
    enviar: enviar,
    pago: pago,
    guardar: guardar,
    leer: leer,
    olvidar: olvidar,
    guardarSolicitud: guardarSolicitud,
    leerSolicitud: leerSolicitud,
    olvidarSolicitud: olvidarSolicitud,
    descargar: descargar,
    compactarNombre: compactarNombre,
    escalaNombre: escalaNombre,
    GAFETES: GAFETES,
  };
  window.NNRegistro = api;
  window.AlphaNN = api;
})();
