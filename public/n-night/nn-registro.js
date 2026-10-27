/* Networking Night: registro, boleto descargable y calendario. Lo usan la página móvil y la de escritorio. */
(function () {
  "use strict";

  var CALENDARIO =
    "https://calendar.google.com/calendar/render?action=TEMPLATE&text=Networking%20Night%20%C2%B7%20Alpha&dates=20261105T230000Z%2F20261106T030000Z&details=Networking%20Night%20de%20Alpha.%20Registro%20desde%20las%204%3A40%20p.m.%20Business%20casual.%20Lleva%20tu%20boleto%20con%20c%C3%B3digo%20QR%20y%20%2470%20MXN%20en%20efectivo.&location=Claustro%20CEDETEC%2C%20Tecnol%C3%B3gico%20de%20Monterrey%20Campus%20Ciudad%20de%20M%C3%A9xico&ctz=America%2FMexico_City";
  var CLAVE = "alpha-nn-boleto";
  var token = null;

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

  /** datos: nombre, correo, matricula, carrera, semestre, intereses, habilidades, metodoPago, consentimiento, sitio_web. */
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

  function pago(p) {
    var monto = "$" + ((p && p.montoMxn) || 70) + " MXN";
    if (p && p.estado === "pagado") return { valor: "Pagado", nota: "Tu cuota ya está pagada. Solo muestra tu QR en la entrada.", corto: "Pagado" };
    if (p && p.metodo === "stripe") return { valor: monto, nota: "Tu pago en línea no se ha confirmado. Si no se completa, pagas " + monto + " en efectivo en la entrada.", corto: monto };
    return { valor: monto + " efectivo", nota: "Lleva " + monto + " en efectivo. Se cobran en la entrada cuando escaneamos tu QR.", corto: monto };
  }

  function guardar(boleto) { try { localStorage.setItem(CLAVE, JSON.stringify(boleto)); } catch (e) {} }
  function leer() {
    try { var b = JSON.parse(localStorage.getItem(CLAVE) || "null"); return b && b.qr && b.nombre ? b : null; } catch (e) { return null; }
  }
  function olvidar() { try { localStorage.removeItem(CLAVE); } catch (e) {} }

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
      var qr = img[0], logo = img[1], p = pago(boleto.pago);
      x.fillStyle = "#0c2149"; x.fillRect(0, 0, W, H);
      x.fillStyle = "#ffffff"; x.fillRect(48, 48, W - 96, H - 96);
      x.fillStyle = "#0066ff"; x.fillRect(48, 48, W - 96, 150);
      x.fillStyle = "#ffffff"; x.font = "700 46px " + fd; x.textBaseline = "middle";
      x.fillText("NETWORKING NIGHT", pad + 10, 123);
      if (logo) { var lh = 58, lw = logo.width * lh / logo.height; x.drawImage(logo, W - pad - 10 - lw, 123 - lh / 2, lw, lh); }

      x.textBaseline = "alphabetic";
      x.fillStyle = "#0066ff"; x.font = "700 26px " + fb; x.fillText("ASISTENTE", pad + 10, 290);
      x.fillStyle = "#0d2140"; x.font = "700 76px " + fd;
      var y = 370;
      lineas(x, boleto.nombre.toUpperCase(), W - 2 * pad - 20).slice(0, 3).forEach(function (l) { x.fillText(l, pad + 10, y); y += 80; });
      if (boleto.sub) { x.fillStyle = "#4b5b73"; x.font = "600 30px " + fb; x.fillText(boleto.sub, pad + 10, y - 18); y += 30; }

      var q = 560, qy = Math.max(y + 10, 560);
      x.drawImage(qr, (W - q) / 2, qy, q, q);
      x.fillStyle = "#6b7c93"; x.font = "500 26px " + fb; x.textAlign = "center";
      x.fillText("Preséntalo en la entrada", W / 2, qy + q + 44);
      x.textAlign = "left";

      var dy = qy + q + 96;
      x.strokeStyle = "#c9d4e3"; x.lineWidth = 3; x.setLineDash([14, 12]);
      x.beginPath(); x.moveTo(pad, dy); x.lineTo(W - pad, dy); x.stroke(); x.setLineDash([]);
      var celdas = [["FECHA", "Jue 5 nov 2026"], ["HORA", "5:00 a 9:00 p.m."], ["LUGAR", "Claustro CEDETEC"], ["CUOTA", p.valor]];
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

  window.NNRegistro = {
    calendario: CALENDARIO,
    preparar: function () { if (!token) pedirToken(); },
    enviar: enviar,
    pago: pago,
    guardar: guardar,
    leer: leer,
    olvidar: olvidar,
    descargar: descargar,
  };
})();
