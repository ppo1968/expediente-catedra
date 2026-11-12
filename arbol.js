// Estructura del expediente: los títulos, epígrafes y orden exactos del CVN.
// El código solo sirve para ordenar las carpetas; en pantalla no se muestra, igual que en el CVN.
(function (raiz) {
  const J = '02_Justificantes';
  const ap = (carpeta, cod, nom, dir, o = {}) => ({ cod, nom, dir: `${J}/${carpeta}/${cod}_${dir}`, ...o });
  const g2 = '2_Situacion_profesional', g3 = '3_Formacion_recibida', g4 = '4_Actividad_docente', g5 = '5_Experiencia_cientifica', g6 = '6_Actividades_cientificas';
  const ARBOL = [
    { gr: 'Por decidir', aps: [{ cod: 'SC', nom: 'Sin clasificar', dir: '_Revisar/Sin_clasificar' }] },
    { gr: 'Resumen libre del currículum', directo: true, aps: [ap('0_Resumen', 'R', 'Resumen libre del currículum', 'Resumen', { sinNum: true })] },
    { gr: 'José Pino Ortega', aps: [
      ap('1_Identificacion', '1', 'Identificación', 'Identificacion', { sinNum: true }),
      ap(g2, '2.1', 'Situación profesional actual', 'Situacion_actual'),
      ap(g2, '2.2', 'Puestos docentes con anterioridad', 'Cargos_anteriores', { tabla: true }),
    ] },
    { gr: 'Formación académica recibida', aps: [
      ap(g3, '3.1', 'Estudios de 1º y 2º ciclo, y antiguos ciclos (Licenciados, Diplomados, Ingenieros Superiores, Ingenieros Técnicos, Arquitectos)', 'Estudios_1_2_ciclo', { sub: 'Titulación universitaria' }),
      ap(g3, '3.2', 'Doctorados', 'Doctorados', { sub: 'Titulación universitaria' }),
      ap(g3, '3.3', 'Otra formación universitaria de posgrado', 'Otra_formacion_posgrado', { sub: 'Titulación universitaria' }),
      ap(g3, '3.4', 'Formación especializada, continuada, técnica, profesionalizada, de reciclaje y actualización (distinta a la formación académica reglada y a la sanitaria)', 'Formacion_especializada'),
      ap(g3, '3.5', 'Cursos y seminarios recibidos de perfeccionamiento, innovación y mejora docente, nuevas tecnologías, etc., cuyo objetivo sea la mejora de la docencia', 'Cursos_mejora_docente'),
    ] },
    { gr: 'Actividad docente', aps: [
      ap(g4, '4.1', 'Formación académica impartida', 'Formacion_impartida'),
      ap(g4, '4.2', 'Dirección de tesis doctorales y/o trabajos fin de estudios', 'Direccion_tesis_TFE'),
      ap(g4, '4.3', 'Tutorías académicas de estudiantes', 'Tutorias'),
      ap(g4, '4.4', 'Cursos y seminarios impartidos', 'Cursos_impartidos'),
      ap(g4, '4.5', 'Material y otras publicaciones docentes o de carácter pedagógico', 'Material_docente'),
      ap(g4, '4.6', 'Proyectos de innovación docente', 'Innovacion_docente'),
      ap(g4, '4.7', 'Aportaciones más relevantes de su CV de docencia', 'Aportaciones_docencia'),
      ap(g4, '4.8', 'Otros méritos de docencia', 'Otros_meritos_docencia'),
    ] },
    { gr: 'Experiencia científica y tecnológica', aps: [
      ap(g5, '5.1', 'Grupos/equipos de investigación, desarrollo o innovación', 'Grupos'),
      ap(g5, '5.2', 'Proyectos de I+D+i financiados en convocatorias competitivas de Administraciones o entidades públicas y privadas', 'Proyectos_competitivos', { sub: 'Actividad científica o tecnológica' }),
      ap(g5, '5.3', 'Contratos, convenios o proyectos de I+D+i no competitivos con Administraciones o entidades públicas o privadas', 'Contratos_no_competitivos', { sub: 'Actividad científica o tecnológica' }),
      ap(g5, '5.4', 'Resultados derivados de actividades especializadas y de transferencia no incluidos en apartados anteriores', 'Resultados_transferencia', { sub: 'Resultados' }),
    ] },
    { gr: 'Actividades científicas y tecnológicas', aps: [
      ap(g6, '6.1', 'Producción científica', 'Produccion_cientifica'),
      ap(g6, '6.2', 'Publicaciones, documentos científicos y técnicos', 'Publicaciones'),
      ap(g6, '6.3', 'Trabajos presentados en congresos nacionales o internacionales', 'Congresos'),
      ap(g6, '6.4', 'Trabajos presentados en jornadas, seminarios, talleres de trabajo y/o cursos nacionales o internacionales', 'Jornadas'),
      ap(g6, '6.5', 'Actividades de divulgación', 'Divulgacion'),
      ap(g6, '6.6', 'Comités científicos, técnicos y/o asesores', 'Comites', { sub: 'Gestión de I+D+i y participación en comités científicos' }),
      ap(g6, '6.7', 'Gestión de I+D+i', 'Gestion', { sub: 'Gestión de I+D+i y participación en comités científicos' }),
      ap(g6, '6.8', 'Estancias en centros públicos o privados', 'Estancias', { sub: 'Otros méritos' }),
      ap(g6, '6.9', 'Ayudas y becas obtenidas', 'Ayudas_becas', { sub: 'Otros méritos' }),
      ap(g6, '6.10', 'Premios, menciones y distinciones', 'Premios', { sub: 'Otros méritos' }),
      ap(g6, '6.11', 'Períodos de actividad investigadora, docente y de transferencia del conocimiento', 'Sexenios', { sub: 'Otros méritos' }),
      ap(g6, '6.12', 'Acreditaciones/reconocimientos obtenidos', 'Acreditaciones', { sub: 'Otros méritos' }),
      ap(g6, '6.13', 'Otros méritos de la actividad investigadora', 'Otros_meritos', { sub: 'Otros méritos' }),
    ] },
    { gr: 'Complementos', fuera: true, aps: [
      ['C.0', 'Méritos que no están en el CVN', 'C.0_No_estan_en_CVN'], ['C.1', 'Reconocimientos', 'C.1_Reconocimientos'], ['C.2', 'Aportaciones más relevantes', 'C.2_Aportaciones_relevantes'],
      ['C.3', 'Producción científica comentada', 'C.3_Produccion_comentada'], ['C.4', 'Software y datos', 'C.4_Software_y_datos'], ['C.5', 'Informe bibliométrico', 'C.5_Informe_bibliometrico'], ['C.6', 'Anexos', 'C.6_Anexos'],
    ].map(([cod, nom, dir]) => ({ cod, nom, dir: `03_Complementos/${dir}` })) },
  ];
  // Menú inicial: se deduce del árbol, con los epígrafes intermedios como títulos no pulsables.
  // Nombres cortos en el menú; el nombre completo del CVN sale como título dentro.
  ARBOL.corto = { 'José Pino Ortega': 'Perfil', 'Formación académica recibida': 'Formación', 'Actividad docente': 'Docencia', 'Experiencia científica y tecnológica': 'Investigación', 'Actividades científicas y tecnológicas': 'Investigación', Complementos: 'Complementos' };
  // v0.16: el bloque 6 del CVN (Actividades científicas y tecnológicas) va dentro de Investigación, con su nombre como título.
  ARBOL.menu = [['Inicio', null], ['Trayectoria', null, 'T']];
  for (const g of ARBOL) {
    if (g.gr === 'Por decidir') continue;
    if (g.directo) continue; // el resumen libre va en la portada, en «Sobre mí»
    const nom = ARBOL.corto[g.gr] || g.gr, previo = ARBOL.menu.find((x) => x[0] === nom);
    const l = previo ? previo[1] : [];
    let ult = null;
    if (previo) l.push(['', g.gr, 'h']);
    for (const a of g.aps) {
      if (a.sub && a.sub !== ult) l.push(['', a.sub, 'h']);
      ult = a.sub || null;
      l.push([a.cod, a.nom]);
    }
    if (!previo) ARBOL.menu.push([nom, l]);
  }
  // v0.17: opciones del menú que siguen la estructura del disco E: (05_CV_INVESTIGACION_*, 06_CV_TRANSFERENCIA_*…).
  // Cada una agrupa méritos de un apartado del CVN («cod»); el mérito guarda la opción en «vista».
  // El CVN, el Word y las carpetas del tribunal siguen usando el apartado del CVN.
  ARBOL.vistas = {
    tfg: { cod: '4.2', nom: 'Trabajos fin de grado dirigidos' }, tfm: { cod: '4.2', nom: 'Trabajos fin de máster dirigidos' }, trib_tfg: { cod: '6.13', nom: 'Tribunales de TFG' },
    gid: { cod: '5.1', nom: 'Grupo de innovación docente' },
    grupos: { cod: '5.1', nom: 'Grupos de investigación' }, proyectos: { cod: '5.2', nom: 'Proyectos de I+D+i' },
    articulos: { cod: '6.2', nom: 'Artículos' }, libros: { cod: '6.2', nom: 'Libros y capítulos' }, indicadores: { cod: '6.1', nom: 'Indicadores de calidad y rankings' },
    comunicaciones: { cod: '6.3', nom: 'Comunicaciones en congresos' }, ponencias: { cod: '6.3', nom: 'Ponencias invitadas y plenarias' }, virtuales: { cod: '6.3', nom: 'Conferencias virtuales' }, jornadas: { cod: '6.4', nom: 'Jornadas y seminarios' },
    cursos_inv: { cod: '4.4', nom: 'Cursos impartidos' }, master: { cod: '4.4', nom: 'Participación en másteres' }, erasmus: { cod: '4.3', nom: 'Tutorías Erasmus' },
    tesis: { cod: '4.2', nom: 'Tesis doctorales dirigidas' },
    editor: { cod: '6.6', nom: 'Editor y revisor de revistas' }, comites: { cod: '6.6', nom: 'Comités de congresos' }, evaluacion: { cod: '5.4', nom: 'Evaluación y consultoría' },
    trib_tesis: { cod: '6.13', nom: 'Tribunales de tesis' }, trib_plazas: { cod: '6.13', nom: 'Tribunales de plazas' },
    estancias: { cod: '6.8', nom: 'Estancias' }, ayudas: { cod: '6.9', nom: 'Ayudas y becas' }, sexenios: { cod: '6.11', nom: 'Sexenios y quinquenios' },
    sinubicar: { cod: '6.13', nom: 'Sin ubicar', trabajo: true },
    contratos: { cod: '5.3', nom: 'Contratos art. 83 y 60' }, sexenio_t: { cod: '6.11', nom: 'Sexenio de transferencia' }, software: { cod: '5.4', nom: 'Software y datos' },
    asesoramiento: { cod: '5.4', nom: 'Asesoramiento' }, catedras: { cod: '5.4', nom: 'Cátedras' }, creacion: { cod: '5.4', nom: 'Creación de grupo, sociedad y titulación' },
    formacion_emp: { cod: '5.4', nom: 'Formación y ponencias para empresas' }, divulgacion: { cod: '6.5', nom: 'Divulgación' }, estancias_t: { cod: '6.8', nom: 'Estancias de transferencia' },
    eventos: { cod: '6.6', nom: 'Organización de eventos' }, reconocimientos: { cod: '5.4', nom: 'Reconocimientos' }, revision: { cod: '6.6', nom: 'Revisión de libros' },
    gestion: { cod: '2.2', nom: 'Gestión universitaria' }, acreditaciones: { cod: '6.12', nom: 'Acreditaciones' }, premios: { cod: '6.10', nom: 'Premios y distinciones' },
    colef: { cod: '6.13', nom: 'Colegiación (COLEF)' }, padrino: { cod: '6.13', nom: 'Padrino de promoción' },
    tit_deportivas: { cod: '3.3', nom: 'Titulaciones deportivas' }, cursos_transf: { cod: '3.4', nom: 'Cursos orientados a la transferencia' },
  };
  const V = (...ids) => ids.map((i) => ['v:' + i, ARBOL.vistas[i].nom]);
  const H = (t) => ['', t, 'h'];
  ARBOL.menuV17 = {
    Docencia: [['4.1', 'Formación académica impartida'], H('Trabajos fin de estudios'), ...V('tfg', 'tfm', 'trib_tfg'), H('Cursos, material e innovación'), ['4.3', 'Tutorías académicas de estudiantes'], ['4.4', 'Cursos y seminarios impartidos'], ['4.5', 'Material y otras publicaciones docentes o de carácter pedagógico'], ['4.6', 'Proyectos de innovación docente'], ...V('gid'), ['4.7', 'Aportaciones más relevantes de su CV de docencia'], ['4.8', 'Otros méritos de docencia']],
    Investigación: [H('Grupos y proyectos'), ...V('grupos', 'proyectos'), H('Producción científica'), ...V('articulos', 'libros', 'indicadores'), H('Congresos y jornadas'), ...V('comunicaciones', 'ponencias', 'virtuales', 'jornadas'), H('Formación impartida'), ...V('cursos_inv', 'master', 'erasmus'), H('Dirección de tesis'), ...V('tesis'), H('Evaluación, comités y tribunales'), ...V('editor', 'comites', 'evaluacion', 'trib_tesis', 'trib_plazas'), H('Otros méritos de investigación'), ...V('estancias', 'ayudas', 'sexenios'), H('Por revisar'), ...V('sinubicar')],
    Transferencia: V('contratos', 'sexenio_t', 'software', 'asesoramiento', 'catedras', 'creacion', 'formacion_emp', 'divulgacion', 'estancias_t', 'eventos', 'reconocimientos', 'revision'),
    'Otros méritos': V('gestion', 'tit_deportivas', 'acreditaciones', 'premios', 'colef', 'padrino'),
  };
  // El menú inicial ya sale con la estructura de E:.
  for (const [b, l] of Object.entries(ARBOL.menuV17)) {
    const i = ARBOL.menu.findIndex((x) => x[0] === b);
    if (i >= 0) ARBOL.menu[i] = [b, l]; else ARBOL.menu.splice(ARBOL.menu.findIndex((x) => x[0] === 'Complementos'), 0, [b, l]);
  }
  ARBOL.menu.push(['Ajustes', [['', 'Publicar en la web'], ['', 'Generar HTML'], ['', 'Generar ejecutable para PC'], ['', 'Generar ejecutable para Mac'], ['', 'Generar ZIP'], ['', 'Generar carpeta del CV'], ['', 'Generar CV en Word (CVN)'], ['', 'Completar y clasificar méritos'], ['', 'Incorporar méritos nuevos'], ['', 'Carpetas de búsqueda de justificantes'], ['', 'Menú vertical u horizontal'], ['', 'Cerrar expediente'], ['', 'Documentos sin usar'], ['', 'Apartados eliminados']]]);
  if (typeof module !== 'undefined' && module.exports) module.exports = ARBOL;
  else raiz.ARBOL = ARBOL;
})(typeof window !== 'undefined' ? window : globalThis);
