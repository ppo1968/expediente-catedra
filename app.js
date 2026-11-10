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
  { const aj = MENU.find((x) => x[0] === 'Ajustes'); if (aj && aj[1] && !aj[1].some((o) => o[1] === 'Publicar en la web')) aj[1].unshift(['', 'Publicar en la web']); }
  let quitando = false, generando = false, trabajo = !CONSULTA, filtroDocs = '', suelto = null, actual = null, sel = null, selSha = null, editando = false, abiertoB = 3, pilaMenu = [];
  const urlDe = (r) => (/^(data|blob):/.test(r) ? r : (P.baseUrl || '') + r.split('/').map(encodeURIComponent).join('/'));
  const buscar = (id) => P.datos.meritos.find((m) => m.id === id);
  const nombreDe = (c) => { for (const [t, l, cd] of MENU) { if (cd === c) return t; for (const [k, n] of l || []) if (k === c) return n; } return c === 'SC' ? 'Sin clasificar' : c; };

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
  const entradas = (c) => P.datos.meritos.filter((m) => m.cod === c && (trabajo || publico(m)));
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
    $('#bDes').disabled = !P.deshacer;
  }
  // ---------- Menú ----------
  let items = [];
  const cerrar = () => items.forEach((x) => { x.classList.remove('abierto'); x.firstElementChild.setAttribute('aria-expanded', 'false'); });
  function elegir(bloque, c, n) {
    items.forEach((x) => x.classList.remove('activo'));
    if (bloque) bloque.classList.add('activo');
    const tb = bloque ? bloque.firstElementChild.textContent : '';
    const sub = APD(c).sub;
    $('#sel1').textContent = !bloque ? 'Por decidir' : tb === n ? 'Currículum vitae normalizado' : sub ? `${tb} › ${sub}` : tb;
    $('#sel2').textContent = tb === 'Ajustes' ? 'Ajustes' : n;
    quitando = false;
    actual = { c, opcion: n, bloque: tb, ficha: c === '1', inicio: tb === 'Inicio' };
    sel = null; selSha = null; suelto = null; filtroDocs = '';
    $('#lista').scrollTop = 0;
    pintarLista(); pintarVisor();
  }
  function pintarMenu() {
    const nav = $('#menu');
    const oc = P.datos.ocultos || [];
    const hay = (c) => P.datos.meritos.some((m) => m.cod === c && publico(m));
    // Un título intermedio solo se muestra si queda algo debajo.
    const sinTitulosVacios = (l) => l.filter((o, i) => o[2] !== 'h' || (l[i + 1] && l[i + 1][2] !== 'h'));
    const SINOC = MENU.map(([t, l, cd]) => [t, l && sinTitulosVacios(l.filter(([c]) => !c || !oc.includes(c))), cd]).filter(([, l]) => l === null || l.length || !oc.length);
    const VIS = trabajo ? SINOC : SINOC.map(([t, l, cd]) => [t, l && sinTitulosVacios(l.filter((o) => o[2] === 'h' || hay(o[0]))), cd]).filter(([t, l, cd]) => t !== 'Ajustes' && (l ? l.length : !cd || hay(cd)));
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
        if (matchMedia('(hover:hover)').matches) return;
        const on = it.classList.contains('abierto');
        cerrar();
        if (!on) { it.classList.add('abierto'); b.setAttribute('aria-expanded', 'true'); }
      };
      $$('.desp button', it).forEach((o) => {
        o.onclick = (e) => { e.stopPropagation(); cerrar(); o.blur(); b.blur(); salirEditor(); elegir(it, o.dataset.c, o.dataset.n); };
      });
    });
  }
  // ---------- Méritos ----------
  function htmlPdfs(m) {
    if (m.nota || m.dato) return '';
    const lista = trabajo ? m.pdfs : m.pdfs.filter((p) => p.nivel === 'alta');
    const f = lista.map((p, k) => {
      const rev = p.nivel !== 'alta';
      const nom = rev ? 'Sin confirmar' : lista.length > 1 ? `PDF ${k + 1}` : 'PDF';
      const on = sel === m.id && selSha === p.sha ? 'on' : '';
      return `<span class="chip ${rev ? 'rev' : ''} ${on}"><button class="abre" data-ver="${esc(p.sha)}" title="Ver este PDF">${nom}</button>${trabajo ? `${rev ? `<button data-ok="${esc(p.sha)}" title="Sí, es este PDF">Confirmar</button>` : ''}<button class="ex" data-cam="${esc(p.sha)}" title="Cambiar por otro PDF">Cambiar</button><button class="ex" data-qui="${esc(p.sha)}" title="Quitar este PDF">Quitar</button>` : ''}</span>`;
    }).join('');
    const mas = trabajo ? `<button class="chip nuevo" data-ana>${m.pdfs.length ? '+ PDF' : '+ Añadir PDF'}</button>` : '';
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
      return `<div class="fc ${vis.length > 1 ? 'par' : ''} ${vis[0][0].e ? '' : 'parr'}">${vis.map(([p, c]) => htmlCelda(p, f, c)).join('')}${trabajo && m.filas.length > 1 ? `<button class="xf" data-xf="${f}" title="Quitar esta fila" aria-label="Quitar esta fila">×</button>` : ''}</div>`;
    }).join('');
  }
  function htmlMerito(m) {
    const a = APD(m.cod);
    const dc = m.nota ? 'Nota' : m.cod === 'SC' ? '' : a.sinNum ? '' : m.n;
    const herr = trabajo ? `<div class="hm">
        ${m.cod !== 'SC' && !m.nota ? '<button data-sube title="Subir">↑</button><button data-baja title="Bajar">↓</button>' : ''}
        <button data-fila title="Añadir una fila">+ Fila</button>
        <select data-mov aria-label="Mover a otro apartado"><option value="">Mover a…</option>${opcionesAp()}</select>
        <button data-priv>${m.privado ? 'Mostrar al tribunal' : 'Ocultar al tribunal'}</button>
        <button class="b" data-del>Eliminar</button></div>` : '';
    return `<article class="merito ${m.nota ? 'esnota' : ''} ${dc === '' ? 'sinn' : ''} ${m.privado ? 'oculto' : ''} ${sel === m.id ? 'on' : ''}" data-id="${m.id}">${dc === '' ? '' : `<div class="doc">${esc(dc)}</div>`}<div class="tx">
      ${htmlFilas(m)}
      ${m.privado && trabajo ? '<span class="tag">Oculto al tribunal</span>' : ''}
      ${m.nuevo && trabajo ? '<span class="tag tnu">Nuevo: completa su texto</span>' : ''}
      ${trabajo && m.notas && m.notas.length ? `<div class="nota">Nota interna: ${esc(m.notas.join(' · '))}</div>` : ''}
      ${htmlPdfs(m)}${m.cod === 'SC' && trabajo ? '<div class="fil"><button class="bs" data-busca>Buscar su documento</button></div>' : ''}
      ${herr}
    </div></article>`;
  }
  // Tabla del principio de «Cargos y actividades», igual que en el CVN. Sale de las propias entradas.
  function htmlTabla(l) {
    const val = (m, ...et) => { for (const e of et) { const p = m.filas.flat().find((x) => x.e === e); if (p) return p.v; } return ''; };
    return `<table class="tcv"><thead><tr><th></th><th>Entidad empleadora</th><th>Categoría profesional</th><th>Fecha de inicio</th></tr></thead><tbody>${l.map((m) => `<tr data-ir="${m.id}"><td>${m.n || ''}</td><td>${esc(val(m, 'Entidad empleadora'))}</td><td>${esc(val(m, 'Categoría profesional'))}</td><td>${esc((val(m, 'Fecha de inicio', 'Fecha de inicio-fin').match(/\d\d\/\d\d\/\d{4}/) || [''])[0])}</td></tr>`).join('')}</tbody></table>`;
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
    $('#avTx').textContent = n === 1 ? 'Tienes un mérito nuevo en la carpeta 05_Meritos_nuevos.' : `Tienes ${n} méritos nuevos en la carpeta 05_Meritos_nuevos.`;
  }
  async function irNuevos() {
    salirEditor();
    items.forEach((x) => x.classList.remove('activo'));
    avisoCerrado = true;
    actual = { c: '', opcion: '', bloque: '', nuevos: true };
    sel = null; selSha = null; suelto = null; verNuevo = null; analisis = null;
    $('#sel1').textContent = 'Carpeta 05_Meritos_nuevos';
    $('#sel2').textContent = 'Méritos nuevos';
    pintarAvisoNuevos(); pintarVisor(); pintarLista();
    const r = await window.api.analizarNuevos();
    if (actual && actual.nuevos) { analisis = r.map((x) => ({ ...x, incluir: !!x.esPdf, destino: x.entrada ? `id:${x.entrada.id}` : x.cod })); pintarLista(); }
  }
  function opcionesDestino(x) {
    const ap = MENU.flatMap(([t, l, cd]) => (cd ? [[cd, t]] : l || [])).filter((o) => o[0] && o[2] !== 'h' && o[0] !== '1' && !(P.datos.ocultos || []).includes(o[0]));
    const una = x.entrada ? `<option value="id:${x.entrada.id}" ${x.destino === `id:${x.entrada.id}` ? 'selected' : ''}>Unir a la entrada nº ${x.entrada.n} de «${esc(nombreDe(x.entrada.cod))}»</option>` : '';
    const lista = ap.map((o) => `<option value="${esc(o[0])}" ${x.destino === o[0] ? 'selected' : ''}>${esc(o[1])}</option>`).join('');
    return `${una}${lista}<option value="SC" ${x.destino === 'SC' ? 'selected' : ''}>Sin clasificar: lo decido después</option>`;
  }
  function pintarNuevos() {
    const caja = $('#meritos');
    if (!analisis) { caja.innerHTML = '<p class="cuenta">Leyendo los documentos…</p>'; return; }
    if (!analisis.length) { caja.innerHTML = '<p class="vacio">La carpeta está vacía: no hay méritos nuevos. Deja aquí los PDF y el programa te avisará.</p>'; return; }
    const pdf = analisis.filter((x) => x.esPdf), otros = analisis.filter((x) => !x.esPdf);
    const elegidos = pdf.filter((x) => x.incluir).length;
    caja.innerHTML = `<p class="cuenta">Revisa dónde va cada uno. Al actualizar, cada PDF sale de la carpeta y pasa a su apartado con su número.</p>
      ${pdf.map((x) => `<article class="nuevo ${verNuevo === x.rel ? 'on' : ''}" data-i="${analisis.indexOf(x)}">
        <label class="nchk"><input type="checkbox" data-inc ${x.incluir ? 'checked' : ''} aria-label="Incluir ${esc(x.nombre)}"></label>
        <div class="nmed"><div class="nfila"><b>${esc(x.nombre)}</b><button class="bs rojo" data-ver>Ver</button></div>
          ${x.yaEsta ? '<p class="nav">Este PDF ya está en el expediente. No se añade otra vez: se aparta como repetido.</p>' : ''}
          ${x.sinTexto ? '<p class="nav">No se ha podido leer su texto (quizá esté escaneado). Comprueba el apartado.</p>' : ''}
          <label class="ncam"><span>Va en</span><select data-dest>${opcionesDestino(x)}</select></label>
          ${x.destino && x.destino.startsWith('id:') ? '' : `<label class="ncam"><span>Texto</span><input data-tit value="${esc(x.titulo || '')}" aria-label="Texto de la entrada"></label>`}
        </div></article>`).join('')}
      ${otros.length ? `<h2 class="fh">No se pueden colocar</h2><p class="cuenta">Por ahora solo se colocan PDF. Estos se quedan en la carpeta:</p>${otros.map((x) => `<div class="docsuelto"><span class="dn">${esc(x.nombre)}</span></div>`).join('')}` : ''}
      ${pdf.length ? `<div class="nfin"><button class="bs prim" id="nAct" ${elegidos ? '' : 'disabled'}>Actualizar (${elegidos})</button><button class="bs" id="nRe">Volver a revisar la carpeta</button></div>` : ''}`;
    $$('.nuevo', caja).forEach((e) => {
      const x = analisis[+e.dataset.i];
      $('[data-inc]', e).onchange = (ev) => { x.incluir = ev.target.checked; pintarNuevos(); };
      $('[data-dest]', e).onchange = (ev) => { x.destino = ev.target.value; pintarNuevos(); };
      const t = $('[data-tit]', e); if (t) t.onchange = () => { x.titulo = t.value; };
      $('[data-ver]', e).onclick = () => { verNuevo = x.rel; $$('.nuevo', caja).forEach((o) => o.classList.toggle('on', o === e)); pintarVisor(); };
    });
    const nR = $('#nRe'); if (nR) nR.onclick = irNuevos;
    const nA = $('#nAct');
    if (nA) nA.onclick = async () => {
      nA.disabled = true;
      const lista = analisis.filter((x) => x.esPdf && x.incluir).map((x) => {
        const d = x.destino || 'SC';
        return d.startsWith('id:') ? { rel: x.rel, id: +d.slice(3), cod: x.entrada.cod } : { rel: x.rel, cod: d, titulo: x.titulo, doi: x.doi };
      });
      verNuevo = null;
      const r = await op('incorporar', { lista });
      if (!r) { nA.disabled = false; return; }
      const partes = [];
      if (r.colocados) partes.push(r.colocados === 1 ? '1 mérito colocado' : `${r.colocados} méritos colocados`);
      if (r.sinClasificar) partes.push(`${r.sinClasificar} en Sin clasificar`);
      if (r.repetidos) partes.push(`${r.repetidos} repetido${r.repetidos > 1 ? 's' : ''} apartado${r.repetidos > 1 ? 's' : ''}`);
      aviso(`Actualizado: ${partes.join(', ') || 'nada que colocar'}.`, { des: true });
      await irNuevos();
    };
  }
  // ---------- Inicio ----------
  function pintarInicio() {
    $('#sel1').textContent = 'Concurso de acceso a Catedrático de Universidad';
    $('#sel2').textContent = nombrePersona();
    const oc = P.datos.ocultos || [];
    const lin = (a) => {
      const l = entradas(a.cod), n = l.length;
      if (oc.includes(a.cod) || (!trabajo && !n)) return '';
      const ok = l.filter((m) => m.pdfs.some((p) => p.nivel === 'alta')).length;
      const sinPdf = a.sinNum && a.cod !== '3.2' && a.cod !== '3.3' && a.cod !== '3.4';
      return `<button class="ilin" data-ic="${esc(a.cod)}"><span class="inom">${esc(nombreDe(a.cod))}</span><span class="icu">${trabajo && !sinPdf && n ? `${ok} de ${n} con PDF confirmado` : (a.sinNum ? '' : n)}</span>${trabajo && !sinPdf && n ? `<span class="ibar"><span style="width:${Math.round(ok / n * 100)}%"></span></span>` : ''}</button>`;
    };
    const grupos = window.ARBOL.filter((g) => g.gr !== 'Por decidir').map((g) => {
      const h = g.aps.map(lin).join('');
      return h ? `<section class="ig"><h2>${esc(g.gr)}</h2>${h}</section>` : '';
    }).join('');
    $('#meritos').innerHTML = `<div class="portada"><div><p class="pcvn">Currículum vitae normalizado (CVN)</p><p class="pdet">Cada apartado sigue los títulos, epígrafes y orden del CVN. Pulsa uno para verlo con sus documentos.</p></div>${htmlFoto()}</div><div class="indice">${grupos}</div>`;
    $$('[data-ic]').forEach((b) => { b.onclick = () => irA(b.dataset.ic); });
    ligarFoto();
  }
  function irA(c) {
    const it = items.find((x) => x.dataset.cd === c || $(`[data-c="${c}"]`, x));
    elegir(it || null, c, nombreDe(c));
  }
  function pintarLista() {
    const caja = $('#meritos');
    if (!actual) { caja.innerHTML = ''; return; }
    const y = $('#lista').scrollTop;
    if (actual.nuevos) { pintarNuevos(); $('#lista').scrollTop = y; return; }
    if (actual.inicio) { pintarInicio(); $('#lista').scrollTop = y; return; }
    if (actual.ficha) { pintarFicha(); $('#lista').scrollTop = y; ligarEnlaces(caja); return; }
    if (actual.bloque === 'Ajustes') { pintarAjustes(); return; }
    const l = entradas(actual.c);
    const herrAp = trabajo && actual.c && actual.c !== 'SC' ? `<div class="fil"><button class="bs prim" id="bNE">+ Añadir entrada</button><button class="bs mal" id="bQA">Eliminar este apartado</button></div>${quitando ? `<div class="quita"><b>${l.length ? `Tiene ${l.length} ${l.length === 1 ? 'entrada' : 'entradas'}. ¿Qué hago con ${l.length === 1 ? 'ella' : 'ellas'}?` : '¿Eliminar este apartado?'}</b>${l.length ? `<select class="bs" id="qD" aria-label="Mover a">${opcionesAp()}</select><button class="bs" id="qM">Mover y eliminar</button>` : ''}<button class="bs mal" id="qB">${l.length ? 'Eliminar todo' : 'Eliminar'}</button><button class="bs" id="qN">Cancelar</button></div>` : ''}` : '';
    const avisoC0 = actual.c === 'C.0' && trabajo ? '<p class="cuenta">Estaban en el Word y no se han encontrado en el CVN. El tribunal no las ve, salvo las que marques «Mostrar al tribunal».</p>' : '';
    const verCuenta = trabajo && !APD(actual.c).sinNum;
    caja.innerHTML = herrAp + avisoC0 + (l.length ? (verCuenta ? `<p class="cuenta">${l.length} ${l.length === 1 ? 'entrada' : 'entradas'}</p>` : '') + (APD(actual.c).tabla ? htmlTabla(l) : '') + l.map(htmlMerito).join('') : '<p class="vacio">Este apartado no tiene entradas.</p>');
    const bN = $('#bNE'); if (bN) bN.onclick = async () => { const r = await op('nuevo', { cod: actual.c }, 'Entrada añadida.'); if (r) { const e = $(`.merito[data-id="${r.id}"]`); if (e) { e.scrollIntoView({ block: 'center' }); const c = $('.val.ed', e); if (c) c.click(); } } };
    $$('[data-ir]', caja).forEach((t) => { t.onclick = () => { const e = $(`.merito[data-id="${t.dataset.ir}"]`); if (e) e.scrollIntoView({ block: 'start', behavior: 'smooth' }); }; });
    const bQ = $('#bQA'); if (bQ) bQ.onclick = () => { quitando = !quitando; pintarLista(); };
    const qN = $('#qN'); if (qN) qN.onclick = () => { quitando = false; pintarLista(); };
    const fin = async (destino) => { const c = actual.c; quitando = false; const r = await op('eliminarApartado', { cod: c, destino }, destino ? `Apartado eliminado. Sus entradas están en ${nombreDe(destino)}.` : 'Apartado eliminado. Sus PDF siguen en Sin clasificar.'); if (r) { actual = null; irInicio(); } };
    const qB = $('#qB'); if (qB) qB.onclick = () => fin(null);
    const qM = $('#qM'); if (qM) qM.onclick = () => fin($('#qD').value);
    $('#lista').scrollTop = y;
    $$('.merito', caja).forEach(ligarMerito);
    ligarEnlaces(caja);
    if (actual.c === 'SC' && trabajo) pintarDocs();
  }
  function pintarAjustes() {
    const caja = $('#meritos');
    const salida = [
      ['html', 'Versión HTML', 'Se abre en cualquier navegador con doble clic en index.html. No hay que instalar nada.'],
      ['pc', 'Ejecutable para PC', 'Programa de Windows, solo consulta. Windows puede avisar porque no lleva firma.'],
      ['mac', 'Ejecutable para Mac', 'Crea dos archivos: Apple Silicon e Intel. Sin firma de Apple; pruébalo en un Mac antes de entregarlo.'],
      ['zip', 'ZIP completo', 'Todas las carpetas y los PDF confirmados, con el índice de documentos.'],
    ];
    const oc = P.datos.ocultos || [];
    const vert = (P.ajustes.menu || 'horizontal') === 'vertical';
    const cerrado = P.ajustes.cerrado;
    const pend = P.datos.meritos.filter((m) => !m.nota && !m.dato && m.cod !== 'SC' && (!m.pdfs.length || m.pdfs.some((p) => p.nivel !== 'alta'))).length;
    caja.innerHTML = `<section class="aj" data-sec="publicar" id="secPub"><h2>Publicar en la web</h2><p class="cuenta">El tribunal entra con un enlace y una clave. Todo va cifrado: sin la clave no se puede leer nada.</p><div id="pubCaja"><p class="cuenta">Cargando…</p></div></section>
      <section class="aj" data-sec="generar"><h2>Generar versiones</h2><p class="cuenta">Salen como en la vista Tribunal. Elige una carpeta de ruta corta, como el Escritorio o un pendrive.${pend ? ` Ahora mismo, ${pend.toLocaleString('es-ES')} méritos no tienen un PDF confirmado.` : ''}</p>
        <div class="tarjs">${salida.map(([k, t, d]) => `<article class="tarj"><h3>${t}</h3><p>${d}</p><button class="bs prim" data-g="${k}">Generar</button></article>`).join('')}</div><div id="prog" role="status"></div></section>
      <section class="aj" data-sec="menu"><h2>Menú</h2><div class="opc" role="group" aria-label="Menú"><button data-m="vertical" class="${vert ? 'on' : ''}">Vertical</button><button data-m="horizontal" class="${vert ? '' : 'on'}">Horizontal</button></div></section>
      <section class="aj" data-sec="cerrar"><h2>Cerrar expediente</h2><p class="cuenta">${cerrado ? `Cerrado el ${new Date(cerrado).toLocaleString('es-ES')}. No se puede modificar.` : 'Los números quedan fijos y no se puede modificar nada hasta que lo reabras.'}</p><button class="bs ${cerrado ? '' : 'mal'}" id="bCierra">${cerrado ? 'Reabrir expediente' : 'Cerrar expediente'}</button></section>
      <section class="aj" data-sec="documentos"><h2>Documentos sin usar</h2><p class="cuenta">${P.datos.sin_merito.length.toLocaleString('es-ES')} PDF de tu carpeta no están en ningún mérito. No salen en lo que entregues.</p><button class="bs" id="bVerSC">Verlos y colocarlos</button></section>
      <section class="aj" data-sec="apartados"><h2>Apartados eliminados</h2>${oc.length ? oc.map((c) => `<div class="fila"><span style="flex:1">${esc(nombreDe(c))}</span><button class="bs" data-res="${esc(c)}">Recuperar</button></div>`).join('') : '<p class="cuenta">No has eliminado ninguno.</p>'}</section>`;
    $$('[data-g]', caja).forEach((b) => { b.onclick = () => generar(b.dataset.g); });
    $$('[data-m]', caja).forEach((b) => { b.onclick = async () => { const r = await window.api.ajuste('menu', b.dataset.m); if (r.paquete) P = r.paquete; pintarCab(); pintarMenu(); marcarActivo(); pintarAjustes(); }; });
    $('#bCierra').onclick = async () => { const r = await window.api.ajuste('cerrar', !P.ajustes.cerrado); if (r.paquete) P = r.paquete; pintarAjustes(); aviso(P.ajustes.cerrado ? 'Expediente cerrado' : 'Expediente reabierto'); };
    $('#bVerSC').onclick = () => elegir(null, 'SC', 'Sin clasificar');
    $$('[data-res]', caja).forEach((b) => { b.onclick = () => op('restaurarApartado', { cod: b.dataset.res }, 'Apartado recuperado.'); });
    const O = (actual.opcion || '').toLowerCase();
    pintarPub();
    const sec = /publicar/.test(O) ? 'publicar' : /generar/.test(O) ? 'generar' : /men[uú]/.test(O) ? 'menu' : /cerrar/.test(O) ? 'cerrar' : /documentos/.test(O) ? 'documentos' : /apartados/.test(O) ? 'apartados' : null;
    if (sec) { const e = $(`[data-sec="${sec}"]`); if (e) e.scrollIntoView({ block: 'start' }); }
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
      <p class="cuenta">${auto ? 'Automático: cuando cambias algo, se publica solo al cabo de un minuto y medio.' : 'Manual: se publica cuando pulsas «Publicar ahora».'}</p>
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
  if (!CONSULTA) window.api.alPublicacion((s) => {
    const e = $('#pubEst');
    if (e) { e.outerHTML = lineaEstado(s); const b = $('#pubYa'); if (b) b.disabled = s.estado === 'publicando'; }
    if (s.estado === 'listo' && $('#pubCaja')) pintarPub();
    if (s.estado === 'error' && !$('#pubCaja')) aviso('No se ha podido publicar en la web: ' + s.texto, { mal: true });
  });
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
  const opcionesAp = () => MENU.flatMap(([, l]) => l || []).filter(([c]) => c && c !== '1' && !(P.datos.ocultos || []).includes(c) && !(actual && actual.c === c)).map(([c, n]) => `<option value="${esc(c)}">${esc(n)}</option>`).join('');
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
  function verPdf(e, id, sha) {
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
    const mov = (d) => { const l = entradas(buscar(id).cod); const k = l.findIndex((x) => x.id === id) + d; if (k >= 0 && k < l.length) op('mover', { id, cod: buscar(id).cod, pos: k }, 'Entrada movida. Los números se han actualizado.'); };
    const bS = $('[data-sube]', e); if (bS) bS.onclick = () => mov(-1);
    const bB = $('[data-baja]', e); if (bB) bB.onclick = () => mov(1);
    const bFi = $('[data-fila]', e); if (bFi) bFi.onclick = async () => { const r = await op('nuevaFila', { id }, 'Fila añadida.'); if (r) { const c = $(`.merito[data-id="${id}"] .val[data-f="${r.fila}"]`); if (c) c.click(); } };
    const bP = $('[data-priv]', e); if (bP) bP.onclick = () => op('privado', { id }, buscar(id).privado ? 'Visible para el tribunal.' : 'Oculto al tribunal.');
    $$('[data-ok]', e).forEach((b) => { b.onclick = () => op('aceptar', { id, sha: b.dataset.ok }, 'PDF confirmado y colocado en su carpeta.'); });
    $$('[data-qui]', e).forEach((b) => { b.onclick = () => { if (sel === id && selSha === b.dataset.qui) { sel = null; selSha = null; } op('quitarPdf', { id, sha: b.dataset.qui }, 'PDF quitado. Sigue guardado en la carpeta de revisar.'); }; });
    $$('[data-cam]', e).forEach((b) => { b.onclick = async () => { const r = await op('elegirPdf', { id, sustituir: b.dataset.cam }, 'PDF cambiado.'); if (r) { sel = id; selSha = r.sha; pintarLista(); pintarVisor(); } }; });
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
  function cerrarPdf() { verNuevo = null; sel = null; selSha = null; suelto = null; $$('.docsuelto').forEach((x) => x.classList.remove('on')); $$('.merito').forEach((x) => x.classList.remove('on')); pintarVisor(); }
  function pintarVisor() {
    const m = sel && buscar(sel);
    const p = m && m.pdfs.find((x) => x.sha === selSha);
    const v = $('#visor');
    if (!p && verNuevo && actual && actual.nuevos) {
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
    $('#vTit').textContent = `${m.cod === 'SC' ? 'Sin clasificar' : `${m.n && !APD(m.cod).sinNum ? `Nº ${m.n} · ` : ''}${nombreDe(m.cod)}`}${p.nivel !== 'alta' ? ' · sin confirmar' : ''}`;
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
    if (!trabajo && actual && !actual.ficha && !actual.inicio && !entradas(actual.c).length) actual = null;
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
  document.addEventListener('click', cerrar);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrar();
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !document.activeElement.isContentEditable && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); deshacer(); }
  });
  pintarCab(); pintarMenu(); pintarEditor();
  irInicio();
  window.__listo = true;
})();
