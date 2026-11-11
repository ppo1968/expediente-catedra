// Acceso con clave. Todo se descifra en el navegador: el servidor solo guarda contenido ilegible.
(function () {
  const $ = (s) => document.querySelector(s);
  const ENC = new TextEncoder(), DEC = new TextDecoder();
  let llave = null, conf = null;
  const hex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  const traer = async (u) => { const r = await fetch(u, { cache: 'no-cache' }); if (!r.ok) throw new Error('red'); return r.arrayBuffer(); };
  const abrir = async (buf) => {
    const b = new Uint8Array(buf);
    return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12) }, llave, b.subarray(12));
  };
  async function derivar(clave) {
    const base = await crypto.subtle.importKey('raw', ENC.encode(clave), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: hex(conf.sal), iterations: conf.iter }, base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  }
  const cache = new Map();
  // Abre un PDF: lo descifra y lo muestra sin pasar por ningún servidor.
  async function pdf(rel) {
    const m = window.EXPEDIENTE.mapa[rel];
    if (!m) throw new Error('falta');
    if (m.url) return { url: m.url };
    if (m.grande) return { grande: true };
    if (cache.has(rel)) return { blob: cache.get(rel) };
    const datos = await abrir(await traer('d/' + m.id + '.bin'));
    const u = URL.createObjectURL(new Blob([datos], { type: 'application/pdf' }));
    cache.set(rel, u);
    if (cache.size > 12) { const [k, v] = cache.entries().next().value; URL.revokeObjectURL(v); cache.delete(k); }
    return { blob: u };
  }
  function cargar(src) {
    return new Promise((ok, mal) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = mal; document.body.append(s); });
  }
  async function entrar(clave) {
    llave = await derivar(clave);
    let datos;
    try { datos = JSON.parse(DEC.decode(await abrir(await traer('e.bin')))); } catch (e) {
      if (e && e.message === 'red') throw new Error('No se ha podido conectar. Comprueba la conexión a internet.');
      throw new Error('Clave incorrecta.');
    }
    window.EXPEDIENTE = datos;
    window.CIFRADO = { pdf };
    // La clave no se guarda: solo la llave derivada, y solo en esta pestaña.
    try { sessionStorage.setItem('llave', JSON.stringify(await crypto.subtle.exportKey('jwk', llave))); } catch (e) { /* sin almacenamiento */ }
    $('#acceso').hidden = true;
    await cargar('arbol.js');
    await cargar('app.js');
  }
  // El ojo muestra u oculta la clave mientras se escribe.
  const bVer = $('#acVer');
  if (bVer) bVer.addEventListener('click', () => {
    const i = $('#acClave'), ver = i.type === 'password';
    i.type = ver ? 'text' : 'password';
    bVer.setAttribute('aria-pressed', String(ver));
    bVer.setAttribute('aria-label', ver ? 'Ocultar la clave' : 'Mostrar la clave');
    bVer.title = ver ? 'Ocultar la clave' : 'Mostrar la clave';
    i.focus();
  });
  document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
  (async function () {
    try { conf = JSON.parse(DEC.decode(await traer('cifrado.json'))); } catch (e) { $('#acMsg').textContent = 'No se ha podido conectar. Comprueba la conexión a internet.'; return; }
    if (!window.crypto || !crypto.subtle) { $('#acMsg').textContent = 'Este navegador no puede abrir el expediente. Usa Chrome, Edge, Firefox o Safari actualizados.'; return; }
    // Recargar la página no vuelve a pedir la clave en la misma pestaña.
    try {
      const j = sessionStorage.getItem('llave');
      if (j) {
        llave = await crypto.subtle.importKey('jwk', JSON.parse(j), { name: 'AES-GCM' }, true, ['decrypt']);
        window.EXPEDIENTE = JSON.parse(DEC.decode(await abrir(await traer('e.bin'))));
        window.CIFRADO = { pdf };
        $('#acceso').hidden = true;
        await cargar('arbol.js'); await cargar('app.js');
        return;
      }
    } catch (e) { try { sessionStorage.removeItem('llave'); } catch (x) { /* nada */ } $('#acceso').hidden = false; }
    $('#acForm').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const b = $('#acEntrar'), m = $('#acMsg');
      b.disabled = true; m.className = 'ok'; m.textContent = 'Comprobando…';
      try { await entrar($('#acClave').value); } catch (e) { m.className = ''; m.textContent = e.message || 'Clave incorrecta.'; b.disabled = false; $('#acClave').select(); }
    });
  })();
})();
