// Menú desplegable, méritos, PDF al lado y edición de texto y PDF. Todo se guarda de verdad.
(async function () {
  const INICIAL = window.ARBOL.menu;
  const APD = (c) => window.ARBOL.flatMap((g) => g.aps).find((a) => a.cod === c) || {};
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const copia = (x) => JSON.parse(JSON.stringify(x));
  // Con window.api es la aplicación de trabajo; sin ella, una versión generada: solo consulta.
  const CONSULTA = !window.api;
  let P = CONSULTA ? window.EXPEDIENTE : await window.api.leer();
  let MENU = P.menu || copia(INICIAL);
  { const aj = MENU.find((x) => x[0] === 'Ajustes'), base = (INICIAL.find((x) => x[0] === 'Ajustes') || [])[1] || []; if (aj && aj[1]) base.forEach((o, i) => { if (!aj[1].some((q) => q[1] === o[1])) aj[1].splice(Math.min(i, aj[1].length), 0, o.slice()); }); }
  let quitando = false, generando = false, trabajo = !CONSULTA, filtroDocs = '', suelto = null, actual = null, sel = null, selSha = null, editando = false, abiertoB = 3, pilaMenu = [];
  const urlDe = (r) => (/^(data|blob):/.test(r) ? r : /^[A-Za-z]:\//.test(r) ? 'file:///' + r.split('/').map((x, i) => (i ? encodeURIComponent(x) : x)).join('/') : (P.baseUrl || '') + r.split('/').map(encodeURIComponent).join('/'));
  const buscar = (id) => P.datos.meritos.find((m) => m.id === id);
  const nombreDe = (c) => { for (const [t, l, cd] of MENU) { if (cd === c) return t; for (const [k, n] of l || []) if (k === c) return n; } const v = String(c || '').startsWith('v:') && (window.ARBOL.vistas || {})[String(c).slice(2)]; return c === 'SC' ? 'Sin clasificar' : v ? v.nom : APD(c).nom || c; };

  function aviso(t, o = {}) {
    const e = $('#toast');
    e.innerHTML = `<span>${esc(t)}</span>${o.des ? '<button id="tD">Deshacer</button>' : ''}`;
    e.classList.toggle('mal', !!o.mal);
    e.classList.add('ver');
    const b = $('#tD'); if (b) b.onclick = deshacer;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => e.classList.remove('ver'), o.mal ? 7000 : 4000);
  }
  // Las operaciones van siempre en orden: guardar un texto al salir y pulsar Deshacer no se cruzan.
  let cola = Promise.resolve();
  const enCola = (fn) => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };
  const op = (nombre, datos, texto) => enCola(() => opAhora(nombre, datos, texto));
  async function opAhora(nombre, datos, texto) {
    const docs = new Map(P.datos.meritos.map((m) => [m.id, m.doc]));
    const r = await window.api.operar(nombre, datos);
    if (r.error) { aviso(r.error, { mal: true }); pintarLista(); return null; }
    if (r.cancelado) return null;
    P = r.paquete;
    pintarCab(); pintarMenu(); marcarActivo(); pintarLista(); pintarVisor();
    P.datos.meritos.filter((m) => m.doc && docs.has(m.id) && docs.get(m.id) !== m.doc).forEach((m) => { const c = $(`.merito[data-id="${m.id}"] .doc`); if (c) c.classList.add('cambio'); });
    if (texto) aviso(texto, { des: true });
    return r;
  }
  const deshacer = () => enCola(async () => {
    const r = await window.api.operar('deshacer', {});
    if (r.error) { aviso(r.error, { mal: true }); return; }
    P = r.paquete;
    if (sel && !buscar(sel)) { sel = null; selSha = null; }
    pintarCab(); pintarMenu(); marcarActivo(); pintarLista(); pintarVisor();
    aviso('Deshecho');
  });
  // Los enlaces se pulsan directamente dentro del texto.
  const URLRE = /https?:\/\/[^\s<>"')]+/g;
  const limpiaUrl = (u) => u.replace(/[.,;:]+$/, '');
  function conEnlaces(t) {
    let h = '', i = 0;
    for (const x of String(t).matchAll(URLRE)) {
      const u = limpiaUrl(x[0]);
      h += esc(t.slice(i, x.index)) + `<a href="#" data-url="${esc(u)}" title="Abrir enlace">${esc(u)}</a>`;
      i = x.index + u.length;
    }
    return h + esc(t.slice(i));
  }
  const tel = (p) => /^Teléfono/i.test(p.e);
  const ligaDe = (p) => {
    if (p.e === 'DOI' && p.v && !/^https?:/.test(p.v)) return `https://doi.org/${p.v.trim()}`;
    if (p.e === 'ORCID' && /^\d{4}-/.test(p.v)) return `https://orcid.org/${p.v.trim()}`;
    return null;
  };
  const valorHtml = (p) => { const u = ligaDe(p); return u ? `<a href="#" data-url="${esc(u)}" title="Abrir enlace">${esc(p.v)}</a>` : conEnlaces(p.v); };
  const publico = (m) => !m.nota && !m.privado && m.cod !== 'SC';
  // Un apartado del CVN muestra solo lo que no se ha llevado a una opción del menú (v0.17).
  const entradas = (c) => P.datos.meritos.filter((m) => m.cod === c && !m.vista && (trabajo || publico(m)));
  // v0.17: opciones del menú según las carpetas de E: («v:tesis», «v:ponencias»…). Agrupan méritos por su «vista».
  const VISTAS = window.ARBOL.vistas || {};
  const vistaDeCod = (c) => (String(c || '').startsWith('v:') ? String(c).slice(2) : null);
  const todasDe = (c) => P.datos.meritos.filter((m) => m.cod === c && (trabajo || publico(m))); // el apartado del CVN entero
  const deVista6_2 = () => (actual && actual.vista ? entradasMenu(actual.cm) : todasDe('6.2')); // Artículos, o Libros y capítulos
  const entradasMenu = (c) => { const v = vistaDeCod(c); return v ? P.datos.meritos.filter((m) => m.vista === v && (trabajo || publico(m))) : entradas(c); };
  const marcarActivo = () => { if (!actual) return; const it = items.find((x) => x.firstElementChild.textContent === actual.bloque); if (it) it.classList.add('activo'); };
  function pintarCab() {
    document.body.classList.toggle('vert', (P.ajustes.menu || 'horizontal') === 'vertical');
    if (CONSULTA) { $('.modo').hidden = true; $('#bDes').hidden = true; $('#bEd').hidden = true; $('#bSC').hidden = true; document.body.classList.add('tribunal'); return; }
    const n = P.datos.meritos.filter((m) => m.cod === 'SC').length + P.datos.sin_merito.length;
    pintarAvisoNuevos();
    $('#bSC').hidden = !n || !trabajo;
    $('#bDes').hidden = !trabajo;
    $('#bEd').hidden = !trabajo;
    $('#mT').classList.toggle('on', trabajo);
    $('#mV').classList.toggle('on', !trabajo);
    $('#bSC').textContent = `Sin clasificar (${n})`;
    const npv = P.datos.meritos.filter((m) => m.nuevo).length;
    $('#bPV').hidden = !npv || !trabajo;
    $('#bPV').textContent = `Por verificar (${npv})`;
    $('#bDes').disabled = !P.deshacer;
  }
  // ---------- Menú ----------
  let items = [], panelT = null;
  // Con el menú horizontal y pantalla ancha, las opciones salen siempre en un panel fijo a la derecha.
  const enPanel = () => false; // v0.11: vuelven los desplegables; la navegación se completa con la línea de abajo
  const LARGO = {};
  Object.entries(window.ARBOL.corto || {}).forEach(([l, c]) => { if (!LARGO[c]) LARGO[c] = l; }); // Investigación: «Experiencia científica…» (el bloque 6 va dentro)
  const itemDe = (t) => items.find((x) => x.firstElementChild.textContent === t);
  function pintarPanel() {
    const pn = $('#panelMenu');
    const it = panelT != null ? itemDe(panelT) : null;
    const d = it && $('.desp', it);
    items.forEach((x) => x.classList.toggle('enpanel', !!it && x === it));
    if (!enPanel() || !d) { pn.hidden = true; pn.innerHTML = ''; return; }
    pn.hidden = false;
    pn.innerHTML = `<h2 class="pm-t">${esc(panelT)}</h2><div class="pm-l">${d.innerHTML}</div>`;
    $$('.pm-l button', pn).forEach((o) => {
      o.classList.toggle('on', !!actual && actual.bloque === panelT && actual.opcion === o.dataset.n);
      o.onclick = (e) => { e.stopPropagation(); salirEditor(); elegir(itemDe(panelT), o.dataset.c, o.dataset.n); };
    });
  }
  window.addEventListener('resize', () => pintarPanel());
  const cerrar = () => { items.forEach((x) => { x.classList.remove('abierto'); x.firstElementChild.setAttribute('aria-expanded', 'false'); }); const p = $('#lnPop'); if (p) p.hidden = true; };
  function elegir(bloque, c, n) {
    const cm = c, vista = vistaDeCod(c);
    if (vista) c = (VISTAS[vista] || {}).cod || c;
    items.forEach((x) => x.classList.remove('activo'));
    if (bloque) bloque.classList.add('activo');
    const tb = bloque ? bloque.firstElementChild.textContent : '';
    const sub = APD(c).sub;
    const gr = window.ARBOL.find((g) => !g.fuera && g.aps.some((a) => a.cod === c));
    const tl = gr && tb === 'Investigación' ? gr.gr : LARGO[tb] || tb;
    $('#sel1').textContent = !bloque ? 'Por decidir' : vista ? tb : tb === n ? 'Currículum vitae normalizado' : sub ? `${tl} › ${sub}` : tl;
    $('#sel2').textContent = tb === 'Ajustes' ? 'Ajustes' : n;
    quitando = false;
    actual = { c, cm, vista, opcion: n, bloque: tb, ficha: c === '1', inicio: tb === 'Inicio', tray: c === 'T' };
    if (c === '6.2') bibAnimar = true;
    if (c === 'T') trAnimar = true;
    clearTimeout(hT);
    $('#lista').classList.toggle('esinicio', !!actual.inicio);
    panelT = bloque && bloque.classList.contains('tiene') ? tb : null;
    pintarPanel();
    sel = null; selSha = null; suelto = null; filtroDocs = '';
    $('#lista').scrollTop = 0;
    pintarLista(); pintarVisor(); pintarLinea();
  }
  function pintarMenu() {
    const nav = $('#menu');
    const oc = P.datos.ocultos || [];
    const hay = (c) => !(VISTAS[vistaDeCod(c)] || {}).trabajo && entradasMenu(c).some(publico);
    // Un título intermedio solo se muestra si queda algo debajo.
    const sinTitulosVacios = (l) => l.filter((o, i) => o[2] !== 'h' || (l[i + 1] && l[i + 1][2] !== 'h'));
    const SINOC = MENU.map(([t, l, cd]) => [t, l && sinTitulosVacios(l.filter(([c]) => !c || !oc.includes(c))), cd]).filter(([, l]) => l === null || l.length || !oc.length);
    // En la aplicación, Ajustes se ve siempre, también en la vista Tribunal. En la versión del tribunal, nunca.
    const AJ = CONSULTA ? null : SINOC.find(([t]) => t === 'Ajustes');
    const VIS = trabajo ? SINOC : [...SINOC.map(([t, l, cd]) => [t, l && sinTitulosVacios(l.filter((o) => o[2] === 'h' || hay(o[0]))), cd]).filter(([t, l, cd]) => t !== 'Ajustes' && (l ? l.length : !cd || cd === 'T' || hay(cd))), ...(AJ ? [AJ] : [])];
    nav.innerHTML = VIS.map(([t, l, cd], i) => {
      const con = l && l.length;
      return `<div class="item ${con ? 'tiene' : ''} ${i >= VIS.length - 3 ? 'dcha' : ''}" data-i="${i}" data-cd="${esc(cd || '')}"><button aria-haspopup="${con ? 'true' : 'false'}" aria-expanded="false">${esc(t)}</button>${con ? `<div class="desp sinc">${l.map((o) => (o[2] === 'h' ? `<div class="dh">${esc(o[1])}</div>` : `<button class="${APD(o[0]).sub ? 'dentro' : ''}" data-c="${esc(o[0])}" data-n="${esc(o[1])}"><span>${esc(o[1])}</span></button>`)).join('')}</div>` : ''}</div>`;
    }).join('');
    items = $$('.item', nav);
    items.forEach((it) => {
      const b = it.firstElementChild;
      it.addEventListener('mouseenter', () => { if (!it.classList.contains('abierto')) cerrar(); });
      it.addEventListener('mouseleave', () => { if (matchMedia('(hover:hover)').matches) { cerrar(); b.blur(); } });
      b.onclick = (e) => {
        e.stopPropagation();
        if (!it.classList.contains('tiene')) { cerrar(); salirEditor(); elegir(it, it.dataset.cd, b.textContent); return; }
        if (enPanel()) { cerrar(); panelT = b.textContent; pintarPanel(); return; }
        if (matchMedia('(hover:hover)').matches) return;
        const on = it.classList.contains('abierto');
        cerrar();
        if (!on) { it.classList.add('abierto'); b.setAttribute('aria-expanded', 'true'); }
      };
      $$('.desp button', it).forEach((o) => {
        o.onclick = (e) => { e.stopPropagation(); cerrar(); o.blur(); b.blur(); salirEditor(); elegir(it, o.dataset.c, o.dataset.n); };
      });
    });
    pintarPanel();
    pintarLinea();
  }
  // ---------- Línea de secciones (abajo) ----------
  // Va sincronizada con el menú: los dos marcan dónde estás y desde los dos se elige.
  function pintarLinea() {
    const L = $('#linea');
    if (!L) return;
    const pts = items.filter((it) => it.firstElementChild.textContent !== 'Ajustes');
    const cuenta = (it) => {
      const cods = $$('.desp button[data-c]', it).map((b) => b.dataset.c);
      return cods.reduce((s, c) => s + entradasMenu(c).length, 0);
    };
    const k0 = pts.findIndex((it) => actual && actual.bloque === it.firstElementChild.textContent);
    L.innerHTML = `<div class="ln-r">${pts.map((it, k) => {
      const t = it.firstElementChild.textContent, n = cuenta(it);
      return `<button class="ln-p ${k === k0 ? 'on' : ''} ${k0 >= 0 && k < k0 ? 'pas' : ''}" data-k="${k}" aria-current="${k === k0 ? 'true' : 'false'}"><i></i><b>${esc(t)}</b><small>${n ? n.toLocaleString('es-ES') + ' méritos' : t === 'Trayectoria' ? 'año a año' : t === 'Inicio' ? 'portada' : ''}</small></button>`;
    }).join('')}</div><div class="ln-pop" id="lnPop" hidden></div>`;
    const pop = $('#lnPop');
    pop.onclick = (e) => e.stopPropagation();
    $$('.ln-p', L).forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const it = pts[+b.dataset.k], d = $('.desp', it);
        items.forEach((x) => x.classList.remove('abierto'));
        if (!d) { pop.hidden = true; salirEditor(); elegir(it, it.dataset.cd, it.firstElementChild.textContent); return; }
        if (!pop.hidden && pop.dataset.k === b.dataset.k) { pop.hidden = true; return; }
        pop.dataset.k = b.dataset.k;
        pop.innerHTML = `<h3>${esc(LARGO[it.firstElementChild.textContent] || it.firstElementChild.textContent)}</h3><div class="ln-ops">${d.innerHTML}</div>`;
        pop.hidden = false;
        const x = b.offsetLeft + b.offsetWidth / 2 - pop.offsetWidth / 2;
        pop.style.left = Math.max(8, Math.min(x, L.clientWidth - pop.offsetWidth - 8)) + 'px';
        $$('button[data-c]', pop).forEach((o) => {
          o.classList.toggle('on', !!actual && (actual.cm || actual.c) === o.dataset.c && actual.opcion === o.dataset.n);
          o.onclick = (ev) => { ev.stopPropagation(); pop.hidden = true; salirEditor(); elegir(it, o.dataset.c, o.dataset.n); };
        });
      };
    });
  }
  // ---------- Méritos ----------
  function htmlPdfs(m) {
    if (m.nota || m.dato) return '';
    const lista = trabajo ? m.pdfs : m.pdfs.filter((p) => p.nivel === 'alta');
    const f = lista.map((p, k) => {
      const rev = p.nivel !== 'alta';
      const nom = rev ? 'Propuesto' : lista.length > 1 ? `PDF ${k + 1}` : 'PDF';
      const on = sel === m.id && selSha === p.sha ? 'on' : '';
      return `<span class="chip ${rev ? 'rev' : ''} ${on}"><button class="abre" data-ver="${esc(p.sha)}" title="Ver este PDF">${nom}</button>${trabajo ? `${rev ? `<button class="acep" data-ok="${esc(p.sha)}" title="Sí, es su justificante">Aceptar</button><button class="rech" data-qui="${esc(p.sha)}" title="No es su justificante">Rechazar</button>` : `<button class="ex" data-cam="${esc(p.sha)}" title="Cambiar por otro PDF">Cambiar</button><button class="ex" data-qui="${esc(p.sha)}" title="Quitar este PDF">Quitar</button>`}` : ''}</span>`;
    }).join('');
    const mas = trabajo ? `<button class="chip busj" data-busj>Buscar justificante</button><button class="chip nuevo" data-ana>${m.pdfs.length ? '+ PDF' : '+ Añadir PDF'}</button>` : '';
    return f || mas ? `<div class="pdfs">${f}${mas}</div>` : '';
  }
  // Cada entrada se escribe como en el CVN: número y filas «Etiqueta: valor», a una o dos columnas.
  function htmlCelda(p, f, c) {
    const ed = trabajo ? 'ed' : '';
    return `<span class="cel">${p.e ? `<b class="${ed}" data-f="${f}" data-c="${c}" data-k="e">${esc(p.e)}</b><i>:</i> ` : ''}<span class="${ed} val" data-f="${f}" data-c="${c}" data-k="v">${valorHtml(p)}</span></span>`;
  }
  function htmlFilas(m) {
    return m.filas.map((r, f) => {
      const vis = r.map((p, c) => [p, c]).filter(([p]) => trabajo || (!tel(p) && !/x{3,}/i.test(p.v)));
      if (!vis.length) return '';
      // Si un texto es largo, cada dato ocupa todo el ancho de la ficha en vez de ir a dos columnas.
      if (vis.length > 1 && vis.some(([p]) => String(p.v || '').length > 90)) {
        return vis.map(([p, c], k) => `<div class="fc">${htmlCelda(p, f, c)}${trabajo && m.filas.length > 1 && k === 0 ? `<button class="xf" data-xf="${f}" title="Quitar esta fila" aria-label="Quitar esta fila">×</button>` : ''}</div>`).join('');
      }
      return `<div class="fc ${vis.length > 1 ? 'par' : ''} ${vis[0][0].e ? '' : 'parr'}">${vis.map(([p, c]) => htmlCelda(p, f, c)).join('')}${trabajo && m.filas.length > 1 ? `<button class="xf" data-xf="${f}" title="Quitar esta fila" aria-label="Quitar esta fila">×</button>` : ''}</div>`;
    }).join('');
  }
  function htmlMerito(m) {
    const a = APD(m.cod);
    const dc = m.nota ? 'Nota' : m.cod === 'SC' ? '' : a.sinNum ? '' : (numVista && numVista.get(m.id)) || m.n;
    const herr = trabajo ? `<div class="hm">
        ${m.cod !== 'SC' && !m.nota ? '<button data-sube title="Subir">↑</button><button data-baja title="Bajar">↓</button>' : ''}
        <button data-fila title="Añadir una fila">+ Fila</button>
        <select data-mov aria-label="Mover a otro apartado"><option value="">Mover a…</option>${opcionesAp()}</select>
        ${m.nuevo ? '<button class="verif" data-verif>Verificado</button>' : ''}<button data-priv>${m.privado ? 'Mostrar al tribunal' : 'Ocultar al tribunal'}</button>
        <button class="b" data-del>Eliminar</button></div>` : '';
    return `<article class="merito ${m.nota ? 'esnota' : ''} ${dc === '' ? 'sinn' : ''} ${m.privado ? 'oculto' : ''} ${sel === m.id ? 'on' : ''}" data-id="${m.id}">${dc === '' ? '' : `<div class="doc">${esc(dc)}</div>`}<div class="tx">
      ${htmlFilas(m)}
      ${m.privado && trabajo ? '<span class="tag">Oculto al tribunal</span>' : ''}
      ${m.nuevo && trabajo ? '<span class="tag tnu">Por verificar</span>' : ''}
      ${trabajo && m.notas && m.notas.length ? `<div class="nota">Nota interna: ${esc(m.notas.join(' · '))}</div>` : ''}
      ${htmlPdfs(m)}${m.cod === 'SC' && trabajo ? '<div class="fil"><button class="bs" data-busca>Buscar su documento</button></div>' : ''}
      ${herr}
    </div></article>`;
  }
  // Tabla del principio de «Cargos y actividades», igual que en el CVN. Sale de las propias entradas.
  function htmlTabla(l) {
    const val = (m, ...et) => { for (const e of et) { const p = m.filas.flat().find((x) => x.e === e); if (p) return p.v; } return ''; };
    return `<table class="tcv"><thead><tr><th></th><th>Entidad empleadora</th><th>Categoría profesional</th><th>Fecha de inicio</th></tr></thead><tbody>${l.map((m) => `<tr data-ir="${m.id}"><td>${(repartido() ? l.indexOf(m) + 1 : m.n) || ''}</td><td>${esc(val(m, 'Entidad empleadora'))}</td><td>${esc(val(m, 'Categoría profesional'))}</td><td>${esc((val(m, 'Fecha de inicio', 'Fecha de inicio-fin').match(/\d\d\/\d\d\/\d{4}/) || [''])[0])}</td></tr>`).join('')}</tbody></table>`;
  }
  // ---------- Identificación ----------
  const nombrePersona = () => {
    const v = (e) => { const m = P.datos.meritos.find((x) => x.cod === '1' && x.filas[0] && x.filas[0][0].e === e); return m ? m.filas[0][0].v : ''; };
    return `${v('Nombre')} ${v('Apellidos')}`.trim() || 'José Pino Ortega';
  };
  function htmlFoto() {
    const foto = P.datos.foto;
    return `<figure class="foto ${foto ? '' : 'sinfoto'}">${foto ? `<img src="${esc(urlDe(foto))}" alt="${esc(nombrePersona())}">` : (trabajo ? '<span>Tu foto irá aquí</span>' : '')}${trabajo ? `<figcaption><button class="bs" id="bFoto">${foto ? 'Cambiar foto' : 'Poner foto'}</button>${foto ? '<button class="bs" id="qFoto">Quitar</button>' : ''}</figcaption>` : ''}</figure>`;
  }
  function ligarFoto() {
    const bF = $('#bFoto'); if (bF) bF.onclick = () => op('foto', {}, 'Foto puesta.');
    const qF = $('#qFoto'); if (qF) qF.onclick = () => op('quitarFoto', {}, 'Foto quitada.');
  }
  // Franja de indicadores: logo, cifras, enlaces y fuente. Se edita aquí y se guarda en el expediente.
  let editInd = false;
  const IND = () => P.datos.indicadores || { cargo: '', cifras: [], enlaces: [], fuente: '' };
  function htmlIndicadores() {
    const I = IND();
    if (!trabajo && !I.cifras.length && !I.enlaces.length) return '';
    if (editInd) {
      const filaC = ([e, v]) => `<div class="inf"><input data-ie value="${esc(e)}" placeholder="Nombre, p. ej. Índice h" aria-label="Nombre del indicador"><input data-iv value="${esc(v)}" placeholder="Cifra" aria-label="Cifra"></div>`;
      const filaE = ([t, u]) => `<div class="inf"><input data-it value="${esc(t)}" placeholder="Texto del botón" aria-label="Texto del enlace"><input data-iu value="${esc(u)}" placeholder="https://…" aria-label="Dirección del enlace"></div>`;
      return `<section class="ind ined"><h2>Editar indicadores</h2>
        <label class="inl"><span>Debajo del nombre</span><input id="inCargo" value="${esc(I.cargo || '')}"></label>
        <h3>Cifras</h3><p class="cuenta">Deja vacía una fila para quitarla.</p><div id="inC">${[...I.cifras, ['', '']].map(filaC).join('')}</div><button class="bs" id="inMasC">+ Cifra</button>
        <h3>Enlaces</h3><div id="inE">${[...I.enlaces, ['', '']].map(filaE).join('')}</div><button class="bs" id="inMasE">+ Enlace</button>
        <label class="inl"><span>Fuente y fecha</span><input id="inF" value="${esc(I.fuente || '')}"></label>
        <div class="fil"><button class="bs prim" id="inOk">Guardar</button><button class="bs" id="inNo">Cancelar</button></div></section>`;
    }
    return `<section class="ind"><div class="ind-c"><img src="marca/Logosimbolo-negativo.png" alt="Universidad de Murcia"><div class="ind-p"><b>${esc(nombrePersona())}</b>${I.cargo ? `<span>${esc(I.cargo)}</span>` : ''}</div>${trabajo ? '<button class="ind-ed" id="inEd">Editar indicadores</button>' : ''}</div>
      ${I.cifras.length ? `<div class="ind-n">${I.cifras.map(([e, v]) => `<div><strong>${esc(v)}</strong><span>${esc(e)}</span></div>`).join('')}</div>` : ''}
      ${I.enlaces.length ? `<div class="ind-e">${I.enlaces.map(([t, u]) => `<a href="#" data-url="${esc(u)}" title="${esc(u)}">${esc(t)}</a>`).join('')}</div>` : ''}
      ${I.fuente ? `<p class="ind-f">${esc(I.fuente)}</p>` : ''}</section>`;
  }
  function ligarIndicadores() {
    const ed = $('#inEd'); if (ed) ed.onclick = () => { editInd = true; pintarLista(); };
    const no = $('#inNo'); if (no) no.onclick = () => { editInd = false; pintarLista(); };
    const mc = $('#inMasC'); if (mc) mc.onclick = () => $('#inC').insertAdjacentHTML('beforeend', '<div class="inf"><input data-ie placeholder="Nombre" aria-label="Nombre del indicador"><input data-iv placeholder="Cifra" aria-label="Cifra"></div>');
    const me = $('#inMasE'); if (me) me.onclick = () => $('#inE').insertAdjacentHTML('beforeend', '<div class="inf"><input data-it placeholder="Texto del botón" aria-label="Texto del enlace"><input data-iu placeholder="https://…" aria-label="Dirección del enlace"></div>');
    const ok = $('#inOk');
    if (ok) ok.onclick = async () => {
      const par = (a, b) => $$('.inf', $(a)).map((f) => [$(b[0], f).value.trim(), $(b[1], f).value.trim()]).filter(([x, y]) => x || y);
      const enl = par('#inE', ['[data-it]', '[data-iu]']);
      const malo = enl.find(([, u]) => !/^https?:\/\/\S+$/i.test(u));
      if (malo) { aviso(`El enlace «${malo[0] || malo[1]}» debe empezar por https://`, { mal: true }); return; }
      const ind = { cargo: $('#inCargo').value.trim(), cifras: par('#inC', ['[data-ie]', '[data-iv]']), enlaces: enl, fuente: $('#inF').value.trim() };
      editInd = false;
      await op('indicadores', { ind }, 'Indicadores guardados.');
    };
  }
  function pintarFicha() {
    const l = entradas('1');
    $('#sel1').textContent = 'Currículum vitae normalizado';
    $('#sel2').textContent = nombrePersona();
    $('#meritos').innerHTML = `<div class="ficha"><div class="fdatos">
        ${l.map((m) => { const p = m.filas[0][0]; return `<article class="dato merito-dato ${m.privado ? 'oculto' : ''}" data-id="${m.id}"><span class="ve"><b class="et ${trabajo ? 'ed' : ''}" data-f="0" data-c="0" data-k="e">${esc(p.e)}</b><span class="${trabajo ? 'ed' : ''}" data-f="0" data-c="0" data-k="v">${valorHtml(p)}</span>${m.privado && trabajo ? '<span class="tag">Oculto al tribunal</span>' : ''}</span>${trabajo ? `<span class="herr"><button data-priv>${m.privado ? 'Mostrar' : 'Ocultar'}</button><button class="b" data-del>Eliminar</button></span>` : ''}</article>`; }).join('')}
        ${trabajo ? '<button class="add" id="aDato">Añadir dato</button>' : ''}
      </div>${htmlFoto()}</div>`;
    $$('.merito-dato').forEach((e) => {
      const id = +e.dataset.id;
      const bo = (s, fn) => { const b = $(s, e); if (b) b.onclick = (ev) => { ev.stopPropagation(); fn(); }; };
      bo('[data-priv]', () => op('privado', { id }, buscar(id).privado ? 'Visible para el tribunal.' : 'Oculto al tribunal.'));
      bo('[data-del]', () => op('eliminar', { id }, 'Dato eliminado.'));
      ligarEdicion(e, id);
    });
    const aD = $('#aDato'); if (aD) aD.onclick = () => op('nuevo', { cod: '1', dato: true }, 'Dato añadido.');
    ligarFoto();
  }
  // ---------- Méritos nuevos ----------
  let avisoCerrado = false, analisis = null, verNuevo = null;
  const pdfsNuevos = () => (P.nuevos || []).filter((n) => n.esPdf);
  function pintarAvisoNuevos() {
    const n = pdfsNuevos().length;
    const b = $('#bNu');
    b.hidden = !n || !trabajo;
    b.textContent = `Méritos nuevos (${n})`;
    const a = $('#avNu');
    a.hidden = !n || !trabajo || avisoCerrado || (actual && actual.nuevos);
    $('#avTx').textContent = n === 1 ? 'Tienes un mérito nuevo para incorporar.' : `Tienes ${n} méritos nuevos para incorporar.`;
  }
  async function irNuevos() {
    salirEditor();
    items.forEach((x) => x.classList.remove('activo'));
    avisoCerrado = true;
    actual = { c: '', opcion: '', bloque: '', nuevos: true };
    sel = null; selSha = null; suelto = null; verNuevo = null; analisis = null;
    $('#sel1').textContent = 'Incorporar méritos nuevos';
    $('#sel2').textContent = 'Méritos nuevos';
    pintarAvisoNuevos(); pintarVisor(); pintarLista();
    const r = await window.api.analizarNuevos();
    if (actual && actual.nuevos) { analisis = r.map((x) => ({ ...x, incluir: false, destino: x.entrada ? `id:${x.entrada.id}` : x.cod })); analisis.forEach((x) => { if (x.esPdf) x.filas = filasPropuestas(x); }); pintarLista(); }
  }
  function opcionesDestino(x) {
    const ap = MENU.flatMap(([t, l, cd]) => (cd ? [[cd, t]] : l || [])).filter((o) => o[0] && o[0] !== 'T' && o[2] !== 'h' && o[0] !== '1' && !(P.datos.ocultos || []).includes(o[0]));
    const una = x.entrada ? `<option value="id:${x.entrada.id}" ${x.destino === `id:${x.entrada.id}` ? 'selected' : ''}>Unir a la entrada nº ${x.entrada.n} de «${esc(nombreDe(x.entrada.cod))}»</option>` : '';
    const lista = ap.map((o) => `<option value="${esc(o[0])}" ${x.destino === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
    return `${una}${lista}<option value="SC" ${x.destino === 'SC' ? 'selected' : ''}>Sin clasificar: lo decido después</option>`;
  }
  async function pintarCarpetaNuevos(accion) {
    const caja = $('#nuCaja');
    if (!caja || CONSULTA) return;
    const r = await window.api.carpetaNuevos(accion || 'ver');
    if (r.cancelado) return;
    P.nuevos = r.nuevos;
    pintarAvisoNuevos();
    const n = r.nuevos.filter((x) => x.esPdf).length;
    caja.innerHTML = `<div class="nu-c"><span class="nu-r" title="${esc(r.carpeta)}">${esc(r.carpeta)}</span><button class="bs" data-nc="elegir">Cambiar carpeta…</button>${r.externa ? '<button class="bs" data-nc="propia">Usar 05_Meritos_nuevos</button>' : ''}<button class="bs" data-nc="abrir">Abrir carpeta</button></div>
      <p class="cuenta">${r.externa ? 'Es una carpeta tuya: los PDF se copian al expediente y los originales no se tocan.' : 'Es la carpeta del expediente: al incorporar un PDF, sale de aquí y pasa a su apartado.'}</p>
      <button class="bs prim" id="nuRev" ${n ? '' : 'disabled'}>${n ? `Revisar ${n === 1 ? 'el mérito nuevo' : `los ${n} méritos nuevos`}` : 'No hay PDF nuevos en la carpeta'}</button>`;
    $$('[data-nc]', caja).forEach((b) => { b.onclick = () => pintarCarpetaNuevos(b.dataset.nc); });
    $('#nuRev').onclick = irNuevos;
  }
  // Texto propuesto para un mérito nuevo, con las etiquetas del apartado de destino. La persona lo revisa.
  function filasPropuestas(x) {
    const cod = x.destino;
    const modelo = P.datos.meritos.find((m) => m.cod === cod && !m.dato && !m.nota && m.filas.length);
    const ets = modelo ? [...new Set(modelo.filas.flat().map((p) => p.e).filter(Boolean))] : [];
    const et = (re, def) => ets.find((e) => re.test(e)) || def;
    const f = x.ficha;
    if (cod === '6.2' || cod === '4.5') {
      if (f && f.titulo) {
        const pag = f.paginas ? `, pp. ${f.paginas.replace('-', ' - ')}` : '';
        const vol = [f.volumen, f.numero].filter(Boolean).join(' - ');
        const cita = `${f.autores.join('; ')}. ${f.titulo}. ${f.revista}${vol ? `. ${vol}` : ''}${pag}. ${f.editorial ? `${f.editorial}, ` : ''}${f.fecha}.${f.issn ? ` ISSN ${f.issn}` : ''}${f.isbn ? ` ISBN ${f.isbn}` : ''}`.replace(/\.\./g, '.').trim();
        const yo = f.autores.findIndex((a) => /pino/i.test(a) && /ortega/i.test(a));
        const r = [['', cita], ['DOI', x.doi]];
        r.push(['Tipo de producción', /book/.test(f.tipo) ? (/chapter/.test(f.tipo) ? 'Capítulo de libro' : 'Libro o monografía científica') : 'Artículo científico']);
        r.push(['Tipo de soporte', /book/.test(f.tipo) ? 'Libro' : 'Revista']);
        if (yo >= 0) r.push(['Posición de firma', String(yo + 1)]);
        if (f.autores.length) r.push(['Nº total de autores', String(f.autores.length)]);
        return r;
      }
      return [['', x.titulo || ''], ...(x.doi ? [['DOI', x.doi]] : []), ...(x.issn ? [['ISSN', x.issn]] : []), ...(x.isbn ? [['ISBN', x.isbn]] : []), ...(x.fecha ? [['Fecha', x.fecha]] : [])];
    }
    const r = [[et(/^Título/i, '') || et(/^(Nombre|Denominación) del (proyecto|evento|curso|congreso|grupo|trabajo|programa|comité|premio)/i, '') || et(/^(Nombre|Denominación)/i, ets[0] || ''), (f && f.titulo) || x.titulo || '']];
    if (x.doi) r.push(['DOI', x.doi]);
    if (x.fecha) r.push([et(/^(Fecha|Año)/i, 'Fecha'), x.fecha]);
    if (x.horas) r.push([et(/horas/i, 'Duración en horas'), x.horas]);
    if (x.issn) r.push([et(/ISSN/i, 'ISSN'), x.issn]);
    if (x.isbn) r.push([et(/ISBN/i, 'ISBN'), x.isbn]);
    return r;
  }
  function pintarNuevos() {
    const caja = $('#meritos');
    if (!analisis) { caja.innerHTML = '<p class="cuenta">Leyendo los documentos…</p>'; return; }
    if (!analisis.length) { caja.innerHTML = '<p class="vacio">La carpeta está vacía: no hay méritos nuevos. Deja aquí los PDF y el programa te avisará.</p>'; return; }
    const pdf = analisis.filter((x) => x.esPdf), otros = analisis.filter((x) => !x.esPdf);
    const elegidos = pdf.filter((x) => x.incluir).length;
    caja.innerHTML = `<p class="cuenta">Revisa cada mérito: <b>dónde va</b> y <b>el texto que se escribirá</b>. Marca «Confirmo» solo en los que estén bien. Al incorporar, cada PDF pasa a su apartado con su número.</p>
      ${pdf.map((x) => `<article class="nuevo ${verNuevo === x.rel ? 'on' : ''}" data-i="${analisis.indexOf(x)}">
        <div class="nmed"><div class="nfila"><b>${esc(x.nombre)}</b><button class="bs rojo" data-ver>Ver</button></div>
          ${x.yaEsta ? '<p class="nav">Este PDF ya está en el expediente. No se añade otra vez: se aparta como repetido.</p>' : ''}
          ${x.sinTexto ? '<p class="nav">No se ha podido leer su texto (quizá esté escaneado). Comprueba el apartado.</p>' : ''}
          <label class="ncam"><span>Va en</span><select data-dest>${opcionesDestino(x)}</select></label>
          ${x.destino && x.destino.startsWith('id:') ? '<p class="cuenta">Se añade como documento de esa entrada; su texto no cambia.</p>' : `<div class="ntx"><span class="ntx-t">Texto que se escribirá en «${esc(nombreDe(x.destino))}»${x.ficha ? ' <i>(datos del DOI)</i>' : ''}</span>${(x.filas || []).map(([e, v], k) => `<div class="ntf"><input data-fe="${k}" value="${esc(e)}" placeholder="Etiqueta" aria-label="Etiqueta"><textarea data-fv="${k}" rows="${Math.min(5, Math.max(1, Math.ceil(String(v).length / 70)))}" aria-label="Valor">${esc(v)}</textarea><button class="mini mal" data-fx="${k}" aria-label="Quitar esta fila">×</button></div>`).join('')}<button class="mini" data-fa>+ Fila</button></div>`}
          <label class="nconf"><input type="checkbox" data-inc ${x.incluir ? 'checked' : ''}> Confirmo que este mérito está bien ubicado y su texto es correcto</label>
        </div></article>`).join('')}
      ${otros.length ? `<h2 class="fh">No se pueden colocar</h2><p class="cuenta">Por ahora solo se colocan PDF. Estos se quedan en la carpeta:</p>${otros.map((x) => `<div class="docsuelto"><span class="dn">${esc(x.nombre)}</span></div>`).join('')}` : ''}
      ${pdf.length ? `<div class="nfin"><button class="bs prim" id="nAct" ${elegidos ? '' : 'disabled'}>Incorporar los confirmados (${elegidos})</button><button class="bs" id="nRe">Volver a revisar la carpeta</button></div>` : ''}`;
    $$('.nuevo', caja).forEach((e) => {
      const x = analisis[+e.dataset.i];
      $('[data-inc]', e).onchange = (ev) => { x.incluir = ev.target.checked; pintarNuevos(); };
      $('[data-dest]', e).onchange = (ev) => { x.destino = ev.target.value; x.incluir = false; if (!x.destino.startsWith('id:')) x.filas = filasPropuestas(x); pintarNuevos(); };
      $$('[data-fe]', e).forEach((i) => { i.oninput = () => { x.filas[+i.dataset.fe][0] = i.value; }; });
      $$('[data-fv]', e).forEach((i) => { i.oninput = () => { x.filas[+i.dataset.fv][1] = i.value; }; });
      $$('[data-fx]', e).forEach((b) => { b.onclick = () => { x.filas.splice(+b.dataset.fx, 1); pintarNuevos(); }; });
      const fa = $('[data-fa]', e); if (fa) fa.onclick = () => { x.filas.push(['', '']); pintarNuevos(); };
      $('[data-ver]', e).onclick = () => { verNuevo = x.rel; $$('.nuevo', caja).forEach((o) => o.classList.toggle('on', o === e)); pintarVisor(); };
    });
    const nR = $('#nRe'); if (nR) nR.onclick = irNuevos;
    const nA = $('#nAct');
    if (nA) nA.onclick = async () => {
      nA.disabled = true;
      const lista = analisis.filter((x) => x.esPdf && x.incluir).map((x) => {
        const d = x.destino || 'SC';
        return d.startsWith('id:') ? { rel: x.rel, id: +d.slice(3), cod: x.entrada.cod } : { rel: x.rel, cod: d, titulo: x.titulo, doi: x.doi, filas: (x.filas || []).filter(([, v]) => String(v).trim()).map(([e, v]) => [{ e, v }]) };
      });
      verNuevo = null;
      const r = await op('incorporar', { lista });
      if (!r) { nA.disabled = false; return; }
      analisis = null;
      const partes = [];
      if (r.colocados) partes.push(r.colocados === 1 ? '1 mérito colocado' : `${r.colocados} méritos colocados`);
      if (r.sinClasificar) partes.push(`${r.sinClasificar} en Sin clasificar`);
      if (r.repetidos) partes.push(`${r.repetidos} repetido${r.repetidos > 1 ? 's' : ''} apartado${r.repetidos > 1 ? 's' : ''}`);
      aviso(`Actualizado: ${partes.join(', ') || 'nada que colocar'}.`, { des: true });
      await irNuevos();
    };
  }
  // ---------- Inicio ----------
  // ---------- Portada: la historia, las cifras y la trayectoria ----------
  let hT = null, histVista = false, anioSel = null;
  const POR = () => P.datos.portada || { historia: [], hitos: [] };
  function htmlHistoria() {
    const H = POR().historia || [];
    if (!H.length || (POR().oculta && !trabajo)) return '';
    return `<section class="hist ${POR().oculta ? 'apagada' : ''}" id="hist" aria-label="Mi historia">
      ${H.map((h, i) => `<figure class="hf" data-i="${i}"><img src="${esc(urlDe(h.img))}" alt=""></figure>`).join('')}
      <div class="hvelo"></div>
      <div class="hcap" aria-live="polite"><span class="hanio" id="hAnio"></span><p class="hfr" id="hFr"></p><p class="hsub" id="hSub"></p></div>
      <div class="hfin" id="hFin" hidden><p class="hpre">Concurso de acceso a Catedrático de Universidad</p><p class="hn">${esc(nombrePersona())}</p><p class="hc">${esc(IND().cargo || '')}</p><div class="hbot"><button class="hgo" id="hGo">Conocer mi trayectoria ↓</button><button class="hre" id="hRe">Volver a ver la historia</button></div></div>
      <div class="hctl"><span class="hdots">${H.map((_, i) => `<button data-d="${i}" aria-label="Momento ${i + 1}"></button>`).join('')}</span><button class="hb" id="hPau" aria-label="Pausar">Pausa</button><button class="hb" id="hSal">Saltar al currículum ›</button></div>
      ${trabajo ? `<label class="hed"><input type="checkbox" id="hOc" ${POR().oculta ? '' : 'checked'}> Mostrar esta historia al tribunal</label>` : ''}
    </section>`;
  }
  function arrancarHistoria() {
    const s = $('#hist');
    clearTimeout(hT);
    if (!s) return;
    const H = POR().historia;
    const figs = $$('.hf', s), dots = $$('.hdots button', s);
    let i = 0, pausa = false;
    const fin = () => {
      clearTimeout(hT);
      figs.forEach((f, k) => f.classList.toggle('on', k === H.length - 1));
      dots.forEach((d) => d.classList.add('on'));
      $('.hcap', s).hidden = true; $('#hFin').hidden = false; s.classList.add('acabada');
    };
    const ver = (k) => {
      i = k;
      if (i >= H.length) { fin(); return; }
      const h = H[i];
      s.classList.remove('acabada'); $('#hFin').hidden = true; $('.hcap', s).hidden = false;
      figs.forEach((f, j) => f.classList.toggle('on', j === i));
      dots.forEach((d, j) => d.classList.toggle('on', j <= i));
      $('#hAnio').textContent = h.anio || ''; $('#hFr').textContent = h.frase || ''; $('#hSub').textContent = h.sub || '';
      const cap = $('.hcap', s); cap.classList.remove('in'); void cap.offsetWidth; cap.classList.add('in');
      clearTimeout(hT);
      if (!pausa) hT = setTimeout(() => { if (document.body.contains(s)) ver(i + 1); }, (h.dur || 5) * 1000);
    };
    if (histVista || matchMedia('(prefers-reduced-motion: reduce)').matches) fin(); else ver(0);
    histVista = true;
    const aCifras = () => { const c = $('#cifras'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    $('#hSal').onclick = () => { fin(); aCifras(); };
    $('#hGo').onclick = aCifras;
    $('#hRe').onclick = () => { pausa = false; $('#hPau').textContent = 'Pausa'; ver(0); };
    $('#hPau').onclick = () => { pausa = !pausa; $('#hPau').textContent = pausa ? 'Seguir' : 'Pausa'; if (pausa) clearTimeout(hT); else ver(i + 1); };
    dots.forEach((d, k) => { d.onclick = () => { pausa = false; $('#hPau').textContent = 'Pausa'; ver(k); }; });
    const oc = $('#hOc'); if (oc) oc.onchange = () => op('portada', { oculta: !oc.checked }, oc.checked ? 'La historia se verá en la web del tribunal.' : 'La historia ya no se verá en la web del tribunal.');
  }
  function htmlHitos() {
    const H = POR().hitos || [];
    if (!H.length) return '';
    return `<section class="hit"><h2>Mi trayectoria</h2><div class="hit-l" style="grid-template-columns:repeat(${H.length},minmax(0,1fr))">${H.map(([a, t]) => `<button class="hit-p" data-a="${esc(a)}" title="Ver lo que hice en ${esc(a)}"><i></i><b>${esc(a)}</b><span>${esc(t)}</span></button>`).join('')}</div></section>`;
  }
  function htmlSobreMi() {
    const l = entradas('R');
    if (!l.length) return '';
    return `<details class="sobre"><summary>Sobre mí</summary><div class="sobre-t">${l.flatMap((m) => m.filas.flat()).filter((p) => p.v && (trabajo || !/x{3,}/i.test(p.v))).map((p) => `<p>${p.e ? `<b>${esc(p.e)}:</b> ` : ''}${conEnlaces(p.v)}</p>`).join('')}</div></details>`;
  }
  function irTrayectoria(a) {
    anioSel = +a || null;
    const it = items.find((x) => x.dataset.cd === 'T');
    elegir(it || null, 'T', 'Trayectoria');
  }
  function pintarInicio() {
    $('#sel1').textContent = 'Concurso de acceso a Catedrático de Universidad';
    $('#sel2').textContent = nombrePersona();
    const oc = P.datos.ocultos || [];
    const lin = (a) => {
      const l = todasDe(a.cod), n = l.length;
      if (oc.includes(a.cod) || (!trabajo && !n)) return '';
      const ok = l.filter((m) => m.pdfs.some((p) => p.nivel === 'alta')).length;
      const sinPdf = a.sinNum && a.cod !== '3.2' && a.cod !== '3.3' && a.cod !== '3.4';
      return `<button class="ilin" data-ic="${esc(a.cod)}"><span class="inom">${esc(nombreDe(a.cod))}</span><span class="icu">${trabajo && !sinPdf && n ? `${ok} de ${n} con PDF confirmado` : (a.sinNum ? '' : n)}</span>${trabajo && !sinPdf && n ? `<span class="ibar"><span style="width:${Math.round(ok / n * 100)}%"></span></span>` : ''}</button>`;
    };
    const grupos = window.ARBOL.filter((g) => g.gr !== 'Por decidir' && !g.directo).map((g) => {
      const h = g.aps.map(lin).join('');
      return h ? `<section class="ig"><h2>${esc(g.gr)}</h2>${h}</section>` : '';
    }).join('');
    $('#meritos').innerHTML = htmlHistoria() + `<div id="cifras">${htmlIndicadores()}</div>` + htmlHitos() + htmlSobreMi() + `<h2 class="indt">Índice del currículum</h2><div class="portada"><div><p class="pcvn">Currículum vitae normalizado (CVN)</p><p class="pdet">Cada apartado sigue los títulos, epígrafes y orden del CVN. Pulsa uno para verlo con sus documentos.</p></div>${htmlFoto()}</div><div class="indice">${grupos}</div>`;
    $$('[data-ic]').forEach((b) => { b.onclick = () => irA(b.dataset.ic); });
    $$('.hit-p').forEach((b) => { b.onclick = () => irTrayectoria(b.dataset.a); });
    ligarFoto();
    ligarIndicadores();
    ligarEnlaces($('#meritos'));
    arrancarHistoria();
  }
  // ---------- Trayectoria (v0.17): río de méritos por bloque, etapas e hitos ----------
  // Sin listas largas: el año se abre con un botón por bloque y la lista solo sale si se pide.
  const BLQ_COL = { Perfil: '#8A8F98', Formación: '#BA7517', Docencia: '#1D9E75', Investigación: '#2F6FB0', Transferencia: '#D85A30', 'Otros méritos': '#9B6BB3', Complementos: '#B4B2A9' };
  let trOcultos = new Set(), trAbierto = null, trAnimar = true;
  function bloqueDe(m) {
    const c = m.vista ? 'v:' + m.vista : m.cod;
    for (const [t, l, cd] of MENU) { if (cd === c) return t; if ((l || []).some((o) => o[0] === c)) return t; }
    const g = window.ARBOL.find((x) => x.aps.some((a) => a.cod === m.cod));
    return g ? window.ARBOL.corto[g.gr] || g.gr : 'Otros méritos';
  }
  // Etapas: salen de los hitos de la portada (universidad en la que empieza cada etapa).
  function etapas(a0, a1) {
    const H = (POR().hitos || []).map(([a, t]) => [+a, t]);
    const ini = [['Almería', /almer/i], ['Extremadura', /extremadura/i], ['Murcia', /murcia/i]].map(([n, re]) => { const h = H.find(([, t]) => re.test(t)); return h ? [h[0], n] : null; }).filter(Boolean).sort((x, y) => x[0] - y[0]);
    if (!ini.length) return [];
    const e = [[a0, ini[0][0], 'Formación']];
    ini.forEach(([a, n], i) => e.push([a, i + 1 < ini.length ? ini[i + 1][0] : a1 + 1, `Universidad de ${n}`]));
    return e.filter(([x, y]) => y > x);
  }
  // Colores oficiales (manuales de identidad): UAL Pantone 653 C, UEx Pantone 339, UM Pantone 187.
  const UNI_COL = { Almería: '#316094', Extremadura: '#00B28C', Murcia: '#BD2A33' };
  const colEt = (n) => { const k = Object.keys(UNI_COL).find((u) => String(n).includes(u)); return k ? UNI_COL[k] : null; };
  // Atributos del fondo de una etapa y de su rótulo: color de la universidad o el gris de siempre.
  const etRect = (n, i) => { const c = colEt(n); return c ? `class="rio-et uni" style="--c:${c}"` : `class="rio-et ${i % 2 ? 'par' : ''}"`; };
  const etTxt = (n) => { const c = colEt(n); return c ? `class="rio-etn uni" style="--c:${c}"` : 'class="rio-etn"'; };
  // Mezcla un color con blanco (f = parte de blanco): fondo claro para letras negras.
  const claro = (hex, f) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - f) + 255 * f).toString(16).padStart(2, '0')).join('');
  function pintarTrayectoria() {
    $('#sel1').textContent = 'Trayectoria';
    $('#sel2').textContent = 'Mi carrera, año a año';
    const oc = P.datos.ocultos || [];
    const ms = P.datos.meritos.filter((m) => publico(m) && !m.dato && m.cod !== 'R' && !oc.includes(m.cod) && (trabajo || m.vista !== 'sinubicar') && /^(19|20)\d\d$/.test(m.anio));
    if (!ms.length) { $('#meritos').innerHTML = '<p class="vacio">Aún no hay méritos con año.</p>'; return; }
    const blq = new Map(ms.map((m) => [m.id, bloqueDe(m)]));
    const bloques = Object.keys(BLQ_COL).filter((b) => ms.some((m) => blq.get(m.id) === b));
    const a0 = Math.min(...ms.map((m) => +m.anio)), a1 = Math.max(...ms.map((m) => +m.anio));
    const anios = []; for (let a = a0; a <= a1; a++) anios.push(a);
    const cuenta = new Map(anios.map((a) => [a, Object.fromEntries(bloques.map((b) => [b, 0]))]));
    ms.forEach((m) => { cuenta.get(+m.anio)[blq.get(m.id)]++; });
    const vis = bloques.filter((b) => !trOcultos.has(b));
    const totA = (a) => vis.reduce((s, b) => s + cuenta.get(a)[b], 0);
    const max = Math.max(1, ...anios.map(totA));
    const hitos = new Map((POR().hitos || []).map(([a, t]) => [+a, t]));
    if (!anioSel || anioSel < a0 || anioSel > a1) anioSel = [...hitos.keys()].filter((a) => a >= a0 && a <= a1).pop() || a1;
    // Geometría. Los hitos se reparten en filas para que sus textos no se pisen.
    // v0.17: el dibujo usa el ancho real de la pantalla (escala 1:1), así no se agranda y cabe entero.
    const W = Math.max(900, Math.round(($('#meritos').clientWidth || 1022) - 22)), X = (a) => 30 + ((a - a0) * (W - 60)) / Math.max(1, a1 - a0);
    const filasH = [], posH = [...hitos].filter(([a]) => a >= a0 && a <= a1).sort((p, q) => p[0] - q[0]).map(([a, t]) => {
      const x = X(a), txt = t.length > 60 ? t.slice(0, 59) + '…' : t, w = txt.length * 6.9 + 30, izq = x + w > W - 4;
      const [i0, i1] = izq ? [x - w, x] : [x, x + w];
      let f = filasH.findIndex((fin) => i0 > fin + 6); if (f < 0) { f = filasH.length; filasH.push(-1e9); }
      filasH[f] = i1;
      return { a, t, txt, x, f, izq };
    });
    const top = 52 + filasH.length * 24, Hr = 170, bot = top + Hr, Y = (v) => bot - (v / max) * (Hr - 6);
    const curva = (pts) => { let d = `M${pts[0][0]},${pts[0][1]}`; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx},${y0} ${mx},${y1} ${x1},${y1}`; } return d; };
    let base = anios.map(() => 0), capas = '';
    vis.forEach((b) => {
      const sup = anios.map((a, i) => base[i] + cuenta.get(a)[b]);
      const arriba = anios.map((a, i) => [X(a), Y(sup[i])]), abajo = anios.map((a, i) => [X(a), Y(base[i])]).reverse();
      capas += `<path class="rio-c" data-b="${esc(b)}" d="${curva(arriba)} L${abajo[0][0]},${abajo[0][1]} ${curva(abajo).slice(1).replace(/^[^C]*/, '')} Z" fill="${BLQ_COL[b]}"/>`;
      base = sup;
    });
    const et = etapas(a0, a1);
    // Etapas al fondo; el nombre solo se escribe si cabe (si no, sale al pasar el ratón).
    const fondo = et.map(([x, y, n], i) => {
      const x1 = X(x) - (x === a0 ? 30 : 0), w = X(Math.min(y, a1 + 0.5)) - X(x) + (x === a0 ? 30 : 0), corto = n.replace('Universidad de ', '');
      const cab = n.length * 7.6 + 12 < w ? n : corto.length * 7.6 + 12 < w ? corto : '';
      return `<g><rect x="${x1}" y="18" width="${w}" height="${bot - 18}" ${etRect(n, i)}/><title>${esc(n)} (${x}–${Math.min(y, a1 + 1) - 1})</title>${cab ? `<rect class="rio-etp" x="${X(x) + 2}" y="22" width="${cab.length * 7.6 + 16}" height="20" rx="10" fill="${colEt(n) ? claro(colEt(n), 0.55) : '#e4e2dc'}"/><text x="${X(x) + 10}" y="36" ${etTxt(n)}>${esc(cab)}</text>` : ''}</g>`;
    }).join('');
    // Hitos: punto y etiqueta con el color de la universidad de ese año, letras negras (el ancho de la etiqueta se ajusta al texto al pintar).
    const flags = posH.map(({ a, t, txt, x, f, izq }) => {
      const y = 58 + f * 24, e = et.find(([p, q]) => a >= p && a < q), c = e && colEt(e[2]);
      return `<g class="rio-h" data-a="${a}" data-izq="${izq ? 1 : 0}" style="--c:${c || '#8A8F98'};--cl:${c ? claro(c, 0.55) : '#e4e2dc'}"><line x1="${x}" x2="${x}" y1="${y}" y2="${bot}" /><rect x="${izq ? x - 12 - txt.length * 6.9 - 16 : x + 9}" y="${y - 10}" width="${txt.length * 6.9 + 16}" height="20" rx="10"/><circle cx="${x}" cy="${y}" r="5"/><text x="${izq ? x - 20 : x + 17}" y="${y + 4}" text-anchor="${izq ? 'end' : 'start'}">${esc(txt)}</text><title>${a} · ${esc(t)}</title></g>`;
    }).join('');
    const ejes = anios.filter((a) => a % 5 === 0).map((a) => `<text x="${X(a)}" y="${bot + 18}" text-anchor="middle" class="lt-txt">${a}</text>`).join('');
    const zonas = anios.map((a) => `<rect class="rio-z" data-a="${a}" x="${X(a) - (W - 60) / Math.max(1, a1 - a0) / 2}" y="18" width="${(W - 60) / Math.max(1, a1 - a0)}" height="${bot - 18 + 20}"/>`).join('');
    const sel = `<line class="rio-sel" x1="${X(anioSel)}" x2="${X(anioSel)}" y1="18" y2="${bot}"/>`;
    const ley = bloques.map((b) => `<button class="rio-b ${trOcultos.has(b) ? 'off' : ''}" data-rb="${esc(b)}" style="--c:${BLQ_COL[b]}"><i></i>${esc(b)} <small>${ms.filter((m) => blq.get(m.id) === b).length}</small></button>`).join('');
    // Panel del año: un botón por bloque; la lista solo si se abre
    const delAnio = ms.filter((m) => +m.anio === anioSel);
    const porB = bloques.map((b) => [b, delAnio.filter((m) => blq.get(m.id) === b)]).filter(([, l]) => l.length);
    const panel = `<div class="rio-p"><div class="tr-cab"><button class="bs" id="trAnt" ${anioSel > a0 ? '' : 'disabled'} aria-label="Año anterior">‹</button><h2>${anioSel}<small>${delAnio.length} ${delAnio.length === 1 ? 'mérito' : 'méritos'}</small></h2><button class="bs" id="trSig" ${anioSel < a1 ? '' : 'disabled'} aria-label="Año siguiente">›</button>${hitos.has(anioSel) ? `<span class="tr-hito">${esc(hitos.get(anioSel))}</span>` : ''}</div>
      <div class="rio-bq">${porB.map(([b, l]) => `<button class="rio-k ${trAbierto === b ? 'on' : ''}" data-rk="${esc(b)}" style="--c:${BLQ_COL[b]}"><b>${l.length}</b><span>${esc(b)}</span></button>`).join('')}</div>
      ${trAbierto && porB.some(([b]) => b === trAbierto) ? `<div class="rio-l">${(() => { const l = porB.find(([b]) => b === trAbierto)[1], g = new Map(); l.forEach((m) => { const k = m.vista ? 'v:' + m.vista : m.cod; if (!g.has(k)) g.set(k, []); g.get(k).push(m); }); return [...g].map(([k, l2]) => `<div class="tr-ap"><span class="tr-apn">${esc(nombreDe(k))}</span>${l2.map((m) => `<button class="tr-m" data-cod="${esc(k)}" data-id="${m.id}">${esc(m.t)}</button>`).join('')}</div>`).join(''); })()}</div>` : ''}</div>`;
    $('#meritos').innerHTML = `<div class="rio-cab"><p class="rio-t">${ms.length.toLocaleString('es-ES', { useGrouping: 'always' })} méritos de ${a0} a ${a1}</p><div class="rio-ley">${ley}</div></div>
      <div class="rio ${trAnimar ? 'entra' : ''}"><svg viewBox="0 0 ${W} ${bot + 26}" role="img" aria-label="Méritos por año y bloque, con los hitos de la carrera">${fondo}<g class="rio-capas">${capas}</g>${ejes}${flags}${sel}${zonas}</svg><div class="rio-tip" hidden></div></div>${panel}`;
    trAnimar = false;
    $$('.rio-etp').forEach((r) => { const t = r.nextElementSibling; try { const w = t.getComputedTextLength(); if (w) r.setAttribute('width', w + 16); } catch { /* sin medida */ } });
    // Ajusta cada etiqueta de hito al ancho real de su texto.
    $$('.rio-h').forEach((g) => {
      const t = $('text', g), r = $('rect', g), x = +$('circle', g).getAttribute('cx');
      let w; try { w = t.getComputedTextLength() + 18; } catch { return; }
      if (!w || w < 20) return;
      r.setAttribute('width', w);
      r.setAttribute('x', g.dataset.izq === '1' ? x - 11 - w : x + 8);
    });
    // Interacción
    const ir = (a) => { anioSel = a; pintarTrayectoria(); };
    const tip = $('.rio-tip'), caja = $('.rio');
    $$('.rio-z').forEach((z) => {
      const a = +z.dataset.a;
      z.onclick = () => ir(a);
      z.onmousemove = (e) => {
        const c = cuenta.get(a), n = Object.values(c).reduce((s, v) => s + v, 0), r = caja.getBoundingClientRect();
        tip.innerHTML = `<b>${a}</b>${hitos.has(a) ? `<em>${esc(hitos.get(a))}</em>` : ''}<span>${n} ${n === 1 ? 'mérito' : 'méritos'}</span>${bloques.filter((b) => c[b]).map((b) => `<span><i style="background:${BLQ_COL[b]}"></i>${esc(b)} · ${c[b]}</span>`).join('')}`;
        tip.hidden = false;
        tip.style.left = Math.min(r.width - 200, Math.max(0, e.clientX - r.left + 14)) + 'px';
        tip.style.top = Math.max(0, e.clientY - r.top - 20) + 'px';
      };
      z.onmouseleave = () => { tip.hidden = true; };
    });
    $$('[data-rb]').forEach((b) => { b.onclick = () => { const k = b.dataset.rb; if (trOcultos.has(k)) trOcultos.delete(k); else if (vis.length > 1) trOcultos.add(k); pintarTrayectoria(); }; });
    $$('[data-rk]').forEach((b) => { b.onclick = () => { trAbierto = trAbierto === b.dataset.rk ? null : b.dataset.rk; pintarTrayectoria(); }; });
    const prev = anios.filter((a) => a < anioSel && ms.some((m) => +m.anio === a)).pop(), next = anios.find((a) => a > anioSel && ms.some((m) => +m.anio === a));
    $('#trAnt').onclick = () => prev && ir(prev);
    $('#trSig').onclick = () => next && ir(next);
    $$('.tr-m').forEach((b) => {
      b.onclick = () => {
        irA(b.dataset.cod);
        setTimeout(() => { const e = $(`.merito[data-id="${b.dataset.id}"]`); if (e) { e.scrollIntoView({ block: 'center' }); e.classList.add('destaca'); setTimeout(() => e.classList.remove('destaca'), 2200); } }, 60);
      };
    });
  }
  function irA(c) {
    const it = items.find((x) => x.dataset.cd === c || $(`[data-c="${c}"]`, x));
    elegir(it || null, c, nombreDe(c));
    // v0.17: un apartado del CVN repartido en opciones del menú se ve entero desde el índice.
    if (!it && actual && !actual.vista) { actual.cvn = true; pintarLista(); }
  }
  function pintarLista() {
    const caja = $('#meritos');
    if (!actual) { caja.innerHTML = ''; return; }
    const y = $('#lista').scrollTop;
    if (actual.nuevos) { pintarNuevos(); $('#lista').scrollTop = y; return; }
    if (actual.clasif) { pintarClasif(); $('#lista').scrollTop = y; return; }
    if (actual.inicio) { pintarInicio(); $('#lista').scrollTop = y; return; }
    if (actual.tray) { pintarTrayectoria(); $('#lista').scrollTop = y; return; }
    if (actual.ficha) { pintarFicha(); $('#lista').scrollTop = y; ligarEnlaces(caja); return; }
    if (actual.bloque === 'Ajustes') { pintarAjustes(); return; }
    const esPub = actual.c === '6.2';
    const deAqui = () => (actual.vista ? entradasMenu(actual.cm) : actual.cvn ? todasDe(actual.c) : entradas(actual.c));
    const l = actual.c === 'PV' ? P.datos.meritos.filter((m) => m.nuevo) : esPub ? filtrarPubs(deAqui()) : deAqui();
    const herrAp = trabajo && actual.c && actual.c !== 'SC' && actual.c !== 'PV' ? `<div class="fil"><button class="bs prim" id="bNE">+ Añadir entrada</button>${actual.vista ? '' : '<button class="bs mal" id="bQA">Eliminar este apartado</button>'}</div>${actual.vista === 'sinubicar' ? '<p class="cuenta">Aquí están las entradas cuya carpeta de E: no dice dónde van, o que no tienen PDF. El tribunal no ve esta opción: usa «Mover a…» para llevar cada una a su sitio.</p>' : ''}${quitando ? `<div class="quita"><b>${l.length ? `Tiene ${l.length} ${l.length === 1 ? 'entrada' : 'entradas'}. ¿Qué hago con ${l.length === 1 ? 'ella' : 'ellas'}?` : '¿Eliminar este apartado?'}</b>${l.length ? `<select class="bs" id="qD" aria-label="Mover a">${opcionesAp()}</select><button class="bs" id="qM">Mover y eliminar</button>` : ''}<button class="bs mal" id="qB">${l.length ? 'Eliminar todo' : 'Eliminar'}</button><button class="bs" id="qN">Cancelar</button></div>` : ''}` : '';
    const avisoC0 = actual.c === 'C.0' && trabajo ? '<p class="cuenta">Estaban en el Word y no se han encontrado en el CVN. El tribunal no las ve, salvo las que marques «Mostrar al tribunal».</p>' : '';
    const verCuenta = trabajo && !APD(actual.c).sinNum;
    const avisoSC = actual.c === 'SC' && trabajo ? `<div class="clas-ban"><div><b>Clasificación automática</b><span>El programa lee cada documento, propone dónde va y tú confirmas.</span></div><button class="bs prim" id="bClasSC">Clasificar automáticamente</button></div>` : '';
    // v0.17: justificantes automáticos. El programa busca en E: el PDF de cada entrada sin justificante y tú solo validas.
    const clave = actual.cm || actual.c, sinJust = trabajo && actual.c !== 'SC' && actual.c !== 'PV' ? l.filter((m) => !m.nota && !m.dato && !m.pdfs.length) : [];
    if (propJ && propJ.k !== clave) propJ = null;
    const htmlPJ = !sinJust.length && !propJ ? '' : propJ ? htmlPropJ() : `<div class="pj-ban"><div><b>${sinJust.length} ${sinJust.length === 1 ? 'entrada sin justificante' : 'entradas sin justificante'}</b><span>El programa busca en E: el documento de cada una y te lo propone. Tú solo validas.</span></div><button class="bs prim" id="bPJ">Buscar justificantes automáticamente</button></div>`;
    caja.innerHTML = (esPub ? (actual.vista === 'libros' ? '' : htmlBiblio()) + htmlFiltroPubs() : '') + avisoSC + herrAp + htmlPJ + avisoC0 + (l.length ? (verCuenta ? `<p class="cuenta">${l.length} ${l.length === 1 ? 'entrada' : 'entradas'}${esPub && l.length !== deAqui().length ? ` de ${deAqui().length}` : ''}</p>` : '') + (actual.c === '4.1' && !actual.vista && P.datos.docencia_horas ? htmlHoras() : LINEA[actual.c] && actual.vista !== 'sinubicar' ? htmlLinea(actual.c, l) : '') + (APD(actual.c).tabla ? htmlTabla(l) : '') + (actual.c === '4.2' && !actual.vista ? htmlGruposTFE(l) : conNumVista(l, () => l.map(esPub ? htmlPub : htmlMerito).join(''))) : '<p class="vacio">Este apartado no tiene entradas.</p>');
    const bN = $('#bNE'); if (bN) bN.onclick = async () => { const r = await op('nuevo', { cod: actual.vista ? actual.cm : actual.c }, 'Entrada añadida.'); if (r) { const e = $(`.merito[data-id="${r.id}"]`); if (e) { e.scrollIntoView({ block: 'center' }); const c = $('.val.ed', e); if (c) c.click(); } } };
    $$('[data-ir]', caja).forEach((t) => { t.onclick = () => { const e = $(`.merito[data-id="${t.dataset.ir}"]`); if (e) e.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    const bQ = $('#bQA'); if (bQ) bQ.onclick = () => { quitando = !quitando; pintarLista(); };
    const qN = $('#qN'); if (qN) qN.onclick = () => { quitando = false; pintarLista(); };
    const fin = async (destino) => { const c = actual.c; quitando = false; const r = await op('eliminarApartado', { cod: c, destino }, destino ? `Apartado eliminado. Sus entradas están en ${nombreDe(destino)}.` : 'Apartado eliminado. Sus PDF siguen en Sin clasificar.'); if (r) { actual = null; irInicio(); } };
    const qB = $('#qB'); if (qB) qB.onclick = () => fin(null);
    const qM = $('#qM'); if (qM) qM.onclick = () => fin($('#qD').value);
    $('#lista').scrollTop = y;
    $$('.merito', caja).forEach(ligarMerito);
    ligarEnlaces(caja);
    if (esPub) ligarPubs(caja);
    ligarLinea(caja);
    ligarHoras(caja);
    $$('[data-tfe]', caja).forEach((b) => { b.onclick = () => { const g = $(`#tfe-${b.dataset.tfe}`, caja); if (g) g.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    const bCS = $('#bClasSC'); if (bCS) bCS.onclick = () => irClasificar('sueltos');
    ligarPropJ(caja, sinJust, clave);
    if (actual.c === 'SC' && trabajo) pintarDocs();
  }
  // ---------- Línea temporal arriba del apartado: se construye con las fechas de cada mérito ----------
  // «cursos»: una columna por curso académico. «anual»: una columna por año. «barras»: una barra por entrada, de inicio a fin.
  // El color sale de la universidad («uni»), del papel en el proyecto («rol») o es uno solo («uno»).
  const LINEA = {
    '2.2': { modo: 'barras', color: 'uni' },
    // v0.17: 3.4 sin gráfico (casi todo es de dos años). Línea de puntos con las etapas al fondo.
    '3.5': { modo: 'anual', color: 'uni', que: 'cursos' },
    '4.4': { modo: 'anual', color: 'uni', que: 'cursos y seminarios' },
    '4.5': { modo: 'anual', color: 'mat', que: 'materiales' },
    '4.6': { modo: 'barras', color: 'uni' },
    '6.4': { modo: 'anual', color: 'uno', que: 'trabajos' },
    '4.1': { modo: 'cursos', color: 'uni' },
    '4.2': { modo: 'anual', color: 'tipo', que: 'trabajos dirigidos' }, // v0.17: tesis, TFM y TFG por separado
    '5.2': { modo: 'barras', color: 'rol' },
    '5.3': { modo: 'barras', color: 'rol' },
    '6.3': { modo: 'anual', color: 'uno', que: 'trabajos' },
  };
  const COLORES = {
    uni: [['A', /almer/i, 'Almería', '#316094'], ['E', /extremadura/i, 'Extremadura', '#00B28C'], ['M', /murcia/i, 'Murcia', '#BD2A33'], ['O', /./, 'Otras entidades', '#888780']],
    rol: [['IP', null, 'Investigador principal', '#D85A30'], ['IN', null, 'Investigador', '#7F77DD']],
    uno: [['T', null, 'Trabajos presentados', '#1D9E75']],
    mat: [['LI', null, 'Libros', '#2F6FB0'], ['CA', null, 'Capítulos', '#7F77DD'], ['VI', null, 'Vídeos y materiales en DIGITUM', '#1D9E75'], ['OT', null, 'Otros materiales', '#888780']],
    tipo: [['TD', null, 'Tesis doctorales', '#D85A30'], ['TM', null, 'Trabajos fin de máster', '#7F77DD'], ['TG', null, 'Trabajos fin de grado', '#1D9E75'], ['X', null, 'Otros trabajos dirigidos', '#888780']],
  };
  // ---------- 4.2: tesis, TFM y TFG, cada uno en su bloque (v0.17) ----------
  const TIPOS_TFE = [['TD', 'Tesis doctorales', 'tesis'], ['TM', 'Trabajos fin de máster', 'TFM'], ['TG', 'Trabajos fin de grado', 'TFG'], ['X', 'Sin tipo indicado', 'sin tipo']];
  const tipoTFE = (m) => {
    const t = celdaDe(m, /^Tipo de proyecto$/i);
    return /tesis/i.test(t) ? 'TD' : /m[áa]ster/i.test(t) ? 'TM' : /grado/i.test(t) ? 'TG' : 'X';
  };
  const resumenTFE = (l) => TIPOS_TFE.map(([k, , c]) => [l.filter((m) => tipoTFE(m) === k).length, c]).filter(([n, c]) => n && (c !== 'sin tipo' || trabajo)).map(([n, c]) => `${n} ${c}`).join(' · ');
  // ---------- Justificantes automáticos (v0.17) ----------
  // propJ = { k: apartado, lista: [{ id, t, anio, cand: [...] }], marca: Set de ids, elegido: { id: índice } }
  let propJ = null;
  function htmlPropJ() {
    const L = propJ.lista, con = L.filter((x) => x.cand.length), sin = L.length - con.length;
    const fila = (x) => {
      const k = propJ.elegido[x.id] || 0, c = x.cand[k];
      return `<div class="pj-f ${propJ.marca.has(x.id) ? 'on' : ''}"><label class="pj-ck"><input type="checkbox" data-pjm="${x.id}" ${propJ.marca.has(x.id) ? 'checked' : ''}></label>
        <div class="pj-m"><b>${esc(x.t)}</b><small>${esc(x.anio || '')}</small></div>
        <div class="pj-d"><span class="bjn" style="--n:${c.nota}%">${c.nota}</span>${x.cand.length > 1 ? `<select class="bs" data-pjs="${x.id}">${x.cand.map((d, i) => `<option value="${i}" ${i === k ? 'selected' : ''}>${esc(d.nombre)} (${d.nota})</option>`).join('')}</select>` : `<span class="pj-n">${esc(c.nombre)}</span>`}<small>${esc(c.carpeta)}</small></div>
        <button class="bs" data-pjv="${x.id}">Ver</button></div>`;
    };
    return `<div class="pj"><div class="pj-cab"><b>Justificantes propuestos</b><span>${con.length} con propuesta${sin ? ` · ${sin} sin documento parecido en E:` : ''}${propJ.disco ? '' : ' · el disco E: no está conectado'}. Marca los correctos y pulsa «Aceptar».</span></div>
      ${con.map(fila).join('') || '<p class="cuenta">No he encontrado documentos parecidos.</p>'}
      <div class="pj-pie"><button class="bs prim" id="pjOk" ${propJ.marca.size ? '' : 'disabled'}>Aceptar ${propJ.marca.size} ${propJ.marca.size === 1 ? 'justificante' : 'justificantes'}</button><button class="bs" id="pjTodo">Marcar todos</button><button class="bs" id="pjNada">Desmarcar</button><button class="bs" id="pjX">Cerrar</button></div></div>`;
  }
  function ligarPropJ(caja, sinJust, clave) {
    const b = $('#bPJ', caja);
    if (b) b.onclick = async () => {
      b.textContent = 'Buscando en E:…'; b.disabled = true;
      const r = await window.api.proponerJust(sinJust.map((m) => m.id));
      if (r.error) { b.textContent = 'Buscar justificantes automáticamente'; b.disabled = false; return; }
      // Nada sale marcado: cada justificante lo valida el usuario (puede usar «Marcar todos»).
      propJ = { k: clave, lista: r.lista, disco: r.disco, elegido: {}, marca: new Set() };
      pintarLista();
    };
    if (!propJ) return;
    const cand = (id) => { const x = propJ.lista.find((z) => z.id === id); return x.cand[propJ.elegido[id] || 0]; };
    $$('[data-pjm]', caja).forEach((c) => { c.onchange = () => { const id = +c.dataset.pjm; if (c.checked) propJ.marca.add(id); else propJ.marca.delete(id); pintarLista(); }; });
    $$('[data-pjs]', caja).forEach((s) => { s.onchange = () => { propJ.elegido[+s.dataset.pjs] = +s.value; pintarLista(); }; });
    $$('[data-pjv]', caja).forEach((v) => { v.onclick = () => { const d = cand(+v.dataset.pjv); verNuevo = d.origen === 'suelto' ? d.archivo : d.ruta; verLibre = true; pintarVisor(); }; });
    const t = $('#pjTodo', caja); if (t) t.onclick = () => { propJ.lista.forEach((x) => { if (x.cand.length) propJ.marca.add(x.id); }); pintarLista(); };
    const n = $('#pjNada', caja); if (n) n.onclick = () => { propJ.marca.clear(); pintarLista(); };
    const x = $('#pjX', caja); if (x) x.onclick = () => { propJ = null; pintarLista(); };
    const ok = $('#pjOk', caja);
    if (ok) ok.onclick = async () => {
      const lista = [...propJ.marca].map((id) => { const d = cand(id); return d.origen === 'suelto' ? { origen: 'suelto', archivo: d.archivo, id } : { origen: 'disco', ruta: d.ruta, pista: d.carpeta + '/' + d.nombre, id }; });
      const nOk = lista.length;
      verLibre = false; verNuevo = null; propJ = null;
      await op('colocarLista', { lista }, `${nOk} ${nOk === 1 ? 'justificante añadido' : 'justificantes añadidos'}.`);
    };
  }
  let numVista = null; // numeración propia dentro de cada bloque
  // En una opción del menú (v0.17) las entradas se numeran 1, 2, 3… dentro de esa opción.
  // v0.17: también cuando el apartado del CVN está repartido en varias opciones del menú (cada opción numera desde 1).
  const repartido = () => actual && !actual.vista && !actual.cvn && P.datos.meritos.some((m) => m.cod === actual.c && m.vista);
  const conNumVista = (l, pintar) => { if (!actual || (!actual.vista && !repartido())) return pintar(); numVista = new Map(l.map((m, i) => [m.id, i + 1])); try { return pintar(); } finally { numVista = null; } };
  function htmlGruposTFE(l) {
    const grupos = TIPOS_TFE.map(([k, nom]) => [k, k === 'X' && !trabajo ? 'Otros trabajos dirigidos' : nom, l.filter((m) => tipoTFE(m) === k)]).filter(([, , v]) => v.length);
    numVista = new Map(grupos.flatMap(([, , v]) => v.map((m, i) => [m.id, i + 1])));
    const nav = `<div class="tfe-nav">${grupos.map(([k, nom, v]) => `<button class="bs" data-tfe="${k}">${esc(nom)} <b>${v.length}</b></button>`).join('')}</div>`;
    const h = nav + grupos.map(([k, nom, v]) => `<h3 class="tfe-gr" id="tfe-${k}">${esc(nom)} <span>${v.length}</span></h3>${k === 'X' && trabajo ? '<p class="cuenta">Estas entradas no dicen si son tesis, TFM o TFG. Revísalas: alguna puede no ser un trabajo dirigido.</p>' : ''}${v.map(htmlMerito).join('')}`).join('');
    numVista = null;
    return h;
  }
  const ahoraDec = () => { const d = new Date(); return d.getFullYear() + d.getMonth() / 12 + (d.getDate() - 1) / 365; };
  const decDe = (s) => { const f = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return f ? +f[3] + (+f[2] - 1) / 12 + (+f[1] - 1) / 365 : null; };
  function tramoDe(m, cfg) {
    const c = {};
    m.filas.flat().forEach((p) => { if (p.e && !(p.e in c)) c[p.e] = p.v; });
    const io = String(c['Fecha de inicio-fin'] || '').match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || [];
    const ini = decDe(c['Fecha de inicio']) ?? decDe(io[0]) ?? decDe(c['Fecha de celebración']) ?? decDe(c['Fecha de defensa']) ?? decDe(c['Fecha de obtención']) ?? decDe(c['Fecha de finalización']) ?? (m.anio ? +m.anio : null);
    if (ini == null) return null;
    let fin = decDe(c['Fecha de finalización']) ?? decDe(io[1]), curso = false, sinFin = false;
    if (fin == null) { const t = m.filas.flat().map((p) => p.v).join(' ').match(/cese:\s*(\d{1,2}\/\d{1,2}\/\d{4})/i); if (t) fin = decDe(t[1]); }
    const du = String(c['Duración'] || '');
    if (fin == null && /en curso/i.test(du)) { fin = ahoraDec(); curso = true; }
    if (fin == null && du) {
      const n = (re) => +((du.match(re) || [])[1] || 0);
      const t = n(/(\d+)\s*a/i) + n(/(\d+)\s*mes/i) / 12 + n(/(\d+)\s*d[ií]a/i) / 365;
      if (t) fin = ini + t;
    }
    if (fin == null || fin < ini) { fin = ini + 0.6; sinFin = true; }
    let k;
    if (cfg.color === 'rol') {
      const ip = /principal|coordinador|responsable/i.test(c['Grado de contribución'] || '') || /pino/i.test(c['Nombres investigadores principales (IP, Co-IP,...)'] || '');
      k = ip ? 'IP' : 'IN';
    } else if (cfg.color === 'uno') k = 'T';
    else if (cfg.color === 'tipo') k = tipoTFE(m);
    else if (cfg.color === 'mat') { const t = m.filas.flat().map((p) => p.v).join(' '); k = /cap[ií]tulo/i.test(t) ? 'CA' : /v[ií]deo|digitum/i.test(t) ? 'VI' : /\blibro\b/i.test(t) ? 'LI' : 'OT'; }
    else {
      const ent = c['Entidad de realización'] || c['Entidad empleadora'] || c['Entidad organizadora'] || c['Entidad de titulación'] || c['Entidad financiadora'] || '';
      k = (COLORES.uni.find(([, re]) => re.test(ent)) || COLORES.uni[3])[0];
    }
    const col = COLORES[cfg.color].find(([x]) => x === k);
    const nom = c['Categoría profesional'] || c['Nombre del proyecto'] || c['Nombre de la asignatura/curso'] || c['Titulación universitaria'] || c['Título del trabajo'] || c['Título del curso/seminario'] || c['Título de la formación'] || m.t || '';
    return { id: m.id, ini, fin, curso, sinFin, u: k, color: col[3], nom: String(nom).replace(/\s+/g, ' ').trim() };
  }
  // Línea temporal de puntos (v0.17): un punto por entrada, apilados por año, con las etapas de la carrera al fondo.
  // Pasa el ratón por un punto para ver la entrada; púlsalo para ir a su ficha. Pulsar un año lista sus entradas.
  function htmlPuntos(c, cfg, T, lista, usadas, ley) {
    const W = 1000, hoy = ahoraDec(), por = {};
    T.forEach((t) => { const y = Math.floor(t.ini); (por[y] = por[y] || []).push(t); });
    const ys = Object.keys(por).map(Number), y0 = Math.min(...ys), y1 = Math.max(Math.floor(hoy), ...ys), n = y1 - y0 + 1;
    const max = Math.max(...Object.values(por).map((v) => v.length)), x0 = 8, w = (W - 16) / n, top = 22, H = 128;
    const r = Math.max(2.2, Math.min(7, (H - 6) / (max * 2.35), (w - 3) / 2));
    const orden = usadas.map(([k]) => k);
    let s = etapas(y0, y1).map(([a, b, nom], i) => {
      const xa = x0 + (Math.max(a, y0) - y0) * w, wb = (Math.min(b, y1 + 1) - Math.max(a, y0)) * w, corto = nom.replace('Universidad de ', '');
      const cab = nom.length * 6.3 + 10 < wb ? nom : corto.length * 6.3 + 10 < wb ? corto : '';
      return `<g><rect x="${xa}" y="0" width="${wb}" height="${top + H + 2}" ${etRect(nom, i)}/><title>${esc(nom)}</title>${cab ? `<text x="${xa + 5}" y="13" ${etTxt(nom)}>${esc(cab)}</text>` : ''}</g>`;
    }).join('');
    s += `<line x1="${x0}" x2="${W - 8}" y1="${top + H + 2}" y2="${top + H + 2}" class="lt-eje"/>`;
    for (let y = y0; y <= y1; y++) {
      const xc = x0 + (y - y0) * w, v = (por[y] || []).slice().sort((a, b) => orden.indexOf(a.u) - orden.indexOf(b.u));
      s += `<g class="lt-col" data-lty="${y}"><rect x="${xc}" y="${top}" width="${w}" height="${H + 2}" class="lt-hit"/><title>${y} · ${v.length} ${v.length === 1 ? 'entrada' : 'entradas'}</title>`;
      s += v.map((t, k) => `<circle class="lt-p" data-ltid="${t.id}" cx="${xc + w / 2}" cy="${top + H - r - k * (2 * r + 1.6)}" r="${r}" fill="${t.color}"><title>${y} · ${esc(t.nom)}</title></circle>`).join('');
      s += '</g>';
      if (y % 5 === 0 || (y === y0 && (5 - (y % 5)) % 5 >= 2) || (y === y1 && y % 5 >= 2)) s += `<text x="${xc + w / 2}" y="${top + H + 20}" text-anchor="middle" class="lt-txt">${y}</text>`;
    }
    const datos = Object.fromEntries(Object.entries(por).map(([y, v]) => [y, v.map((t) => [t.id, t.nom.length > 90 ? t.nom.slice(0, 89) + '…' : t.nom])]));
    const total = `<span class="lt-tot">${cfg.color === 'tipo' ? resumenTFE(lista.filter(publico)) : `${T.length} ${cfg.que || 'entradas'}`} · ${Math.min(...ys)}–${Math.max(...ys)}</span>`;
    return `<div class="linea lt-pts" data-lt="${esc(JSON.stringify(datos))}" data-modo="anual">${ley.replace('</div>', total + '</div>')}<svg viewBox="0 0 ${W} ${top + H + 28}" role="img" aria-label="Entradas por año">${s}</svg><p class="lt-det">Pasa el ratón por un punto para ver la entrada y púlsalo para ir a su ficha. Pulsa un año para ver todas las de ese año.</p></div>`;
  }
  function htmlLinea(c, lista) {
    const cfg = LINEA[c];
    if (!cfg) return '';
    const T = lista.filter(publico).map((m) => tramoDe(m, cfg)).filter(Boolean);
    if (T.length < 2) return '';
    const modo = cfg.modo, W = 1000, hoy = ahoraDec();
    const usadas = COLORES[cfg.color].filter(([k]) => T.some((t) => t.u === k));
    const extra = modo === 'cursos' ? '<span class="vac">Sin datos en el CV</span>' : modo === 'barras' && T.some((t) => t.sinFin) ? '<span class="cor">Fecha de fin sin dato</span>' : '';
    const ley = `<div class="lt-ley">${usadas.length > 1 || cfg.color !== 'uno' ? usadas.map(([, , n, col]) => `<span style="--c:${col}">${esc(n)}</span>`).join('') : ''}${extra}</div>`;
    if (modo === 'anual') return htmlPuntos(c, cfg, T, lista, usadas, ley);
    if (modo === 'cursos') {
      const anioDe = (t) => (modo === 'cursos' ? Math.floor(t.ini - 8 / 12) : Math.floor(t.ini));
      const por = {};
      T.forEach((t) => { const y = anioDe(t); (por[y] = por[y] || []).push(t); });
      const y0 = Math.min(...Object.keys(por).map(Number)), y1 = Math.max(Math.floor(modo === 'cursos' ? hoy - 8 / 12 : hoy), ...Object.keys(por).map(Number)), n = y1 - y0 + 1;
      const max = Math.max(...Object.values(por).map((v) => v.length)), H = 120, x0 = 8, w = (W - 16) / n, bloques = max <= 8;
      const bh = Math.min(22, (H - 10) / max - 3);
      const orden = usadas.map(([k]) => k);
      let s = `<line x1="${x0}" x2="${W - 8}" y1="${H + 2}" y2="${H + 2}" class="lt-eje"/>`;
      for (let y = y0; y <= y1; y++) {
        const bw = Math.max(2, Math.min(46, w - 4)), x = x0 + (y - y0) * w + (w - 4 - bw) / 2, xc = x0 + (y - y0) * w, v = (por[y] || []).slice().sort((a, b) => orden.indexOf(a.u) - orden.indexOf(b.u));
        s += `<g class="lt-col" data-lty="${y}"><rect x="${xc}" y="0" width="${w}" height="${H + 2}" class="lt-hit"/>`;
        if (!v.length) { if (modo === 'cursos') s += `<rect x="${x + 2}" y="${H - 40}" width="${bw}" height="40" rx="2" class="lt-vacio"/>`; }
        else if (bloques) s += v.map((t, k) => `<rect x="${x + 2}" y="${H - (k + 1) * (bh + 3)}" width="${bw}" height="${bh}" rx="2" fill="${t.color}"/>`).join('');
        else {
          let yy = H;
          orden.forEach((k) => { const cu = v.filter((t) => t.u === k).length; if (!cu) return; const h = ((H - 16) * cu) / max; yy -= h; s += `<rect x="${x + 2}" y="${yy}" width="${bw}" height="${h}" fill="${COLORES[cfg.color].find(([q]) => q === k)[3]}"/>`; });
          if (w >= 18) s += `<text x="${xc + w / 2}" y="${yy - 4}" text-anchor="middle" class="lt-txt lt-num">${v.length}</text>`;
        }
        s += `<title>${modo === 'cursos' ? `Curso ${y}/${String(y + 1).slice(2)}` : y} · ${v.length} ${v.length === 1 ? 'entrada' : 'entradas'}</title></g>`;
        if (y % 5 === 0 || (y === y0 && (5 - (y % 5)) % 5 >= 2) || (y === y1 && y % 5 >= 2)) s += `<text x="${xc + w / 2}" y="${H + 20}" text-anchor="middle" class="lt-txt">${y}</text>`;
      }
      const datos = Object.fromEntries(Object.entries(por).map(([y, v]) => [y, v.map((t) => [t.id, t.nom.length > 90 ? t.nom.slice(0, 89) + '…' : t.nom])]));
      const total = modo === 'anual' ? `<span class="lt-tot">${cfg.color === 'tipo' ? resumenTFE(lista.filter(publico)) : `${T.length} ${cfg.que || 'entradas'}`} · ${y0}–${y1}</span>` : '';
      return `<div class="linea" data-lt="${esc(JSON.stringify(datos))}" data-modo="${modo}">${ley.replace('</div>', total + '</div>')}<svg viewBox="0 0 ${W} ${H + 28}" role="img" aria-label="Entradas por ${modo === 'cursos' ? 'curso académico' : 'año'}">${s}</svg><p class="lt-det">Pulsa ${modo === 'cursos' ? 'un curso' : 'un año'} para ver sus entradas.</p></div>`;
    }
    const y0b = Math.floor(Math.min(...T.map((t) => t.ini)));
    // v0.17: ancho real de pantalla y eje hasta el final del curso actual (p. ej. 2026 y 2027 en el curso 2026/27).
    const aHoy = new Date().getFullYear(), cFin = new Date().getMonth() >= 8 ? aHoy + 1 : aHoy;
    const WB = Math.max(W, Math.round(($('#meritos') ? $('#meritos').clientWidth : W) - 60));
    const L = 330, X = (v) => L + ((v - y0b) * (WB - L - 90)) / Math.max(1, cFin - y0b);
    const fil = 26, H = T.length * fil, paso = hoy - y0b > 12 ? 5 : 2;
    // Etapas de la carrera al fondo (Almería, Extremadura, Murcia), como en la Trayectoria.
    let s = etapas(y0b, cFin).map(([a, b, n], i) => `<rect x="${X(Math.max(a, y0b))}" y="0" width="${Math.max(0, X(Math.min(b, cFin)) - X(Math.max(a, y0b)))}" height="${H}" ${etRect(n, i)}><title>${esc(n)}</title></rect>`).join('');
    const marcas = new Set(); for (let y = Math.ceil(y0b / paso) * paso; y <= cFin; y += paso) marcas.add(y);
    // Los años del curso actual siempre se escriben; los demás, solo si no se pisan con ellos (un año ocupa unos 44 px).
    const anchoA = 44, juntos = X(cFin) - X(aHoy) < anchoA;
    for (const y of [...marcas]) if (Math.abs(X(y) - X(aHoy)) < anchoA || Math.abs(X(y) - X(cFin)) < anchoA) marcas.delete(y);
    if (juntos) marcas.add(cFin); else { marcas.add(aHoy); marcas.add(cFin); }
    [...marcas].sort((p, q) => p - q).forEach((y) => { const act = y >= aHoy; s += `<line x1="${X(y)}" x2="${X(y)}" y1="0" y2="${H}" class="lt-red"/><text x="${X(y)}" y="${H + 18}" text-anchor="middle" class="lt-txt ${act ? 'lt-act' : ''}">${juntos && y === cFin && cFin > aHoy ? `${aHoy}–${String(cFin).slice(2)}` : y}</text>`; });
    if (cFin > aHoy) s += `<text x="${(X(aHoy) + X(cFin)) / 2}" y="${H + 34}" text-anchor="middle" class="lt-txt lt-cur">curso ${aHoy}/${String(cFin).slice(2)}</text>`;
    T.forEach((t, i) => {
      const y = i * fil, nom = t.nom.length > 44 ? t.nom.slice(0, 43) + '…' : t.nom, a = Math.floor(t.ini), b = t.curso ? 'hoy' : t.sinFin ? '¿?' : Math.floor(t.fin);
      s += `<g class="lt-col" data-ltid="${t.id}"><rect x="0" y="${y}" width="${WB}" height="${fil}" class="lt-hit"/><title>${esc(t.nom)} · ${a}–${b}</title><text x="${L - 10}" y="${y + 17}" text-anchor="end" class="lt-nom">${esc(nom)}</text>`;
      s += `<rect x="${X(t.ini)}" y="${y + 5}" width="${Math.max(5, X(t.fin) - X(t.ini))}" height="16" rx="3" fill="${t.color}"/>`;
      if (t.sinFin) s += `<line x1="${X(t.fin)}" x2="${X(t.fin) + 26}" y1="${y + 13}" y2="${y + 13}" stroke="${t.color}" stroke-width="3" stroke-dasharray="3 3"/>`;
      if (t.curso) s += `<text x="${X(t.fin) + 6}" y="${y + 17}" class="lt-txt">en curso</text>`;
      s += '</g>';
    });
    return `<div class="linea lt-barras">${ley}<svg viewBox="0 0 ${WB} ${H + 40}" role="img" aria-label="Duración de cada entrada">${s}</svg><p class="lt-det">Pulsa una barra para ir a su ficha.</p></div>`;
  }
  // ---------- 4.1: horas de docencia de los certificados oficiales (v0.17) ----------
  // Total, gráfico de horas por curso apilado por universidad y tabla que se filtra por universidad o curso.
  let horasFil = { uni: null, curso: null };
  const UNIS = [['Almería', '#316094'], ['Extremadura', '#00B28C'], ['Murcia', '#BD2A33']];
  const fh = (h) => `${Number(h).toLocaleString('es-ES', { maximumFractionDigits: 1, useGrouping: 'always' })} h`;
  function htmlHoras() {
    const H = P.datos.docencia_horas;
    if (!H || !H.filas || !H.filas.length) return '';
    const F = H.filas, imp = F.filter((f) => !f.asignada), asig = F.filter((f) => f.asignada);
    const suma = (l) => l.reduce((s, f) => s + f.horas, 0);
    const cursos = [...new Set(F.map((f) => f.curso))].sort();
    const y0 = +cursos[0].slice(0, 4), y1 = +cursos[cursos.length - 1].slice(0, 4);
    const cur = (y) => `${y}/${String(y + 1).slice(2)}`;
    const porC = new Map(); for (let y = y0; y <= y1; y++) porC.set(cur(y), F.filter((f) => f.curso === cur(y)));
    const max = Math.max(...[...porC.values()].map(suma)), W = 1000, Hh = 170, x0 = 40, w = (W - x0 - 8) / porC.size;
    const Y = (h) => Hh - (h / max) * (Hh - 14);
    let s = '';
    for (let g = 100; g <= max; g += 100) s += `<line x1="${x0}" x2="${W - 8}" y1="${Y(g)}" y2="${Y(g)}" class="lt-red"/><text x="${x0 - 6}" y="${Y(g) + 4}" text-anchor="end" class="lt-txt">${g}</text>`;
    [...porC].forEach(([c, l], i) => {
      const x = x0 + i * w, bw = Math.max(3, w - 4), as = l.some((f) => f.asignada);
      let yy = Hh;
      UNIS.forEach(([u, col]) => { const h = suma(l.filter((f) => f.uni === u)); if (!h) return; const hh = Hh - Y(h); yy -= hh; s += `<rect x="${x + 2}" y="${yy}" width="${bw}" height="${hh}" fill="${col}" ${as ? 'fill-opacity=".45" stroke="' + col + '" stroke-dasharray="3 2"' : ''} rx="1.5"/>`; });
      const det = l.length ? l.map((f) => `${f.asig}: ${fh(f.horas)}`).join('\n') : 'Sin certificado de horas';
      s += `<g class="lt-col ${horasFil.curso === c ? 'on' : ''}" data-hc="${c}"><rect x="${x}" y="0" width="${w}" height="${Hh + 2}" class="lt-hit"/><title>${c}${as ? ' (carga asignada)' : ''} · ${fh(suma(l))}\n${esc(det)}</title></g>`;
      const y = +c.slice(0, 4);
      if (y % 5 === 0 || (y === y0 && (5 - (y % 5)) % 5 >= 3) || (y === y1 && y % 5 >= 3)) s += `<text x="${x + w / 2}" y="${Hh + 18}" text-anchor="middle" class="lt-txt">${c}</text>`;
    });
    const tot = (u) => suma(imp.filter((f) => f.uni === u));
    const kpi = `<div class="hs-k"><div class="hs-tot"><b>${fh(suma(imp))}</b><span>de docencia universitaria impartida · ${new Set(imp.map((f) => f.curso)).size} cursos académicos · 3 universidades</span></div>${UNIS.map(([u, col]) => `<button class="hs-u ${horasFil.uni === u ? 'on' : ''}" data-hu="${u}" style="--c:${col}"><i></i>${u}<b>${fh(tot(u))}</b></button>`).join('')}${asig.length ? `<span class="hs-as">+ ${fh(suma(asig))} asignadas en 2025/26 (curso en marcha)</span>` : ''}</div>`;
    const fl = F.filter((f) => (!horasFil.uni || f.uni === horasFil.uni) && (!horasFil.curso || f.curso === horasFil.curso)).sort((a, b) => b.curso.localeCompare(a.curso) || b.horas - a.horas);
    const filtro = horasFil.uni || horasFil.curso ? `<button class="bs" id="hsQ">Quitar filtro: ${esc([horasFil.uni, horasFil.curso].filter(Boolean).join(' · '))} ✕</button>` : '';
    const tabla = `<details class="hs-tab" ${horasFil.uni || horasFil.curso ? 'open' : ''}><summary>Ver el detalle por asignatura (${fl.length} ${fl.length === 1 ? 'fila' : 'filas'} · ${fh(suma(fl.filter((f) => !f.asignada)))})</summary>${filtro}<table class="tcv"><thead><tr><th>Curso</th><th>Universidad</th><th>Asignatura</th><th>Titulación</th><th>Horas</th></tr></thead><tbody>${fl.map((f) => `<tr><td>${esc(f.curso)}${f.asignada ? ' <small>(asignada)</small>' : ''}</td><td>${esc(f.uni)}</td><td>${esc(f.asig)}</td><td>${esc(f.tit)}</td><td class="num">${fh(f.horas)}${f.creditos ? ` <small>(${f.creditos} cr.)</small>` : ''}</td></tr>`).join('')}</tbody></table></details>`;
    return `<section class="linea hs">${kpi}<svg viewBox="0 0 ${W} ${Hh + 26}" role="img" aria-label="Horas impartidas por curso académico">${s}</svg><p class="lt-det">Pasa el ratón por un curso para ver sus asignaturas; púlsalo para filtrar la tabla. Fuentes: certificados oficiales de la UM (20/11/2025), la UEx (25/05/2007) y la UAL (23/02/2007). UEx y UAL dan créditos: 1 crédito = 10 horas.</p>${tabla}</section>`;
  }
  function ligarHoras(caja) {
    const re = () => { const y = $('#lista').scrollTop; const sec = $('.hs', caja); if (sec) { sec.outerHTML = htmlHoras(); ligarHoras(caja); } $('#lista').scrollTop = y; };
    $$('[data-hu]', caja).forEach((b) => { b.onclick = () => { horasFil.uni = horasFil.uni === b.dataset.hu ? null : b.dataset.hu; re(); }; });
    $$('[data-hc]', caja).forEach((g) => { g.onclick = () => { horasFil.curso = horasFil.curso === g.dataset.hc ? null : g.dataset.hc; re(); }; });
    const q = $('#hsQ', caja); if (q) q.onclick = () => { horasFil = { uni: null, curso: null }; re(); };
  }
  function irMerito(id) {
    const e = $(`.merito[data-id="${id}"]`);
    if (!e) return;
    e.scrollIntoView({ block: 'center', behavior: 'smooth' });
    e.classList.remove('destaca'); void e.offsetWidth; e.classList.add('destaca');
  }
  function ligarLinea(caja) {
    const lt = $('.linea', caja);
    if (!lt) return;
    const det = $('.lt-det', lt), datos = lt.dataset.lt ? JSON.parse(lt.dataset.lt) : null, cursos = lt.dataset.modo === 'cursos';
    $$('[data-ltid]', lt).forEach((g) => { g.onclick = () => irMerito(g.dataset.ltid); });
    $$('[data-lty]', lt).forEach((g) => {
      g.onclick = () => {
        $$('.lt-col.on', lt).forEach((x) => x.classList.remove('on'));
        g.classList.add('on');
        const y = +g.dataset.lty, v = (datos && datos[y]) || [], cur = cursos ? `Curso ${y}/${String(y + 1).slice(2)}` : `${y}`;
        det.innerHTML = v.length ? `<b>${cur} · ${v.length}:</b> ${v.map(([id, n]) => `<button class="lt-ir" data-ir2="${id}">${esc(n)}</button>`).join(' · ')}` : `<b>${cur}:</b> no hay entradas en el CV.`;
        $$('[data-ir2]', det).forEach((b) => { b.onclick = () => irMerito(b.dataset.ir2); });
      };
    });
  }
  // ---------- Publicaciones: panel bibliométrico dinámico (v0.16) ----------
  // Fuentes: OpenAlex (citas, h, FWCI, percentiles, autoría) y SCImago SJR (cuartil de la revista en el año de publicación).
  // El CVN no se usa para métricas: solo es de consulta.
  const BIB = () => P.biblio || null;
  const fnum = (n, d = 0) => (n == null ? '—' : Number(n).toLocaleString('es-ES', { maximumFractionDigits: d, minimumFractionDigits: d }));
  const llano = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const celdaDe = (m, re) => { const p = m.filas.flat().find((x) => re.test(x.e)); return p ? p.v : ''; };
  const esSi = (v) => /^s[ií]/i.test(String(v || '').trim());
  let pubFil = { q: '', f: 'todas', y0: null, y1: null, cu: null, rev: null }, pubAbiertas = new Set(), mapaObras = null, bibAnimar = true, bibModo = 'cuartil';
  function obraDe(m) {
    const B = BIB();
    if (!B) return null;
    if (!mapaObras || mapaObras.B !== B) mapaObras = { B, doi: new Map(B.obras.filter((o) => o.doi).map((o) => [o.doi.toLowerCase(), o])), tit: B.obras.filter((o) => o.titulo && o.titulo.length > 25).map((o) => [llano(o.titulo).slice(0, 50), o]), cache: new WeakMap() };
    if (mapaObras.cache.has(m)) return mapaObras.cache.get(m);
    const d = celdaDe(m, /^DOI$/i).trim().toLowerCase().replace(/^https?:\/\/doi\.org\//, '');
    const t = llano(m.filas.flat().map((p) => p.v).join(' '));
    let o = d && mapaObras.doi.has(d) ? mapaObras.doi.get(d) : null;
    // Un DOI de la ficha solo vale si el título de OpenAlex también aparece: si no, el DOI está mal y se busca por título.
    if (o && !t.includes(llano(o.titulo).slice(0, 30))) o = null;
    if (!o) { const hit = mapaObras.tit.find(([k]) => t.includes(k)); o = hit ? hit[1] : null; }
    mapaObras.cache.set(m, o);
    return o;
  }
  const anioDe = (m) => +((obraDe(m) || {}).anio) || +m.anio || null; // primero OpenAlex
  // --- Cuartil SJR de cada publicación: por ISSN (del CV o de OpenAlex) y, si no hay, por el nombre de la revista en la cita ---
  const nRev = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/\(.*?\)/g, ' ').replace(/^the /, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  const ALIAS = {
    'strength and conditioning j': 'strength and conditioning journal', 'hum mov': 'human movement', ricyde: 'ricyde revista internacional de ciencias del deporte', sensor: 'sensors',
    'revista apunts': 'apunts educacion fisica y deportes', 'journal of sports engineering and technology': 'proceedings of the institution of mechanical engineers part p journal of sports engineering and technology',
    'proc i meche part p j sports engineering and technology': 'proceedings of the institution of mechanical engineers part p journal of sports engineering and technology',
    'rev int med cienc act fis deporte': 'revista internacional de medicina y ciencias de la actividad fisica y del deporte', 'sport tk revista euroamericana de ciencias del deporte': 'sport tk',
    'nuevas tendencias en educacion fisica deporte y recreacion': 'retos', 'retos nuevas tendencias en educacion fisica deporte y recreacion': 'retos', 'revista de psicologia del deporte': 'revista de psicologia del deporte',
  };
  let mapaSjr = null;
  function sjrIdx() {
    const S = (BIB() || {}).sjr;
    if (!S) return null;
    if (mapaSjr && mapaSjr.S === S) return mapaSjr;
    const issn = new Map(), nom = new Map();
    [...S.revistas, ...(S.extra || [])].forEach((r) => { r.i.forEach((i) => issn.set(i, r)); nom.set(nRev(r.t).replace(/ switzerland$| lithuania$| maringa$| discontinued$/, ''), r); });
    Object.entries(ALIAS).forEach(([a, b]) => { if (nom.has(b)) nom.set(a, nom.get(b)); });
    mapaSjr = { S, issn, nom, cache: new WeakMap() };
    return mapaSjr;
  }
  function qRev(r, y) {
    if (!r || !y) return null;
    if (r.a) return r.a[y] || null;
    const S = mapaSjr.S, c = r.q[Math.max(S.y0, Math.min(S.y1, +y)) - S.y0];
    return c && c !== '.' ? 'Q' + c : null;
  }
  function revistaCita(t) {
    const s = String(t || '').split(/\.\s+/);
    for (let k = s.length - 2; k >= 2; k--) if (/^(\d|pp\.|\d{2}\/\d{2})/.test(s[k + 1].trim()) && !/^\d/.test(s[k].trim())) return s[k].replace(/,\s*pp$/, '').trim();
    const m = String(t || '').match(/\.\s*([^.]{3,120}?)\.\s*\d{2}\/\d{2}\/\d{4}/);
    return m ? m[1] : '';
  }
  // Devuelve { c: 'Q1'…'Q4' | 'sq' (en SJR, sin cuartil ese año) | 'fuera' (revista fuera de SJR o sin revista), rev, y }
  function cuartilDe(m) {
    const X = sjrIdx();
    if (!X) return { c: 'fuera', rev: '', y: anioDe(m) };
    if (X.cache.has(m)) return X.cache.get(m);
    const txt = m.filas.flat().map((p) => p.v).join(' '), o = obraDe(m), y = anioDe(m);
    let r = null;
    for (const i of txt.match(/\b\d{4}-?\d{3}[\dXx]\b/g) || []) { r = X.issn.get(i.replace('-', '').toUpperCase()); if (r) break; }
    if (!r && o) for (const i of o.issns || [o.issn]) { r = i && X.issn.get(String(i).replace('-', '').toUpperCase()); if (r) break; }
    let rv = revistaCita(m.t);
    if (!r && rv) { let n = nRev(rv).replace(/ \d.*$/, ''); n = ALIAS[n] || n; r = X.nom.get(n) || null; }
    if (!r && o && o.revista) { const n = nRev(o.revista); r = X.nom.get(ALIAS[n] || n) || null; }
    const q = qRev(r, y);
    const res = { c: q || (r ? 'sq' : 'fuera'), rev: r ? r.t : (o && o.revista) || rv || '', y };
    X.cache.set(m, res);
    return res;
  }
  const CU = [['Q1', 'Q1', '#0a3a46'], ['Q2', 'Q2', '#1d6e80'], ['Q3', 'Q3', '#4fa0b3'], ['Q4', 'Q4', '#a3d3de'], ['sq', 'En SJR, sin cuartil ese año', '#d9d4cb'], ['fuera', 'Fuera de SJR (revistas no indexadas, libros, divulgación)', '#ece8e1']];
  const colorCu = (c) => (CU.find((x) => x[0] === c) || CU[5])[2];
  const esQ1 = (m) => cuartilDe(m).c === 'Q1';
  const esQ12 = (m) => /^Q[12]$/.test(cuartilDe(m).c);
  // Autor de correspondencia: comprobado en el PDF del artículo o en OpenAlex (verificacion.json). El CVN no es referencia.
  const esCorr = (m) => { const v = ((BIB() || {}).verif || {}).corr || {}; return m.id in v ? !!v[m.id] : !!(obraDe(m) || {}).corr; };
  const esTop10 = (m) => !!(obraDe(m) || {}).top10;
  function filtrarPubs(l, sinPanel) {
    const q = llano(pubFil.q), lim = new Date().getFullYear() - 4;
    return l.filter((m) => {
      if (pubFil.f === 'q1' && !esQ1(m)) return false;
      if (pubFil.f === 'q12' && !esQ12(m)) return false;
      if (pubFil.f === 'top' && !esTop10(m)) return false;
      if (pubFil.f === 'corr' && !esCorr(m)) return false;
      if (pubFil.f === 'rec' && !(anioDe(m) >= lim)) return false;
      if (!sinPanel) {
        const y = anioDe(m);
        if (pubFil.y0 != null && !(y >= pubFil.y0 && y <= pubFil.y1)) return false;
        if (pubFil.cu && cuartilDe(m).c !== pubFil.cu) return false;
        if (pubFil.rev && cuartilDe(m).rev !== pubFil.rev) return false;
      }
      if (q && !llano(m.filas.flat().map((p) => p.v).join(' ')).includes(q)) return false;
      return true;
    });
  }
  function htmlFiltroPubs() {
    const l = deVista6_2(), lim = new Date().getFullYear() - 4;
    const n = { todas: l.length, q1: l.filter(esQ1).length, q12: l.filter(esQ12).length, top: l.filter(esTop10).length, rec: l.filter((m) => anioDe(m) >= lim).length, corr: l.filter(esCorr).length };
    const b = (k, t) => `<button class="pf ${pubFil.f === k ? 'on' : ''}" data-pf="${k}">${t} <small>${n[k]}</small></button>`;
    const act = [];
    if (pubFil.y0 != null) act.push(['y', pubFil.y0 === pubFil.y1 ? `Año ${pubFil.y0}` : `${pubFil.y0}–${pubFil.y1}`]);
    if (pubFil.cu) act.push(['cu', (CU.find((x) => x[0] === pubFil.cu) || [])[1]]);
    if (pubFil.rev) act.push(['rev', pubFil.rev]);
    const chips = act.length ? `<div class="pact">Filtrado por: ${act.map(([k, t]) => `<button class="pact-c" data-quita="${k}" title="Quitar este filtro">${esc(t)} <span aria-hidden="true">×</span></button>`).join('')}<button class="pact-x" data-quita="todo">Quitar todos</button></div>` : '';
    return `<div class="pfil"><input type="search" id="pfQ" placeholder="Buscar por título, revista o autor" value="${esc(pubFil.q)}" aria-label="Buscar publicaciones">${b('todas', 'Todas')}${b('q1', 'Q1 (SJR)')}${b('q12', 'Q1–Q2 (SJR)')}${b('top', 'Top 10 % más citado')}${b('rec', 'Últimos 5 años')}${b('corr', 'Autor de correspondencia')}</div>${chips}`;
  }
  // Índice h al final de cada año, con las citas por año de cada trabajo (OpenAlex da el desglose desde 2012).
  function hPorAnio(B) {
    const ys = new Set();
    B.obras.forEach((o) => Object.keys(o.cby || {}).forEach((y) => ys.add(+y)));
    if (!ys.size) return {};
    const l = [...ys].sort((a, b) => a - b), r = {};
    for (const Y of l) {
      const c = B.obras.map((o) => { const v = o.cby || {}; const suma = Object.entries(v).reduce((s, [y, n]) => s + (+y <= Y ? n : 0), 0); const resto = o.citas - Object.values(v).reduce((s, n) => s + n, 0); return suma + (o.anio && o.anio <= Math.min(...l) ? Math.max(0, resto) : 0); }).sort((a, b) => b - a);
      let h = 0; while (h < c.length && c[h] > h) h++;
      r[Y] = h;
    }
    return r;
  }
  function htmlBiblio() {
    const B = BIB();
    const falta = trabajo && P.faltan ? `<div class="clas-ban"><div><b>${P.faltan} ${P.faltan === 1 ? 'publicación está' : 'publicaciones están'} en OpenAlex y no en tu CV</b><span>Revísalas y añade las que quieras: el texto se escribe solo.</span></div><button class="bs prim" id="bFaltan">Revisarlas</button></div>` : '';
    if (!B) return trabajo ? `<section class="bib vacia"><p>Trae tus datos de OpenAlex para ver aquí tu panel bibliométrico: citas, índice h, cuartiles, impacto normalizado y evolución.</p><button class="bs prim" id="bibAct">Traer mis datos de OpenAlex</button></section>` : '';
    const vis = todasDe('6.2').filter(publico);
    const base = filtrarPubs(vis, true);
    const anim = bibAnimar && !matchMedia('(prefers-reduced-motion: reduce)').matches;
    // --- Cifras ---
    const cls = {}; base.forEach((m) => { const c = cuartilDe(m).c; cls[c] = (cls[c] || 0) + 1; });
    const art = B.obras.filter((o) => /article|review/.test(o.tipo));
    const fw = art.map((o) => o.fwci).filter((x) => x != null);
    const fwci = fw.length ? fw.reduce((a, b) => a + b, 0) / fw.length : null;
    const top10 = B.obras.filter((o) => o.top10).length, top1 = B.obras.filter((o) => o.top1).length;
    const tile = (n, d, e, s, cl = '') => `<div class="kpi ${cl}"><strong data-n="${n}" data-d="${d}">${anim ? '0' : fnum(n, d)}</strong><span>${e}</span>${s ? `<small>${s}</small>` : ''}</div>`;
    const dist = ((B.sjr || {}).distinciones || [])[0];
    const kpis = `<div class="bib-t">
      ${tile(vis.length, 0, 'publicaciones en el CV', `${fnum(B.trabajos)} trabajos en OpenAlex`)}
      ${tile(B.citas, 0, 'citas', `${fnum(B.media2a, 2)} citas por trabajo (2 años)`)}
      ${tile(B.h, 0, 'índice h', `i10: ${fnum(B.i10)}`)}
      ${tile(cls.Q1 || 0, 0, 'en Q1 (SJR)', `${fnum((cls.Q1 || 0) + (cls.Q2 || 0))} en Q1 o Q2`, 'q1')}
      ${tile(top10, 0, 'en el 10 % más citado', `${fnum(top1)} en el 1 % más citado del mundo`)}
      ${fwci != null ? tile(fwci, 2, 'impacto normalizado (FWCI)', `la media mundial de su campo es 1`) : ''}
    </div>${dist ? `<p class="bib-dist"><span aria-hidden="true">★</span><b>${esc(dist.t)}</b> · ${esc(dist.d.split('.')[0])}.</p>` : ''}`;
    // --- Gráfico principal ---
    const ysCv = base.map(anioDe).filter(Boolean);
    const hA = hPorAnio(B), cit = (a) => (B.porAnio[a] || {}).c || 0;
    const ahora = new Date().getFullYear(), yB = Math.max(...ysCv, ahora);
    // Citas e índice h empiezan el año anterior al primer dato; las publicaciones, en la primera del CV.
    const conDato = bibModo === 'citas' ? Object.keys(B.porAnio).filter((a) => cit(a)).map(Number) : bibModo === 'h' ? Object.keys(hA).map(Number) : ysCv;
    const yA = Math.min(...conDato, ahora) - (bibModo === 'cuartil' ? 0 : 1);
    const anios = []; for (let a = yA; a <= yB; a++) anios.push(a);
    const porA = {}; anios.forEach((a) => { porA[a] = {}; });
    base.forEach((m) => { const y = anioDe(m); if (porA[y]) { const c = cuartilDe(m).c; porA[y][c] = (porA[y][c] || 0) + 1; } });
    const tot = (a) => Object.values(porA[a]).reduce((s, n) => s + n, 0);
    const MODOS = { cuartil: 'Publicaciones por cuartil', citas: 'Citas recibidas', h: 'Índice h' };
    const W = 900, H = 230, ml = 34, mb = 26, mt = 14, n = anios.length, bw = (W - ml - 8) / n;
    const val = bibModo === 'cuartil' ? tot : bibModo === 'citas' ? cit : (a) => hA[a] || 0;
    const max = Math.max(1, ...anios.map(val));
    const paso = max > 400 ? 200 : max > 150 ? 50 : max > 60 ? 20 : max > 25 ? 10 : 5;
    const Y = (v) => mt + (H - mt - mb) * (1 - v / (Math.ceil(max / paso) * paso));
    let g = '';
    for (let v = 0; v <= Math.ceil(max / paso) * paso; v += paso) g += `<line x1="${ml}" x2="${W}" y1="${Y(v)}" y2="${Y(v)}" class="bg-red"/><text x="${ml - 6}" y="${Y(v) + 4}" text-anchor="end" class="bg-eje">${v}</text>`;
    const enSel = (a) => pubFil.y0 == null || (a >= pubFil.y0 && a <= pubFil.y1);
    anios.forEach((a, i) => {
      const x = ml + i * bw + 1.5, w = Math.max(2, bw - 3), d = anim ? ` style="--d:${Math.round(i * 18)}ms"` : '';
      let marca = '';
      if (bibModo === 'cuartil') {
        let tope = Y(0);
        for (const [c] of CU) { const k = porA[a][c] || 0; if (!k) continue; const alto = Y(0) - Y(k); marca += `<rect x="${x}" y="${tope - alto}" width="${w}" height="${Math.max(1, alto - 1.5)}" fill="${colorCu(c)}" rx="1.5"/>`; tope -= alto; }
      } else if (bibModo === 'citas') {
        const v = cit(a); if (v) marca = `<rect x="${x}" y="${Y(v)}" width="${w}" height="${Y(0) - Y(v)}" fill="var(--rojo)" rx="1.5"/>`;
      }
      g += `<g class="bg-col ${enSel(a) ? '' : 'apag'}" data-y="${a}"><rect class="bg-hit" x="${ml + i * bw}" y="${mt}" width="${bw}" height="${H - mt}"/><g class="bg-m"${d}>${marca}</g>${a % 5 === 0 || n < 16 ? `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle" class="bg-eje">${a}</text>` : ''}</g>`;
    });
    if (bibModo === 'h') {
      const pts = anios.filter((a) => hA[a] != null).map((a) => [ml + anios.indexOf(a) * bw + bw / 2, Y(hA[a]), a]);
      if (pts.length) g += `<path d="M${pts.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L')}" class="bg-lin ${anim ? 'dib' : ''}"/>${pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" class="bg-pt"/>`).join('')}<text x="${pts[pts.length - 1][0] - 8}" y="${pts[pts.length - 1][1] - 10}" text-anchor="end" class="bg-val">h = ${hA[pts[pts.length - 1][2]]}</text>`;
    }
    const ley = bibModo === 'cuartil' ? `<div class="bg-ley">${CU.map(([c, t, col]) => `<button class="bg-li ${pubFil.cu === c ? 'on' : ''}" data-cu="${c}"><i style="background:${col}"></i>${esc(c.startsWith('Q') ? t : c === 'sq' ? 'Sin cuartil ese año' : 'Fuera de SJR')}</button>`).join('')}</div>` : `<p class="bg-nota">${bibModo === 'citas' ? `Citas recibidas cada año por todos tus trabajos (OpenAlex). ${new Date().getFullYear()}: año en curso.` : 'Índice h al final de cada año, calculado con las citas año a año de cada trabajo (OpenAlex, desde 2012).'}</p>`;
    const rango = pubFil.y0 != null ? `<span class="bg-ran">${pubFil.y0 === pubFil.y1 ? pubFil.y0 : pubFil.y0 + '–' + pubFil.y1} <button data-quita="y" aria-label="Quitar el filtro de años">×</button></span>` : '<span class="bg-ayu">Pulsa un año o arrastra sobre varios para filtrar la lista</span>';
    const graf = `<div class="bg"><div class="bg-cab"><div class="bg-tabs" role="tablist">${Object.entries(MODOS).map(([k, t]) => `<button role="tab" aria-selected="${bibModo === k}" class="${bibModo === k ? 'on' : ''}" data-modo="${k}">${t}</button>`).join('')}</div>${rango}</div>
      <svg viewBox="0 0 ${W} ${H}" class="bg-svg ${anim ? 'anim' : ''}" role="img" aria-label="${MODOS[bibModo]} por año">${g}</svg>${ley}<div class="bib-tip" hidden></div></div>`;
    // --- Distribución por cuartil ---
    const totB = base.length || 1;
    const distQ = `<div class="bc"><h3>Cuartil de la revista (SJR, año de publicación)</h3><div class="dq-bar">${CU.map(([c]) => (cls[c] ? `<i style="width:${(cls[c] / totB) * 100}%;background:${colorCu(c)}" title="${c}"></i>` : '')).join('')}</div>
      <ol class="dq">${CU.map(([c, t, col]) => `<li><button class="${pubFil.cu === c ? 'on' : ''}" data-cu="${c}"><i style="background:${col}"></i><span>${esc(t)}</span><b>${fnum(cls[c] || 0)}</b><em>${fnum(((cls[c] || 0) / totB) * 100)} %</em></button></li>`).join('')}</ol></div>`;
    // --- Revistas principales ---
    const rv = {}; base.forEach((m) => { const x = cuartilDe(m); if (x.c === 'fuera' || !x.rev) return; (rv[x.rev] = rv[x.rev] || { n: 0, q: {} }).n++; rv[x.rev].q[x.c] = (rv[x.rev].q[x.c] || 0) + 1; });
    const topR = Object.entries(rv).sort((a, b) => b[1].n - a[1].n).slice(0, 8), maxR = Math.max(1, ...topR.map((r) => r[1].n));
    const mejor = (q) => ['Q1', 'Q2', 'Q3', 'Q4'].filter((c) => q[c]).sort((a, b) => q[b] - q[a])[0] || ''; // el cuartil más frecuente de tus artículos en esa revista
    const revs = `<div class="bc"><h3>Revistas principales</h3><ol class="br">${topR.map(([t, r]) => `<li><button class="${pubFil.rev === t ? 'on' : ''}" data-rev="${esc(t)}" title="${esc(t)}${mejor(r.q) ? ' · ' + ['Q1', 'Q2', 'Q3', 'Q4'].filter((c) => r.q[c]).map((c) => c + ': ' + r.q[c]).join(', ') : ''}"><span>${esc(t)}</span>${mejor(r.q) ? `<em class="qc" style="background:${colorCu(mejor(r.q))};color:${/Q[12]/.test(mejor(r.q)) ? '#fff' : 'var(--azul)'}">${mejor(r.q)}</em>` : '<em></em>'}<i style="width:${Math.round((r.n / maxR) * 100)}%"></i><b>${r.n}</b></button></li>`).join('')}</ol></div>`;
    // --- Liderazgo y colaboración (OpenAlex, artículos y revisiones) ---
    const na = art.length || 1;
    const prim = art.filter((o) => o.pos === 1).length, ult = art.filter((o) => o.pos && o.nAut && o.pos === o.nAut && o.nAut > 1).length;
    const corrV = new Set(); vis.forEach((m) => { const o = obraDe(m); if (o && esCorr(m)) corrV.add(o); });
    const corr = art.filter((o) => o.corr || corrV.has(o)).length; // PDF del artículo u OpenAlex
    const intl = art.filter((o) => (o.paises || []).some((p) => p !== 'ES')).length;
    const pais = {}; art.forEach((o) => (o.paises || []).forEach((p) => { if (p !== 'ES') pais[p] = (pais[p] || 0) + 1; }));
    let nomP = (c) => c; try { const dn = new Intl.DisplayNames(['es'], { type: 'region' }); nomP = (c) => dn.of(c); } catch { /* sin nombres */ }
    const barra = (t, k) => `<li><span>${t}</span><i><b style="width:${(k / na) * 100}%"></b></i><em>${fnum((k / na) * 100)} %</em></li>`;
    const lid = `<div class="bc"><h3>Liderazgo y colaboración</h3><ol class="bl">${barra('Primer autor', prim)}${barra('Último autor (dirección)', ult)}${barra('Autor de correspondencia (PDF u OpenAlex)', corr)}${barra('Con coautores de otros países', intl)}</ol>
      <p class="bpa">${Object.entries(pais).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, k]) => `<span>${esc(nomP(c))} <b>${k}</b></span>`).join('')}</p><p class="bc-n">Sobre ${fnum(art.length)} artículos y revisiones de OpenAlex.</p></div>`;
    // --- Los más citados ---
    const deObra = new Map(); vis.forEach((m) => { const o = obraDe(m); if (o && !deObra.has(o)) deObra.set(o, m); });
    const topC = [...B.obras].sort((a, b) => b.citas - a.citas).slice(0, 6);
    const masC = `<div class="bc ancha"><h3>Los trabajos más citados</h3><ol class="bm">${topC.map((o, i) => { const m = deObra.get(o); return `<li><button ${m ? `data-irm="${m.id}"` : o.doi ? `data-url="https://doi.org/${esc(o.doi)}"` : ''}><span class="bm-n">${i + 1}</span><span class="bm-t"><b>${esc(o.titulo)}</b><small>${esc(o.revista || '')}${o.anio ? ' · ' + o.anio : ''}</small></span><span class="bm-c"><strong>${fnum(o.citas)}</strong> citas${o.fwci != null ? `<small>FWCI ${fnum(o.fwci, 1)}</small>` : ''}${o.top1 ? '<em class="bm-top">Top 1 %</em>' : o.top10 ? '<em class="bm-top t10">Top 10 %</em>' : ''}</span></button></li>`; }).join('')}</ol></div>`;
    const fecha = new Date(B.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    const S = B.sjr;
    return `${falta}<section class="bib ${anim ? 'entra' : ''}">${kpis}${graf}<div class="bib-g">${distQ}${revs}${lid}${masC}</div>
      <p class="bib-f">Fuentes: OpenAlex (citas, índice h, FWCI, percentiles y autoría), datos a ${fecha}${S ? `. Cuartiles: ${esc(S.fuente)}, cuartil de la revista en el año de publicación (las de ${S.y1 + 1} usan el SJR ${S.y1}, el último publicado)` : ''}. El CVN no se usa para estas cifras.${trabajo ? ' <button class="bs" id="bibAct">Actualizar desde OpenAlex</button>' : ''}</p></section>`;
  }
  // Animaciones: las cifras cuentan desde cero y las barras crecen, solo la primera vez que se abre el apartado.
  function animarBiblio(caja) {
    if (!bibAnimar) return;
    bibAnimar = false;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t0 = performance.now(), D = 1100;
    const els = $$('.kpi strong[data-n]', caja);
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      els.forEach((s) => { s.textContent = fnum(+s.dataset.n * e, +s.dataset.d); });
      if (k < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
    // Si la ventana no está a la vista, el navegador pausa la animación: las cifras quedan en su valor real igualmente.
    setTimeout(() => els.forEach((s) => { s.textContent = fnum(+s.dataset.n, +s.dataset.d); }), D + 150);
  }
  function ligarGrafico(caja) {
    const bg = $('.bg', caja);
    if (!bg) return;
    const svg = $('svg', bg), tip = $('.bib-tip', bg), B = BIB();
    const vis = filtrarPubs(todasDe('6.2').filter(publico), true);
    const hA = bibModo === 'h' ? hPorAnio(B) : null;
    const info = (a) => {
      if (bibModo === 'citas') return `<b>${a}</b>${fnum((B.porAnio[a] || {}).c || 0)} citas`;
      if (bibModo === 'h') return `<b>${a}</b>${hA[a] != null ? 'índice h ' + hA[a] : 'sin desglose de citas'}`;
      const l = vis.filter((m) => anioDe(m) === a), k = {}; l.forEach((m) => { const c = cuartilDe(m).c; k[c] = (k[c] || 0) + 1; });
      return `<b>${a} · ${l.length} ${l.length === 1 ? 'publicación' : 'publicaciones'}</b>${CU.filter(([c]) => k[c]).map(([c, t, col]) => `<span><i style="background:${col}"></i>${c.startsWith('Q') ? c : c === 'sq' ? 'Sin cuartil' : 'Fuera de SJR'} ${k[c]}</span>`).join('')}`;
    };
    let ini = null, arr = false;
    const colDe = (e) => e.target.closest('[data-y]');
    const marcar = (a, b) => { $$('[data-y]', svg).forEach((c) => { const y = +c.dataset.y; c.classList.toggle('apag', !(y >= Math.min(a, b) && y <= Math.max(a, b))); }); };
    svg.onpointermove = (e) => {
      const c = colDe(e);
      if (!c) { tip.hidden = true; return; }
      const a = +c.dataset.y;
      tip.innerHTML = info(a); tip.hidden = false;
      const r = bg.getBoundingClientRect();
      tip.style.left = Math.min(r.width - tip.offsetWidth - 4, Math.max(4, e.clientX - r.left + 14)) + 'px';
      tip.style.top = Math.max(4, e.clientY - r.top - tip.offsetHeight - 10) + 'px';
      if (ini != null) { arr = arr || a !== ini; marcar(ini, a); }
    };
    svg.onpointerleave = () => { tip.hidden = true; };
    svg.onpointerdown = (e) => { const c = colDe(e); if (!c) return; ini = +c.dataset.y; arr = false; svg.setPointerCapture(e.pointerId); };
    svg.onpointerup = (e) => {
      if (ini == null) return;
      const c = document.elementFromPoint(e.clientX, e.clientY), g2 = c && c.closest && c.closest('[data-y]');
      const fin = g2 ? +g2.dataset.y : ini, a = Math.min(ini, fin), b = Math.max(ini, fin);
      ini = null;
      if (!arr && pubFil.y0 === a && pubFil.y1 === b) { pubFil.y0 = pubFil.y1 = null; } else { pubFil.y0 = a; pubFil.y1 = b; }
      pintarLista();
    };
  }
  const yoRe = /((Jos[eé]\s+)?Pino[\s‐-]+Ortega(,\s*J(os[eé])?\.?)?|Pino[‐-]Ortega,?\s*J\.?)/gi;
  function htmlPub(m) {
    if (pubAbiertas.has(m.id)) return htmlMerito(m).replace('<div class="tx">', `<div class="tx"><button class="pmas" data-menos="${m.id}">Ver ficha resumida</button>`);
    const o = obraDe(m), Q = cuartilDe(m);
    const cita = (m.filas.flat().find((p) => !p.e) || {}).v || m.t;
    const doi = (o && o.doi) || celdaDe(m, /^DOI$/i) || ''; // primero OpenAlex
    const titulo = (o && o.titulo) || m.t;
    let autores = o ? o.autores.join('; ') : '';
    if (!autores) { const i = cita.indexOf('. '); autores = i > 0 && i < 400 ? cita.slice(0, i) : ''; }
    const revista = (o && o.revista) || Q.rev || '';
    const anio = Q.y || m.anio;
    const pos = o && o.pos, tot = o && o.nAut; // solo OpenAlex
    const chip = (t, cl = '', st = '', ti = '') => `<span class="pch ${cl}"${st ? ` style="${st}"` : ''}${ti ? ` title="${esc(ti)}"` : ''}>${t}</span>`;
    const qChip = /^Q/.test(Q.c) ? chip(`${Q.c} · SJR`, 'qsjr', `background:${colorCu(Q.c)};color:${/Q[12]/.test(Q.c) ? '#fff' : 'var(--azul)'}`, `Cuartil de «${Q.rev}» en el SJR de ${Math.min(anio, ((BIB() || {}).sjr || {}).y1 || anio)}`) : '';
    const chips = [anio ? chip(esc(anio)) : '', qChip, o ? chip(`${fnum(o.citas)} citas`) : '', o && o.fwci != null ? chip(`FWCI ${fnum(o.fwci, 2)}`, '', '', 'Impacto normalizado por campo y año (OpenAlex). 1 = media mundial.') : '', o && o.top1 ? chip('Top 1 % mundial', 'top') : o && o.top10 ? chip('Top 10 % mundial', 'top t10') : '', esCorr(m) ? chip('Autor de correspondencia', 'co') : '', pos ? chip(`Firma ${esc(pos)}${tot ? ' de ' + esc(tot) : ''}`) : '', o && o.oa ? chip('Acceso abierto', 'oa') : ''].join('');
    const aut = esc(autores).replace(yoRe, '<b>$1</b>');
    return `<article class="merito pub ${sel === m.id ? 'on' : ''} ${m.privado ? 'oculto' : ''}" data-id="${m.id}"><div class="doc">${esc((numVista && numVista.get(m.id)) || m.n || '')}</div><div class="tx">
      <p class="pt">${esc(titulo)}</p>${aut ? `<p class="pa">${aut}</p>` : ''}${revista ? `<p class="pr">${esc(revista)}</p>` : ''}
      <div class="pcs">${chips}${doi ? `<a href="#" class="pch doi" data-url="https://doi.org/${esc(doi.replace(/^https?:\/\/doi\.org\//i, ''))}">DOI</a>` : ''}</div>
      ${htmlPdfs(m)}<button class="pmas" data-mas="${m.id}">Ficha completa${trabajo ? ' y edición' : ''}</button></div></article>`;
  }
  function ligarPubs(caja) {
    const q = $('#pfQ'); if (q) q.oninput = () => { pubFil.q = q.value; clearTimeout(q.t); q.t = setTimeout(() => { pintarLista(); const n = $('#pfQ'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } }, 250); };
    $$('[data-pf]', caja).forEach((b) => { b.onclick = () => { pubFil.f = b.dataset.pf; pintarLista(); }; });
    $$('[data-modo]', caja).forEach((b) => { b.onclick = () => { bibModo = b.dataset.modo; pintarLista(); }; });
    $$('[data-cu]', caja).forEach((b) => { b.onclick = () => { pubFil.cu = pubFil.cu === b.dataset.cu ? null : b.dataset.cu; pintarLista(); }; });
    $$('[data-rev]', caja).forEach((b) => { b.onclick = () => { pubFil.rev = pubFil.rev === b.dataset.rev ? null : b.dataset.rev; pintarLista(); }; });
    $$('[data-quita]', caja).forEach((b) => {
      b.onclick = () => { const k = b.dataset.quita; if (k === 'y' || k === 'todo') pubFil.y0 = pubFil.y1 = null; if (k === 'cu' || k === 'todo') pubFil.cu = null; if (k === 'rev' || k === 'todo') pubFil.rev = null; pintarLista(); };
    });
    $$('[data-irm]', caja).forEach((b) => { b.onclick = () => irMerito(b.dataset.irm); });
    $$('[data-mas]', caja).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); pubAbiertas.add(+b.dataset.mas); pintarLista(); }; });
    $$('[data-menos]', caja).forEach((b) => { b.onclick = (e) => { e.stopPropagation(); pubAbiertas.delete(+b.dataset.menos); pintarLista(); }; });
    const bf = $('#bFaltan'); if (bf) bf.onclick = () => irClasificar('openalex');
    const ba = $('#bibAct'); if (ba) ba.onclick = actualizarOA;
    ligarGrafico(caja);
    animarBiblio(caja);
  }
  async function actualizarOA() {
    aviso('Leyendo tus datos de OpenAlex…');
    const r = await window.api.openalex();
    if (r.error) { aviso(r.error, { mal: true }); return; }
    P = r.paquete; mapaObras = null; mapaSjr = null; bibAnimar = true;
    pintarCab(); pintarMenu(); marcarActivo(); pintarLista();
    aviso(`OpenAlex actualizado: ${fnum(P.biblio.trabajos)} trabajos y ${fnum(P.biblio.citas)} citas.`);
  }
  // ---------- Completar y clasificar méritos ----------
  var clas = null;
  const NOMCL = { c0: 'Méritos que no están en el CVN', openalex: 'Publicaciones de OpenAlex que faltan', sueltos: 'Documentos sin clasificar', disco: 'Carpeta de origen' };
  async function irClasificar(fuente) {
    salirEditor();
    items.forEach((x) => x.classList.remove('activo'));
    actual = { c: '', opcion: '', bloque: '', clasif: fuente };
    sel = null; selSha = null; suelto = null; verNuevo = null;
    $('#lista').classList.remove('esinicio');
    $('#sel1').textContent = 'Completar y clasificar méritos';
    $('#sel2').textContent = NOMCL[fuente];
    clas = { fuente, lista: null, tab: 'alta', ver: 40, prog: 'Preparando…' };
    pintarLinea(); pintarVisor(); pintarLista();
    const r = await window.api.clasificar(fuente);
    if (!actual || actual.clasif !== fuente) return;
    if (r.error) { clas.error = r.error; pintarLista(); return; }
    clas.lista = r.lista.map((x) => ({ ...x, incluir: false, destino: x.entrada ? `id:${x.entrada.id}` : (x.cod || 'SC') }));
    clas.lista.forEach((x) => { if (x.destino.startsWith('id:')) return; const m = x.origen === 'c0' && !x.ficha && buscar(x.mid); x.filas = m ? m.filas.flat().map((p) => [p.e, p.v]) : filasPropuestas(x); });
    clas.tab = ['alta', 'media', 'baja', 'fuera'].find((t) => clas.lista.some((x) => x.conf === t)) || 'alta';
    pintarLista();
  }
  if (!CONSULTA) window.api.alProgresoClas((p) => {
    const t = esc(p.fase) + (p.n ? ` (${fnum(p.i)} de ${fnum(p.n)})` : '');
    if (clas && !clas.lista) { clas.prog = t; const e = $('#clProg'); if (e) e.innerHTML = t + (p.n ? `<progress max="${p.n}" value="${p.i}"></progress>` : ''); }
  });
  function pintarClasif() {
    const caja = $('#meritos');
    if (clas.error) { caja.innerHTML = `<p class="vacio">${esc(clas.error)}</p><button class="bs" id="clRe">Intentarlo de nuevo</button>`; $('#clRe').onclick = () => irClasificar(clas.fuente); return; }
    if (!clas.lista) { caja.innerHTML = `<p class="cuenta">Analizando… La primera vez tarda (lee cada PDF); después recuerda lo leído y va mucho más rápido.</p><div id="clProg" class="clprog">${clas.prog}</div>`; return; }
    const L = clas.lista;
    if (!L.length) { caja.innerHTML = '<p class="vacio">No hay nada nuevo que proponer. Todo lo que hay ya está en tu CV.</p>'; return; }
    const TABS = [['alta', 'Seguridad alta'], ['media', 'Seguridad media'], ['baja', 'Seguridad baja'], ['fuera', 'Aparte']];
    const cnt = (t) => L.filter((x) => x.conf === t).length;
    const vis = L.filter((x) => x.conf === clas.tab);
    const conf = L.filter((x) => x.incluir).length;
    const nConfTab = vis.filter((x) => x.incluir).length;
    const card = (x) => {
      const k = L.indexOf(x);
      const verBtn = x.ruta || x.archivo || x.verArchivo ? '<button class="bs rojo" data-ver>Ver</button>' : x.doi ? `<a href="#" class="bs rojo" data-url="https://doi.org/${esc(x.doi)}">DOI</a>` : '';
      return `<article class="nuevo ${verNuevo && verNuevo === (x.ruta || x.archivo) ? 'on' : ''}" data-k="${k}">
        <div class="nmed"><div class="nfila"><b>${esc(x.origen === 'openalex' ? x.titulo : x.nombre)}</b>${verBtn}</div>
        <p class="cmot c-${x.conf}">${esc(x.motivo || '')}</p>${x.pista ? `<p class="cpis">${esc(x.pista)}</p>` : ''}
        <label class="ncam"><span>Va en</span><select data-dest>${opcionesDestino(x)}</select></label>
        ${x.destino.startsWith('id:') ? `<p class="cuenta">Se añade como documento de la entrada nº ${x.entrada.n}: «${esc(String(x.entrada.t).slice(0, 140))}». Su texto no cambia.</p>` : x.destino === 'SC' ? '' : `<div class="ntx"><span class="ntx-t">Texto que se escribirá en «${esc(nombreDe(x.destino))}»${x.ficha ? ' <i>(datos de OpenAlex)</i>' : ''}</span>${(x.filas || []).map(([e, v], j) => `<div class="ntf"><input data-fe="${j}" value="${esc(e)}" placeholder="Etiqueta" aria-label="Etiqueta"><textarea data-fv="${j}" rows="${Math.min(5, Math.max(1, Math.ceil(String(v).length / 80)))}" aria-label="Valor">${esc(v)}</textarea><button class="mini mal" data-fx="${j}" aria-label="Quitar esta fila">×</button></div>`).join('')}<button class="mini" data-fa>+ Fila</button></div>`}
        ${x.destino === 'SC' ? '' : `<label class="nconf"><input type="checkbox" data-inc ${x.incluir ? 'checked' : ''}> Confirmo que este mérito está bien ubicado y su texto es correcto</label>`}
        </div></article>`;
    };
    caja.innerHTML = `<p class="cuenta">${fnum(L.length)} propuestas. Revisa dónde va cada una y marca «Confirmo». Nada cambia hasta que pulses «Incorporar».${clas.fuente === 'disco' ? ' Los archivos del disco se copian; los originales no se tocan.' : ''}</p>
      <div class="ctabs">${TABS.map(([t, n]) => `<button class="${clas.tab === t ? 'on' : ''}" data-tab="${t}">${n} <small>${cnt(t)}</small></button>`).join('')}</div>
      ${clas.tab === 'alta' && vis.length ? `<div class="call"><span>Seguridad alta: el DOI o el texto coinciden con tu CV, o la publicación viene de OpenAlex.</span><button class="bs" id="clTodos">${nConfTab === vis.length ? 'Quitar todas las confirmaciones' : `Confirmar las ${vis.length} de esta pestaña`}</button></div>` : ''}
      ${clas.tab === 'fuera' ? '<p class="cuenta">No se proponen: no se sabe dónde van, están en carpetas de trabajo o serían otra versión de un documento que ya está. Si alguno sí es un mérito, elige su apartado.</p>' : ''}
      ${vis.slice(0, clas.ver).map(card).join('')}
      ${vis.length > clas.ver ? `<button class="add" id="clMas">Ver ${Math.min(40, vis.length - clas.ver)} más (quedan ${vis.length - clas.ver})</button>` : ''}
      <div class="nfin"><button class="bs prim" id="clInc" ${conf ? '' : 'disabled'}>Incorporar los confirmados (${conf})</button><button class="bs" id="clRe">Volver a analizar</button></div>`;
    $$('[data-tab]', caja).forEach((b) => { b.onclick = () => { clas.tab = b.dataset.tab; clas.ver = 40; pintarLista(); $('#lista').scrollTop = 0; }; });
    const ct = $('#clTodos'); if (ct) ct.onclick = () => { const on = nConfTab !== vis.length; vis.forEach((x) => { x.incluir = on && x.destino !== 'SC'; }); pintarLista(); };
    const cm = $('#clMas'); if (cm) cm.onclick = () => { clas.ver += 40; pintarLista(); };
    $('#clRe').onclick = () => irClasificar(clas.fuente);
    $$('.nuevo', caja).forEach((e) => {
      const x = L[+e.dataset.k];
      const inc = $('[data-inc]', e); if (inc) inc.onchange = () => { x.incluir = inc.checked; pintarLista(); };
      $('[data-dest]', e).onchange = (ev) => { x.destino = ev.target.value; x.incluir = false; if (!x.destino.startsWith('id:')) x.filas = filasPropuestas(x); pintarLista(); };
      $$('[data-fe]', e).forEach((i) => { i.oninput = () => { x.filas[+i.dataset.fe][0] = i.value; }; });
      $$('[data-fv]', e).forEach((i) => { i.oninput = () => { x.filas[+i.dataset.fv][1] = i.value; }; });
      $$('[data-fx]', e).forEach((b) => { b.onclick = () => { x.filas.splice(+b.dataset.fx, 1); pintarLista(); }; });
      const fa = $('[data-fa]', e); if (fa) fa.onclick = () => { x.filas.push(['', '']); pintarLista(); };
      const v = $('[data-ver]', e); if (v) v.onclick = () => { verNuevo = x.ruta && x.origen === 'disco' ? x.ruta : (x.archivo || x.verArchivo); $$('.nuevo', caja).forEach((o) => o.classList.toggle('on', o === e)); pintarVisor(); };
    });
    ligarEnlaces(caja);
    $('#clInc').onclick = async () => {
      $('#clInc').disabled = true;
      const elegidos = L.filter((x) => x.incluir && x.destino !== 'SC');
      const lista = elegidos.map((x) => {
        const b = { origen: x.origen, ruta: x.ruta, pista: x.pista, archivo: x.archivo, titulo: x.titulo, mid: x.mid, privado: !!x.privado };
        return x.destino.startsWith('id:') ? { ...b, id: +x.destino.slice(3) } : { ...b, cod: x.destino, filas: (x.filas || []).filter(([, v]) => String(v).trim()).map(([e, v]) => [{ e, v }]) };
      });
      verNuevo = null;
      const r = await op('colocarLista', { lista });
      if (!r) { const b = $('#clInc'); if (b) b.disabled = false; return; }
      clas.lista = L.filter((x) => !elegidos.includes(x));
      actual = { c: '', opcion: '', bloque: '', clasif: clas.fuente };
      $('#sel1').textContent = 'Completar y clasificar méritos'; $('#sel2').textContent = NOMCL[clas.fuente];
      pintarLista(); pintarVisor();
      aviso(`Incorporados: ${r.colocados}${r.repetidos ? ` (${r.repetidos} ya estaban)` : ''}${r.fallos && r.fallos.length ? `. ${r.fallos.length} no se han podido colocar y siguen en la lista` : ''}. Puedes deshacerlo con «Deshacer».`, { des: true, mal: !!(r.fallos && r.fallos.length) });
      if (r.fallos && r.fallos.length) window.__fallos = r.fallos;
    };
  }
  async function pintarOrigenAj() {
    const t = $('#orTx'); if (!t || CONSULTA) return;
    const r = await window.api.origen('ver');
    t.innerHTML = r.carpeta ? `<span class="nu-r" title="${esc(r.carpeta)}">${esc(r.carpeta)}</span>${r.existe ? '' : '<span class="orno">No está conectada. Conecta el disco o elige otra carpeta.</span>'}` : 'Aún no has elegido la carpeta donde guardas tus méritos.';
    const b = $('[data-cl="disco"]'); if (b) b.disabled = !r.existe;
  }
  function pintarAjustes() {
    const caja = $('#meritos');
    const salida = [
      ['html', 'Versión HTML', 'Se abre en cualquier navegador con doble clic en index.html. No hay que instalar nada.'],
      ['pc', 'Ejecutable para PC', 'Programa de Windows, solo consulta. Windows puede avisar porque no lleva firma.'],
      ['mac', 'Ejecutable para Mac', 'Crea dos archivos: Apple Silicon e Intel. Sin firma de Apple; pruébalo en un Mac antes de entregarlo.'],
      ['zip', 'ZIP completo', 'Todas las carpetas y los PDF confirmados, con el índice de documentos.'],
      ['carpeta', 'Carpeta del CV', 'Las mismas carpetas y subcarpetas, en el orden del CVN, con los PDF justificativos y el CV en Word. Sin comprimir.'],
      ['word', 'CV en Word (formato CVN)', 'Un .docx con los títulos, epígrafes y orden del CVN, listo para revisar o imprimir.'],
    ];
    const oc = P.datos.ocultos || [];
    const vert = (P.ajustes.menu || 'horizontal') === 'vertical';
    const cerrado = P.ajustes.cerrado;
    const pend = P.datos.meritos.filter((m) => !m.nota && !m.dato && m.cod !== 'SC' && (!m.pdfs.length || m.pdfs.some((p) => p.nivel !== 'alta'))).length;
    caja.innerHTML = `<section class="aj" data-sec="publicar" id="secPub"><h2>Publicar en la web</h2><p class="cuenta">El tribunal entra con un enlace y una clave. Todo va cifrado: sin la clave no se puede leer nada.</p><div id="pubCaja"><p class="cuenta">Cargando…</p></div></section>
      <section class="aj" data-sec="generar"><h2>Generar versiones</h2><p class="cuenta">Salen como en la vista Tribunal. Elige una carpeta de ruta corta, como el Escritorio o un pendrive.${pend ? ` Ahora mismo, ${pend.toLocaleString('es-ES')} méritos no tienen un PDF confirmado.` : ''}</p>
        <div class="tarjs">${salida.map(([k, t, d]) => `<article class="tarj"><h3>${t}</h3><p>${d}</p><button class="bs prim" data-g="${k}">Generar</button></article>`).join('')}</div><div id="prog" role="status"></div></section>
      <section class="aj" data-sec="clasificar"><h2>Completar y clasificar méritos</h2><p class="cuenta">El programa lee, compara y propone. Tú confirmas mérito a mérito (o todos los de seguridad alta de una vez).</p>
        <div class="tarjs">
          <article class="tarj"><h3>Publicaciones de OpenAlex</h3><p>${P.biblio ? `${P.faltan} ${P.faltan === 1 ? 'publicación está' : 'publicaciones están'} en OpenAlex y no en tu CV. Datos del ${new Date(P.biblio.fecha).toLocaleDateString('es-ES')}.` : 'Trae tus datos de OpenAlex: citas, índice h y las publicaciones que faltan en el CV.'}</p><div class="fil"><button class="bs prim" data-cl="openalex" ${P.biblio && P.faltan ? '' : 'disabled'}>Revisar</button><button class="bs" id="ajOA">${P.biblio ? 'Actualizar' : 'Traer datos'}</button></div></article>
          <article class="tarj"><h3>Méritos fuera del CVN</h3><p>${P.datos.meritos.filter((m) => m.cod === 'C.0').length.toLocaleString('es-ES')} méritos de tu Word están en «Méritos que no están en el CVN», ocultos al tribunal. Los que son publicaciones pasan a su apartado con el texto de OpenAlex.</p><div class="fil"><button class="bs prim" data-cl="c0" ${P.datos.meritos.some((m) => m.cod === 'C.0') ? '' : 'disabled'}>Revisar</button></div></article>
          <article class="tarj"><h3>Documentos sin clasificar</h3><p>${(P.datos.sin_merito.length).toLocaleString('es-ES')} PDF de tu expediente no están en ningún mérito. Se proponen por su DOI, su texto y la carpeta de donde vinieron.</p><div class="fil"><button class="bs prim" data-cl="sueltos" ${P.datos.sin_merito.length ? '' : 'disabled'}>Clasificar</button></div></article>
          <article class="tarj"><h3>Carpeta de origen</h3><p id="orTx">…</p><div class="fil"><button class="bs prim" data-cl="disco">Analizar la carpeta</button><button class="bs" id="orCam">Cambiar…</button></div></article>
        </div></section>
      <section class="aj" data-sec="busqueda"><h2>Carpetas de búsqueda de justificantes</h2><p class="cuenta">«Buscar justificantes» mira en todas estas carpetas. Tras añadir una, pulsa «Leer documentos» para que el programa lea sus PDF (solo la primera vez; luego lee únicamente los nuevos).</p><div id="buCaja"><p class="cuenta">Cargando…</p></div><div class="fil"><button class="bs prim" id="buAdd">+ Añadir carpeta</button><button class="bs" id="buLeer">Leer documentos</button></div></section>
      <section class="aj" data-sec="nuevos"><h2>Incorporar méritos nuevos</h2><p class="cuenta">Indica la carpeta donde están los PDF nuevos. El programa los lee, propone en qué apartado va cada uno y escribe su texto. Nada se incorpora hasta que lo revisas y lo confirmas mérito a mérito.</p><div id="nuCaja"><p class="cuenta">Cargando…</p></div></section>
      <section class="aj" data-sec="menu"><h2>Menú</h2><div class="opc" role="group" aria-label="Menú"><button data-m="vertical" class="${vert ? 'on' : ''}">Vertical</button><button data-m="horizontal" class="${vert ? '' : 'on'}">Horizontal</button></div></section>
      <section class="aj" data-sec="cerrar"><h2>Cerrar expediente</h2><p class="cuenta">${cerrado ? `Cerrado el ${new Date(cerrado).toLocaleString('es-ES')}. No se puede modificar.` : 'Los números quedan fijos y no se puede modificar nada hasta que lo reabras.'}</p><button class="bs ${cerrado ? '' : 'mal'}" id="bCierra">${cerrado ? 'Reabrir expediente' : 'Cerrar expediente'}</button></section>
      <section class="aj" data-sec="documentos"><h2>Documentos sin usar</h2><p class="cuenta">${P.datos.sin_merito.length.toLocaleString('es-ES')} PDF de tu carpeta no están en ningún mérito. No salen en lo que entregues.</p><button class="bs" id="bVerSC">Verlos y colocarlos</button></section>
      <section class="aj" data-sec="apartados"><h2>Apartados eliminados</h2>${oc.length ? oc.map((c) => `<div class="fila"><span style="flex:1">${esc(nombreDe(c))}</span><button class="bs" data-res="${esc(c)}">Recuperar</button></div>`).join('') : '<p class="cuenta">No has eliminado ninguno.</p>'}</section>`;
    $$('[data-g]', caja).forEach((b) => { b.onclick = () => generar(b.dataset.g); });
    pintarCarpetaNuevos();
    pintarOrigenAj();
    pintarBusqueda();
    $$('[data-cl]', caja).forEach((b) => { b.onclick = () => irClasificar(b.dataset.cl); });
    const aOA = $('#ajOA'); if (aOA) aOA.onclick = async () => { await actualizarOA(); };
    const oC = $('#orCam'); if (oC) oC.onclick = async () => { const r = await window.api.origen('elegir'); if (!r.cancelado) pintarOrigenAj(); };
    $$('[data-m]', caja).forEach((b) => { b.onclick = async () => { const r = await window.api.ajuste('menu', b.dataset.m); if (r.paquete) P = r.paquete; pintarCab(); pintarMenu(); marcarActivo(); pintarAjustes(); }; });
    $('#bCierra').onclick = async () => { const r = await window.api.ajuste('cerrar', !P.ajustes.cerrado); if (r.paquete) P = r.paquete; pintarAjustes(); aviso(P.ajustes.cerrado ? 'Expediente cerrado' : 'Expediente reabierto'); };
    $('#bVerSC').onclick = () => elegir(null, 'SC', 'Sin clasificar');
    $$('[data-res]', caja).forEach((b) => { b.onclick = () => op('restaurarApartado', { cod: b.dataset.res }, 'Apartado recuperado.'); });
    const O = (actual.opcion || '').toLowerCase();
    pintarPub();
    const sec = /publicar/.test(O) ? 'publicar' : /clasificar|completar/.test(O) ? 'clasificar' : /nuevos|incorporar/.test(O) ? 'nuevos' : /b[uú]squeda|justificantes/.test(O) ? 'busqueda' : /generar/.test(O) ? 'generar' : /men[uú]/.test(O) ? 'menu' : /cerrar/.test(O) ? 'cerrar' : /documentos/.test(O) ? 'documentos' : /apartados/.test(O) ? 'apartados' : null;
    if (sec) { const e = $(`[data-sec="${sec}"]`); if (e) e.scrollIntoView({ block: 'start' }); }
  }
  // ---------- Ajustes → Carpetas de búsqueda de justificantes (v0.17) ----------
  async function pintarBusqueda(r) {
    const caja = $('#buCaja'); if (!caja) return;
    r = r || await window.api.busqueda('ver');
    caja.innerHTML = r.carpetas.map((c) => `<div class="fila bu-f"><div style="flex:1;min-width:0"><b class="bu-n">${esc(c.carpeta)}</b><small class="cuenta">${c.origen ? 'Carpeta de origen · ' : ''}${c.existe ? `${c.total.toLocaleString('es-ES')} PDF · ${c.leidos === c.total ? 'todos leídos' : `${(c.total - c.leidos).toLocaleString('es-ES')} sin leer`}` : 'no encontrada (¿disco desconectado?)'}</small></div><button class="bs" data-buab="${esc(c.carpeta)}">Abrir</button>${c.origen ? '' : `<button class="bs mal" data-buq="${esc(c.carpeta)}">Quitar</button>`}</div>`).join('');
    $$('[data-buab]', caja).forEach((b) => { b.onclick = () => window.api.busqueda('abrir', b.dataset.buab); });
    $$('[data-buq]', caja).forEach((b) => { b.onclick = async () => pintarBusqueda(await window.api.busqueda('quitar', b.dataset.buq)); });
    const add = $('#buAdd'); if (add) add.onclick = async () => { const x = await window.api.busqueda('añadir'); if (!x.cancelado) pintarBusqueda(x); };
    const leer = $('#buLeer');
    if (leer) leer.onclick = async () => {
      leer.disabled = true; leer.textContent = 'Leyendo…';
      window.api.alProgresoBus((p) => { const b = $('#buLeer'); if (b) b.textContent = `Leyendo ${p.n} de ${p.total}…`; });
      const x = await window.api.busqueda('leer');
      leer.disabled = false; leer.textContent = 'Leer documentos';
      if (x.error) aviso(x.error); else { aviso('Documentos leídos.'); pintarBusqueda(x); }
    };
  }
  // ---------- Publicar en la web ----------
  let pubVer = false;
  const horaEs = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '');
  function lineaEstado(s) {
    const t = s.estado === 'publicando' ? `Publicando… ${s.texto || ''}` : s.estado === 'error' ? `No se ha podido publicar: ${s.texto}` : s.texto || (s.ultima ? `Última publicación: ${horaEs(s.ultima)}.` : 'Aún no se ha publicado.');
    return `<p class="pub-est ${s.estado === 'error' ? 'mal' : s.estado === 'listo' ? 'bien' : ''}" id="pubEst" role="status">${esc(t)}</p>`;
  }
  async function pintarPub() {
    const caja = $('#pubCaja');
    if (!caja || CONSULTA) return;
    const s = await window.api.estadoPub();
    if (!$('#pubCaja')) return;
    const auto = s.modo === 'auto';
    caja.innerHTML = `
      <div class="pub-fila"><span class="pub-et">Cuándo se publica</span><div class="opc" role="group" aria-label="Cuándo se publica"><button data-pm="manual" class="${auto ? '' : 'on'}">Manual</button><button data-pm="auto" class="${auto ? 'on' : ''}">Automático</button></div></div>
      <p class="cuenta">${auto ? 'Automático: cuando cambias algo, se publica solo a los 30 segundos.' : 'Manual: se publica cuando pulsas «Publicar ahora».'}</p>
      <div class="pub-fila"><label class="pub-et" for="pubClave">Clave de acceso</label><input id="pubClave" class="pub-in" type="${pubVer ? 'text' : 'password'}" value="${esc(s.clave || '')}" spellcheck="false" autocomplete="off"><button class="bs" id="pubVer">${pubVer ? 'Ocultar' : 'Mostrar'}</button><button class="bs" id="pubGuardaClave">Guardar clave</button></div>
      <p class="cuenta">Si cambias la clave, la anterior deja de servir: publica otra vez y envía la nueva al tribunal.</p>
      <div class="pub-fila"><span class="pub-et">Enlace para el tribunal</span>${s.url ? `<a href="#" data-url="${esc(s.url)}" class="pub-url">${esc(s.url)}</a><button class="bs" id="pubCopiar">Copiar enlace</button>` : '<span class="cuenta" style="margin:0">Aparecerá después de la primera publicación.</span>'}</div>
      <div class="pub-fila"><button class="bs prim pub-b" id="pubYa" ${s.estado === 'publicando' ? 'disabled' : ''}>Publicar ahora</button></div>
      ${lineaEstado(s)}
      ${s.grandes.length ? `<h3 class="pub-h3">Documentos demasiado grandes para la web</h3><p class="cuenta">Pasan de 95 MB. Pon el enlace donde está publicado (por ejemplo, el repositorio de la universidad): el tribunal lo abrirá desde ahí.</p>${s.grandes.map((g) => `<div class="pub-fila"><span class="pub-gr" title="${esc(g.rel)}">${esc(nomLimpio(g.rel))} · ${g.mb} MB</span><input class="pub-in" data-ext="${esc(g.rel)}" value="${esc(g.url)}" placeholder="https://…"><button class="bs" data-extg="${esc(g.rel)}">Guardar enlace</button></div>`).join('')}` : ''}`;
    $$('[data-pm]', caja).forEach((b) => { b.onclick = async () => { const r = await window.api.ajustePub({ modo: b.dataset.pm }); if (r.error) aviso(r.error, { mal: true }); pintarPub(); }; });
    $('#pubVer').onclick = () => { pubVer = !pubVer; const i = $('#pubClave'); i.type = pubVer ? 'text' : 'password'; $('#pubVer').textContent = pubVer ? 'Ocultar' : 'Mostrar'; };
    $('#pubGuardaClave').onclick = async () => {
      const v = $('#pubClave').value;
      if (v === s.clave) { aviso('La clave no ha cambiado.'); return; }
      if (s.clave && !confirm('¿Cambiar la clave? La anterior dejará de servir.')) return;
      const r = await window.api.ajustePub({ clave: v });
      if (r.error) aviso(r.error, { mal: true }); else aviso('Clave guardada. Publica para que se use.');
      pintarPub();
    };
    const bc = $('#pubCopiar'); if (bc) bc.onclick = async () => { try { await navigator.clipboard.writeText(s.url); aviso('Enlace copiado.'); } catch (e) { aviso('No se ha podido copiar.', { mal: true }); } };
    $('#pubYa').onclick = async () => { $('#pubYa').disabled = true; const r = await window.api.publicar(); if (r && r.error) aviso(r.error, { mal: true }); pintarPub(); };
    $$('[data-extg]', caja).forEach((b) => { b.onclick = async () => { const rel = b.dataset.extg; const i = $$('[data-ext]', caja).find((x) => x.dataset.ext === rel); const r = await window.api.ajustePub({ externo: { rel, url: i.value } }); if (r.error) aviso(r.error, { mal: true }); else aviso('Enlace guardado.'); }; });
    ligarEnlaces(caja);
  }
  if (!CONSULTA) pastillaWeb([[$('.cab'), false]], () => { const b = [...$$('#menu button')].find((x) => /Publicar en la web/.test(x.textContent)); if (b) b.click(); });
  if (!CONSULTA) window.api.alPublicacion((s) => {
    const e = $('#pubEst');
    if (e) { e.outerHTML = lineaEstado(s); const b = $('#pubYa'); if (b) b.disabled = s.estado === 'publicando'; }
    if (s.estado === 'listo' && $('#pubCaja')) pintarPub();
    if (s.estado === 'error' && !$('#pubCaja')) aviso('No se ha podido publicar en la web: ' + s.texto, { mal: true });
  });

  /* ---------- Enlace de la web, siempre a la vista (solo aquí, nunca en la versión del tribunal) ---------- */
  function pastillaWeb(contenedores, irAjustes) {
    const pills = contenedores.filter(Boolean).map(([caja, alPrincipio]) => {
      const e = document.createElement('div');
      e.className = 'web-pill';
      e.setAttribute('role', 'status');
      if (alPrincipio) caja.prepend(e); else caja.append(e);
      return e;
    });
    let ultimo = {};
    const pinta = (s) => {
      ultimo = { ...ultimo, ...s };
      const u = ultimo.url, corto = u ? u.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
      const hora = ultimo.ultima ? new Date(ultimo.ultima).toLocaleString('es-ES', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
      let cl = '', t = '', titulo = '';
      if (ultimo.estado === 'publicando') { cl = 'cambio'; t = 'Actualizando la web…'; titulo = ultimo.texto || ''; }
      else if (ultimo.estado === 'programado') { cl = 'cambio'; t = 'Cambios por publicar'; titulo = 'Se publicarán solos en unos segundos.'; }
      else if (ultimo.estado === 'error') { cl = 'mal'; t = 'No se ha podido publicar'; titulo = ultimo.texto || ''; }
      else if (u) { cl = 'bien'; t = 'En la web:'; titulo = hora ? `Publicado el ${hora}` : ''; }
      else { t = 'Aún sin publicar'; }
      pills.forEach((e) => {
        e.className = 'web-pill ' + cl;
        e.title = titulo;
        e.innerHTML = `<i></i><span class="wp-t"></span>${u && cl !== 'mal' ? '<span class="wp-u"></span><button class="wp-pri" data-wp="copiar">Copiar</button><button data-wp="abrir">Abrir</button>' : '<button data-wp="ajustes">Ajustes</button>'}`;
        e.querySelector('.wp-t').textContent = t;
        const su = e.querySelector('.wp-u'); if (su) su.textContent = corto;
        e.querySelectorAll('[data-wp]').forEach((b) => {
          b.onclick = async (ev) => {
            ev.stopPropagation();
            if (b.dataset.wp === 'copiar') { try { await navigator.clipboard.writeText(u); b.textContent = 'Copiado'; setTimeout(() => { b.textContent = 'Copiar'; }, 1600); } catch (x) { b.textContent = 'No se pudo'; } }
            else if (b.dataset.wp === 'abrir') window.open(u, '_blank');
            else irAjustes();
          };
        });
      });
    };
    window.api.estadoPub().then(pinta);
    window.api.alPublicacion(pinta);
  }
  async function generar(tipo) {
    if (generando) return;
    generando = true;
    $$('[data-g]').forEach((b) => { b.disabled = true; });
    $('#prog').textContent = 'Preparando…';
    const r = await window.api.generar(tipo);
    generando = false;
    $$('[data-g]').forEach((b) => { b.disabled = false; });
    if (r.cancelado) $('#prog').textContent = '';
    else if (r.error) { $('#prog').textContent = ''; aviso(r.error, { mal: true }); }
    else $('#prog').innerHTML = '<b>Listo.</b> ' + r.salida.map(esc).join('<br>');
  }
  if (!CONSULTA) window.api.alProgreso((p) => {
    const e = $('#prog');
    if (e && generando) e.innerHTML = esc(p.fase) + (p.n ? ` (${p.i} de ${p.n})<br><progress max="${p.n}" value="${p.i}"></progress>` : '');
  });
  // Documentos que aún no están en ningún mérito: se ven y se colocan desde aquí.
  const nomLimpio = (a) => a.split('/').pop().replace(/\.pdf$/i, '').replace(/_[0-9a-f]{6}$/i, '').replace(/^[0-9a-f]{6}_/i, '').replace(/_/g, ' ');
  const opcionesAp = () => MENU.flatMap(([, l]) => l || []).filter(([c, , h]) => c && h !== 'h' && c !== '1' && !(P.datos.ocultos || []).includes(c) && !(actual && (actual.cm || actual.c) === c)).map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join('');
  function pintarDocs() {
    const caja = $('#meritos');
    caja.insertAdjacentHTML('beforeend', `<h2 class="fh" id="dsTit"></h2><p class="cuenta">PDF de tu carpeta que aún no están en ningún mérito. Pulsa <b>Ver</b> para abrirlo al lado y <b>Poner en…</b> para colocarlo.</p><input id="dsFiltro" type="search" placeholder="Buscar por nombre de archivo" aria-label="Buscar documentos"><div id="dsLista"></div>`);
    const f = $('#dsFiltro');
    f.value = filtroDocs;
    f.oninput = () => { filtroDocs = f.value; listaDocs(); };
    listaDocs();
  }
  function listaDocs() {
    const pal = filtroDocs.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
    const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const todos = P.datos.sin_merito;
    const res = pal.length ? todos.map((s) => { const n = norm(nomLimpio(s.archivo)); return [s, pal.filter((p) => n.includes(p)).length]; }).filter((x) => x[1]).sort((a, b) => b[1] - a[1]).map((x) => x[0]) : todos;
    $('#dsTit').textContent = `Documentos sin colocar (${todos.length})`;
    const v = res.slice(0, 60);
    $('#dsLista').innerHTML = v.map((s) => `<div class="docsuelto ${suelto === s.archivo ? 'on' : ''}" data-a="${esc(s.archivo)}"><span class="dn">${esc(nomLimpio(s.archivo))}</span><button class="bs rojo" data-vs>Ver</button><select class="bs" data-pon aria-label="Poner en un apartado"><option value="">Poner en…</option>${opcionesAp()}</select></div>`).join('') + (res.length > 60 ? `<p class="cuenta">Se muestran 60 de ${res.length}. Escribe arriba para encontrar el que buscas.</p>` : '') + (!res.length ? '<p class="vacio">No hay ningún documento con esas palabras.</p>' : '');
    $$('.docsuelto').forEach((d) => {
      const a = d.dataset.a;
      $('[data-vs]', d).onclick = () => { sel = null; selSha = null; suelto = a; $$('.merito').forEach((x) => x.classList.remove('on')); $$('.docsuelto').forEach((x) => x.classList.toggle('on', x === d)); pintarVisor(); };
      $('[data-pon]', d).onchange = (e) => { const cod = e.target.value; if (!cod) return; if (suelto === a) suelto = null; op('deSuelto', { archivo: a, cod }, `Colocado en ${nombreDe(cod)}.`); };
    });
  }
  function ligarEnlaces(caja) {
    $$('[data-url]', caja).forEach((a) => {
      a.onclick = (e) => { if (e.target.closest('button') && e.target.closest('button') !== a) return; e.preventDefault(); e.stopPropagation(); window.open(a.dataset.url); };
      if (a.tagName !== 'A') a.onkeydown = (e) => { if (e.key === 'Enter') a.click(); };
    });
  }
  // Pulsar un texto lo vuelve editable; pulsar un enlace lo abre.
  function editarCampo(el, id) {
    const m = buscar(id);
    const f = +el.dataset.f, c = +el.dataset.c, k = el.dataset.k;
    const antes = m.filas[f][c][k];
    el.textContent = antes;
    el.classList.add('editando');
    el.contentEditable = 'plaintext-only';
    el.spellcheck = false;
    el.focus();
    getSelection().selectAllChildren(el);
    let hecho = false;
    const fin = (guardar) => {
      if (hecho) return; hecho = true;
      const v = el.textContent.trim();
      if (!guardar || v === antes) { pintarLista(); return; }
      op('editar', { id, f, c, k, v }, 'Guardado.');
    };
    el.onkeydown = (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); } if (ev.key === 'Escape') fin(false); };
    el.onblur = () => fin(true);
  }
  function ligarEdicion(e, id) {
    $$('.ed', e).forEach((c) => { c.onclick = (ev) => { if (ev.target.closest('a') || c.isContentEditable) return; ev.stopPropagation(); editarCampo(c, id); }; });
  }
  // En la versión del tribunal (HTML, web, programa de consulta) el PDF se abre en una ventana emergente.
  function abrirVentana(rel, titulo) {
    let w = null;
    try { w = window.open('', 'justificante', 'popup,width=1100,height=900'); } catch (x) { w = null; }
    if (!w) return false;
    try { w.document.title = titulo || 'Justificante'; w.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px;color:#002028">Abriendo el documento…</p>'; } catch (x) { /* otra ventana */ }
    if (!window.CIFRADO) { w.location.href = urlDe(rel); w.focus(); return true; }
    window.CIFRADO.pdf(rel).then((r) => {
      if (r.url) w.location.href = r.url;
      else if (r.grande) w.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">Este documento es demasiado extenso para la versión web. Está en el expediente entregado.</p>';
      else w.location.href = r.blob + '#toolbar=0&navpanes=0&view=FitH';
      w.focus();
    }).catch(() => { try { w.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">No se ha podido abrir el documento.</p>'; } catch (x) { /* cerrada */ } });
    return true;
  }
  function verPdf(e, id, sha) {
    if (CONSULTA) {
      const m = buscar(id), p = m && m.pdfs.find((x) => x.sha === sha);
      if (p && abrirVentana(p.archivo, m.t)) { $$('.merito').forEach((x) => x.classList.toggle('on', x === e)); return; }
    }
    suelto = null; $$('.docsuelto').forEach((x) => x.classList.remove('on'));
    sel = id; selSha = sha;
    $$('.merito').forEach((x) => x.classList.toggle('on', x === e));
    $$('.chip').forEach((c) => { const v = $('[data-ver]', c); c.classList.toggle('on', !!v && +c.closest('.merito').dataset.id === id && v.dataset.ver === sha); });
    pintarVisor();
  }
  function ligarMerito(e) {
    const id = +e.dataset.id;
    $$('[data-ver]', e).forEach((b) => { b.onclick = (ev) => { ev.stopPropagation(); verPdf(e, id, b.dataset.ver); }; });
    if (!trabajo) {
      // En la vista del tribunal, pulsar el mérito abre su justificante.
      const pr = buscar(id).pdfs.find((p) => p.nivel === 'alta');
      if (pr) { e.classList.add('abrible'); e.onclick = (ev) => { if (!ev.target.closest('a,button')) verPdf(e, id, pr.sha); }; }
      return;
    }
    ligarEdicion(e, id);
    $$('[data-xf]', e).forEach((b) => { b.onclick = () => op('quitarFila', { id, f: +b.dataset.xf }, 'Fila quitada.'); });
    // En una opción del menú se sube o baja respecto a lo que se ve; la posición se guarda dentro del apartado del CVN.
    const mov = (d) => {
      const m = buscar(id), todo = P.datos.meritos.filter((x) => x.cod === m.cod && (trabajo || publico(x)));
      const l = m.vista ? todo.filter((x) => x.vista === m.vista) : todo.filter((x) => !x.vista);
      const k = l.findIndex((x) => x.id === id) + d;
      if (k >= 0 && k < l.length) op('mover', { id, cod: m.cod, pos: todo.indexOf(l[k]) }, 'Entrada movida. Los números se han actualizado.');
    };
    const bS = $('[data-sube]', e); if (bS) bS.onclick = () => mov(-1);
    const bB = $('[data-baja]', e); if (bB) bB.onclick = () => mov(1);
    const bFi = $('[data-fila]', e); if (bFi) bFi.onclick = async () => { const r = await op('nuevaFila', { id }, 'Fila añadida.'); if (r) { const c = $(`.merito[data-id="${id}"] .val[data-f="${r.fila}"]`); if (c) c.click(); } };
    const bV = $('[data-verif]', e); if (bV) bV.onclick = () => op('verificar', { id }, 'Verificado: ya lo ve el tribunal.');
    const bP = $('[data-priv]', e); if (bP) bP.onclick = () => op('privado', { id }, buscar(id).privado ? 'Visible para el tribunal.' : 'Oculto al tribunal.');
    $$('[data-ok]', e).forEach((b) => { b.onclick = () => op('aceptar', { id, sha: b.dataset.ok }, 'PDF confirmado y colocado en su carpeta.'); });
    $$('[data-qui]', e).forEach((b) => { b.onclick = () => { if (sel === id && selSha === b.dataset.qui) { sel = null; selSha = null; } op('quitarPdf', { id, sha: b.dataset.qui }, 'PDF quitado. Sigue guardado en la carpeta de revisar.'); }; });
    $$('[data-cam]', e).forEach((b) => { b.onclick = async () => { const r = await op('elegirPdf', { id, sustituir: b.dataset.cam }, 'PDF cambiado.'); if (r) { sel = id; selSha = r.sha; pintarLista(); pintarVisor(); } }; });
    const bj = $('[data-busj]', e);
    if (bj) bj.onclick = async (ev) => {
      ev.stopPropagation();
      const viejo = $('.bjp', e); if (viejo) { viejo.remove(); return; }
      bj.textContent = 'Buscando…';
      const r = await window.api.buscarJust(id);
      bj.textContent = 'Buscar justificante';
      const caja = document.createElement('div'); caja.className = 'bjp';
      caja.innerHTML = r.error ? `<p>${esc(r.error)}</p>` : !r.lista.length ? `<p>No he encontrado documentos parecidos${r.disco ? '' : ' (el disco de origen no está conectado)'}. Puedes añadirlo con «+ Añadir PDF».</p>`
        : `<p class="bjt">Documentos que más se parecen a este mérito${r.disco ? '' : ' (el disco no está conectado: solo «Sin clasificar»)'}:</p>${r.lista.map((x, k) => `<div class="bjf"><span class="bjn" style="--n:${x.nota}%">${x.nota}</span><div class="bjd"><b>${esc(x.nombre)}</b><small>${esc(x.carpeta)}${x.imagen ? ' · imagen: se convertirá a PDF' : ''}</small></div><button class="bs" data-bjv="${k}">Ver</button><button class="bs prim" data-bju="${k}">Usar este</button></div>`).join('')}`;
      $('.tx', e).append(caja);
      $$('[data-bjv]', caja).forEach((b) => { b.onclick = (x) => { x.stopPropagation(); const d = r.lista[+b.dataset.bjv]; verNuevo = d.origen === 'suelto' ? d.archivo : d.ruta; verLibre = true; pintarVisor(); }; });
      $$('[data-bju]', caja).forEach((b) => { b.onclick = async (x) => {
        x.stopPropagation();
        const d = r.lista[+b.dataset.bju];
        verLibre = false; verNuevo = null;
        const it = d.origen === 'suelto' ? { origen: 'suelto', archivo: d.archivo, id } : { origen: 'disco', ruta: d.ruta, pista: d.carpeta + '/' + d.nombre, id };
        await op('colocarLista', { lista: [it] }, 'Justificante añadido.');
      }; });
    };
    const an = $('[data-ana]', e);
    if (an) an.onclick = async () => { const r = await op('elegirPdf', { id }, 'PDF añadido.'); if (r) { sel = id; selSha = r.sha; pintarLista(); pintarVisor(); } };
    const mv = $('[data-mov]', e);
    if (mv) mv.onchange = async () => {
      if (!mv.value) return;
      if (buscar(id).nota) await window.api.operar('convertirNota', { id });
      op('mover', { id, cod: mv.value }, `Movido a ${nombreDe(mv.value)}.`);
    };
    const db = $('[data-del]', e);
    if (db) db.onclick = () => op('eliminar', { id }, 'Eliminado.');
    const bu = $('[data-busca]', e);
    if (bu) bu.onclick = () => {
      const t = buscar(id).t.replace(URLRE, ' ');
      const pal = (t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').match(/[A-Za-z]{4,}/g) || []).filter((w) => !/^(entidad|organizadora|categoria|objetivo|durante|campeonato|equipo)$/i.test(w)).slice(0, 4);
      filtroDocs = pal.join(' ');
      const f = $('#dsFiltro');
      if (f) { f.value = filtroDocs; listaDocs(); $('#dsTit').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    };
  }
  // ---------- PDF al lado ----------
  // En la versión web cifrada, el PDF se descifra en el navegador y se muestra sin botones de descarga.
  const avisoMarco = (t) => `<div style="font:16px/1.5 'IBM Plex Sans','Segoe UI',sans-serif;color:#002028;padding:28px">${t}</div>`;
  function ponerPdf(rel) {
    const marco = $('#vMarco');
    if (!window.CIFRADO) { marco.removeAttribute('srcdoc'); marco.src = urlDe(rel) + '#navpanes=0&view=FitH'; return; }
    marco.removeAttribute('src');
    marco.srcdoc = avisoMarco('Abriendo el documento…');
    window.CIFRADO.pdf(rel).then((r) => {
      if ($('#visor').dataset.u !== rel) return;
      if (r.url) { marco.srcdoc = avisoMarco(`Este documento es muy extenso y se consulta en su repositorio oficial.<br><br><a href="${esc(r.url)}" target="_blank" rel="noopener" style="color:#e03b23;font-weight:500">Abrir el documento</a>`); return; }
      if (r.grande) { marco.srcdoc = avisoMarco('Este documento es demasiado extenso para la versión web. Está disponible en el expediente entregado.'); return; }
      marco.removeAttribute('srcdoc');
      marco.src = r.blob + '#toolbar=0&navpanes=0&view=FitH';
    }).catch(() => { if ($('#visor').dataset.u === rel) marco.srcdoc = avisoMarco('No se ha podido abrir el documento. Comprueba la conexión y vuelve a intentarlo.'); });
  }
  let verLibre = false;
  function cerrarPdf() { verLibre = false; verNuevo = null; sel = null; selSha = null; suelto = null; $$('.docsuelto').forEach((x) => x.classList.remove('on')); $$('.merito').forEach((x) => x.classList.remove('on')); pintarVisor(); }
  function pintarVisor() {
    const m = sel && buscar(sel);
    const p = m && m.pdfs.find((x) => x.sha === selSha);
    const v = $('#visor');
    if (!p && verNuevo && actual && (actual.nuevos || actual.clasif || verLibre)) {
      $('#vTit').textContent = verNuevo.split('/').pop();
      if (v.dataset.u !== verNuevo) { v.dataset.u = verNuevo; ponerPdf(verNuevo); }
      v.hidden = false; $('#columnas').classList.add('conpdf');
      return;
    }
    if (!p && suelto && P.datos.sin_merito.some((x) => x.archivo === suelto)) {
      $('#vTit').textContent = nomLimpio(suelto);
      if (v.dataset.u !== suelto) { v.dataset.u = suelto; ponerPdf(suelto); }
      v.hidden = false; $('#columnas').classList.add('conpdf');
      return;
    }
    if (!p) {
      v.hidden = true; $('#columnas').classList.remove('conpdf');
      $('#vMarco').removeAttribute('src'); $('#vMarco').removeAttribute('srcdoc'); v.dataset.u = '';
      return;
    }
    $('#vTit').textContent = `${m.cod === 'SC' ? 'Sin clasificar' : `${m.n && !APD(m.cod).sinNum && !m.vista ? `Nº ${m.n} · ` : ''}${nombreDe(m.vista ? 'v:' + m.vista : m.cod)}`}${p.nivel !== 'alta' ? ' · sin confirmar' : ''}`;
    $('#vTit').title = $('#vTit').textContent;
    if (v.dataset.u !== p.archivo) { v.dataset.u = p.archivo; ponerPdf(p.archivo); }
    v.hidden = false; $('#columnas').classList.add('conpdf');
  }
  // ---------- Editor del menú ----------
  function guardarMenu() { if (!CONSULTA) window.api.guardarMenu(MENU); }
  function cambioMenu(fn) { pilaMenu.push(JSON.stringify(MENU)); fn(); guardarMenu(); pintarMenu(); pintarEditor(); }
  function salirEditor() { if (editando) { editando = false; pintarEditor(); } }
  function pintarEditor() {
    $('#vista').hidden = editando;
    $('#editor').hidden = !editando;
    $('#bEd').textContent = editando ? 'Terminar' : 'Editar menú';
    if (!editando) return;
    const b = MENU[abiertoB] ? abiertoB : 0;
    const l = MENU[b] ? MENU[b][1] : null;
    $('#editor').innerHTML = `<div class="edtop"><div><h1>Editar menú</h1><p class="edaviso">Cambia cómo se ve el menú. Las carpetas y los PDF no cambian.</p></div><div class="fil"><button class="bs" id="eDes" ${pilaMenu.length ? '' : 'disabled'}>Deshacer</button><button class="bs" id="eIni">Volver al menú inicial</button></div></div>
      <div class="edcols"><section><h2>Botones de la barra</h2>
      ${MENU.map(([t, o], i) => `<div class="fila ${i === b ? 'on' : ''}"><input aria-label="Nombre del botón" value="${esc(t)}" data-nb="${i}"><button class="mini" data-ab="${i}">Opciones (${o ? o.length : 0})</button><button class="mini" data-sb="${i}" aria-label="A la izquierda">←</button><button class="mini" data-bb="${i}" aria-label="A la derecha">→</button><button class="mini mal" data-xb="${i}">Quitar</button></div>`).join('')}
      <button class="add" id="aB">Añadir botón</button></section>
      <section><h2>Opciones de «${esc(MENU[b] ? MENU[b][0] : '')}»</h2>
      ${(l || []).map(([, n, h], k) => `<div class="fila ${h ? 'estit' : ''}"><input aria-label="Nombre de la opción" value="${esc(n)}" data-on="${k}"><button class="mini" data-so="${k}" aria-label="Subir">↑</button><button class="mini" data-bo="${k}" aria-label="Bajar">↓</button><button class="mini mal" data-xo="${k}">Quitar</button></div>`).join('') || '<p class="vacio">Este botón no tiene desplegable.</p>'}
      <button class="add" id="aO">Añadir opción</button></section></div>`;
    const on = (s, fn) => $$(s, $('#editor')).forEach((x) => { x.onclick = () => fn(x); });
    on('[data-ab]', (x) => { abiertoB = +x.dataset.ab; pintarEditor(); });
    on('[data-xb]', (x) => cambioMenu(() => { MENU.splice(+x.dataset.xb, 1); abiertoB = Math.min(abiertoB, MENU.length - 1); }));
    on('[data-sb]', (x) => { const i = +x.dataset.sb; if (i > 0) cambioMenu(() => { [MENU[i - 1], MENU[i]] = [MENU[i], MENU[i - 1]]; if (abiertoB === i) abiertoB = i - 1; }); });
    on('[data-bb]', (x) => { const i = +x.dataset.bb; if (i < MENU.length - 1) cambioMenu(() => { [MENU[i + 1], MENU[i]] = [MENU[i], MENU[i + 1]]; if (abiertoB === i) abiertoB = i + 1; }); });
    on('[data-xo]', (x) => cambioMenu(() => MENU[b][1].splice(+x.dataset.xo, 1)));
    on('[data-so]', (x) => { const k = +x.dataset.so; if (k > 0) cambioMenu(() => { const o = MENU[b][1]; [o[k - 1], o[k]] = [o[k], o[k - 1]]; }); });
    on('[data-bo]', (x) => { const k = +x.dataset.bo; if (k < l.length - 1) cambioMenu(() => { const o = MENU[b][1]; [o[k + 1], o[k]] = [o[k], o[k + 1]]; }); });
    $('#aB').onclick = () => cambioMenu(() => { MENU.push(['Nuevo botón', []]); abiertoB = MENU.length - 1; });
    $('#aO').onclick = () => cambioMenu(() => { if (!MENU[b][1]) MENU[b][1] = []; MENU[b][1].push([`X.${Date.now().toString(36)}`, 'Nuevo apartado']); });
    $('#eDes').onclick = () => { if (pilaMenu.length) { MENU = JSON.parse(pilaMenu.pop()); guardarMenu(); pintarMenu(); pintarEditor(); } };
    $('#eIni').onclick = () => cambioMenu(() => { MENU = copia(INICIAL); abiertoB = 3; });
    const texto = (s, fn) => $$(s, $('#editor')).forEach((x) => {
      x.onchange = () => { pilaMenu.push(JSON.stringify(MENU)); fn(x); guardarMenu(); pintarMenu(); const d = $('#eDes'); if (d) d.disabled = false; };
      x.onkeydown = (e) => { if (e.key === 'Enter') x.blur(); };
    });
    texto('[data-nb]', (x) => { const i = +x.dataset.nb; MENU[i][0] = x.value.trim() || MENU[i][0]; x.value = MENU[i][0]; });
    texto('[data-on]', (x) => { const o = MENU[b][1][+x.dataset.on]; o[1] = x.value.trim() || o[1]; x.value = o[1]; });
  }
  // ---------- Controles ----------
  function cambiarVista(t) {
    trabajo = t;
    editando = false; pintarEditor();
    cerrarPdf();
    document.body.classList.toggle('tribunal', !trabajo);
    pintarCab(); pintarMenu();
    // Si el apartado no existe en esta vista, se vuelve al inicio.
    if (!trabajo && actual && !actual.ficha && !actual.inicio && !(actual.vista ? entradasMenu(actual.cm) : entradas(actual.c)).length) actual = null;
    if (!actual) irInicio(); else { const it = items.find((x) => x.firstElementChild.textContent === actual.bloque || $(`[data-c="${actual.c}"]`, x)); if (it) it.classList.add('activo'); pintarLista(); }
  }
  function irInicio() { elegir(items[0] && items[0].firstElementChild.textContent === 'Inicio' ? items[0] : null, '', 'Inicio'); }
  $('#mT').onclick = () => cambiarVista(true);
  $('#mV').onclick = () => cambiarVista(false);
  $('#vCerrar').onclick = cerrarPdf;
  $('#bDes').onclick = deshacer;
  $('#bEd').onclick = () => { editando = !editando; pintarEditor(); };
  $('#bNu').onclick = irNuevos;
  $('#avAct').onclick = irNuevos;
  $('#avLuego').onclick = () => { avisoCerrado = true; pintarAvisoNuevos(); };
  // Si dejas un PDF en la carpeta con el programa abierto, también avisa al volver a él.
  if (!CONSULTA) window.addEventListener('focus', async () => {
    const l = await window.api.nuevos();
    if (l.filter((x) => x.esPdf).length > pdfsNuevos().length) avisoCerrado = false;
    P.nuevos = l;
    pintarAvisoNuevos();
  });
  $('#bSC').onclick = () => { salirEditor(); elegir(null, 'SC', 'Sin clasificar'); };
  $('#bPV').onclick = () => { salirEditor(); elegir(null, 'PV', 'Por verificar'); $('#sel1').textContent = 'Clasificados automáticamente: revisa cada uno y pulsa «Verificado»'; };
  if (!CONSULTA) window.__clas = () => clas;
  document.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); deshacer(); }
  });
  pintarCab(); pintarMenu(); pintarEditor();
  irInicio();
  window.__listo = true;
})();
