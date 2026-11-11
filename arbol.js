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
      ap(g2, '2.2', 'Cargos y actividades desempeñados con anterioridad', 'Cargos_anteriores', { tabla: true }),
    ] },
    { gr: 'Formación académica recibida', aps: [
      ap(g3, '3.1', 'Estudios de 1º y 2º ciclo, y antiguos ciclos (Licenciados, Diplomados, Ingenieros Superiores, Ingenieros Técnicos, Arquitectos)', 'Estudios_1_2_ciclo', { sub: 'Titulación universitaria' }),
      ap(g3, '3.2', 'Doctorados', 'Doctorados', { sub: 'Titulación universitaria', sinNum: true }),
      ap(g3, '3.3', 'Otra formación universitaria de posgrado', 'Otra_formacion_posgrado', { sub: 'Titulación universitaria', sinNum: true }),
      ap(g3, '3.4', 'Formación especializada, continuada, técnica, profesionalizada, de reciclaje y actualización (distinta a la formación académica reglada y a la sanitaria)', 'Formacion_especializada', { sinNum: true }),
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
      ap(g4, '4.8', 'Otros méritos de docencia', 'Otros_meritos_docencia', { sinNum: true }),
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
      ap(g6, '6.7', 'Gestión de I+D+i', 'Gestion', { sub: 'Gestión de I+D+i y participación en comités científicos', sinNum: true }),
      ap(g6, '6.8', 'Estancias en centros públicos o privados', 'Estancias', { sub: 'Otros méritos' }),
      ap(g6, '6.9', 'Ayudas y becas obtenidas', 'Ayudas_becas', { sub: 'Otros méritos' }),
      ap(g6, '6.10', 'Premios, menciones y distinciones', 'Premios', { sub: 'Otros méritos' }),
      ap(g6, '6.11', 'Períodos de actividad investigadora, docente y de transferencia del conocimiento', 'Sexenios', { sub: 'Otros méritos' }),
      ap(g6, '6.12', 'Acreditaciones/reconocimientos obtenidos', 'Acreditaciones', { sub: 'Otros méritos' }),
      ap(g6, '6.13', 'Otros méritos de la actividad investigadora', 'Otros_meritos', { sub: 'Otros méritos', sinNum: true }),
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
  ARBOL.menu.push(['Ajustes', [['', 'Publicar en la web'], ['', 'Generar HTML'], ['', 'Generar ejecutable para PC'], ['', 'Generar ejecutable para Mac'], ['', 'Generar ZIP'], ['', 'Generar carpeta del CV'], ['', 'Generar CV en Word (CVN)'], ['', 'Completar y clasificar méritos'], ['', 'Incorporar méritos nuevos'], ['', 'Menú vertical u horizontal'], ['', 'Cerrar expediente'], ['', 'Documentos sin usar'], ['', 'Apartados eliminados']]]);
  if (typeof module !== 'undefined' && module.exports) module.exports = ARBOL;
  else raiz.ARBOL = ARBOL;
})(typeof window !== 'undefined' ? window : globalThis);
