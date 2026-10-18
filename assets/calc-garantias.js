/* ============================================================
   AVALIUM — Motor de cálculo de garantías ante la AEAT
   Lo usan: la calculadora pública (/calculadora-garantia-aeat),
   la herramienta interna (/admin/calculadora) y la función
   /api/calculadora (que recalcula en el servidor el informe que
   se envía por email). Un único motor = una única verdad.

   NORMATIVA APLICADA (revisada en octubre de 2026)
   ------------------------------------------------------------
   Tipos de interés 2026 (LPGE 2023, Ley 31/2022, prorrogada):
     · interés legal del dinero ........ 3,25 %
     · interés de demora tributario .... 4,0625 %
   Art. 26.6 LGT: el interés exigible es el LEGAL solo si la deuda
     aplazada, fraccionada o suspendida está garantizada en su
     totalidad con aval solidario de entidad de crédito o SGR, o con
     certificado de seguro de caución. Con hipoteca u otra garantía
     se aplica el de DEMORA.
   Orden HFP/311/2023: no se exige garantía si el importe conjunto
     no supera 50.000 € (deudas de la solicitud + solicitudes en
     trámite + vencimientos pendientes de aplazamientos sin garantía).
   Art. 48.2 y 48.3 RGR (RD 939/2005): la garantía cubre
     · periodo voluntario: deuda + intereses + 25 % de ambas partidas
     · periodo ejecutivo: deuda + recargo + intereses + 5 % de ambas
   Art. 53 RGR: intereses desde el día siguiente al fin del periodo
     voluntario hasta el vencimiento de cada plazo; en ejecutivo la
     base no incluye el recargo. En fraccionamientos, por fracción.
   Art. 28 LGT + STS 27-3-2019 y TEAC 26-11-2019 (unificación de
     criterio): aplazar no equivale a pagar; en un aplazamiento en
     ejecutivo no cabe el 5 % y el 10 % exige pagar todo dentro del
     plazo de la providencia, así que se dimensiona con el 20 %.
   Art. 65.2 LGT: deudas inaplazables (retenciones, pagos
     fraccionados del IS, tributos repercutidos cobrados, etc.).
   Instrucción 2/2023 del Dpto. de Recaudación (sustituye a la 1/2017):
     plazos máximos de concesión según garantía
     · aval o seguro de caución ........................ 60 meses
     · inmueble urbano libre de cargas ................. 36 meses
     · otras garantías ................................. 24 meses
     · dispensa total o parcial ........................ 12 meses
     · sin garantía (≤ 50.000 €, resolución automatizada):
       12 meses personas jurídicas / 24 meses personas físicas
     · excepcionalmente, hasta 60 meses con autorización.
   Instrucción 1/2023 de garantías (TERCERA), modificada por la
     Instrucción 1/2026 (en vigor desde el 8-4-2026):
     · inmueble urbano con cargas: valor tras descontar cargas
       > 115 % de la deuda a garantizar
     · inmueble rústico: valor ≥ 200 % de la deuda a garantizar
     · tasación: en aplazamientos, preferentemente por profesional
       inscrito en registro oficial (ya no es indispensable); en
       suspensiones, OBLIGATORIAMENTE por tasador inscrito.
   Suspensión: art. 233.1 LGT (deuda + intereses + recargos que
     procederían si se ejecuta la garantía = 20 %, TEAC 30-9-2014);
     233.2 (suspensión automática solo con depósito, aval o seguro de
     caución); 233.3 (otras garantías, p. ej. hipoteca, cuando no se
     pueden aportar las anteriores; decide el órgano competente).
     Reposición: art. 224 LGT, solo admite las garantías de la
     suspensión automática. Sanciones: suspensión automática sin
     garantía en vía administrativa (arts. 212.3 y 233.1 LGT).
     Meses de intereses (arts. 25.3 y 41.1 RGRVA, RD 520/2005):
     reposición 1 · TEA abreviado 6 · general 12 · con alzada 24.
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AvaliumCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NORMATIVA = {
    revision: 'octubre de 2026',
    interesLegal: 3.25,
    interesDemora: 4.0625,
    limiteExento: 50000,
    recargoApremio: 20,
    margenVoluntario: 25,
    margenEjecutivo: 5,
    plazosMax: {
      aval: 60, urbano_libre: 36, urbano_cargas: 24, rustico: 24, otras: 24, dispensa: 12,
      exento_juridica: 12, exento_fisica: 24, excepcional: 60
    },
    coberturaBien: { urbano_libre: 1, urbano_cargas: 1.15, rustico: 2 },
    mesesSuspension: { reposicion: 1, tea_abreviado: 6, tea_general: 12, tea_alzada: 24, contencioso: 24 }
  };

  var GARANTIAS = {
    aval: 'Aval bancario, de SGR o seguro de caución',
    urbano_libre: 'Hipoteca sobre inmueble urbano libre de cargas',
    urbano_cargas: 'Hipoteca sobre inmueble urbano con cargas previas',
    rustico: 'Hipoteca sobre finca rústica',
    otras: 'Otra garantía (prenda, fianza personal y solidaria…)',
    dispensa: 'Dispensa total o parcial de garantías'
  };

  var VIAS = {
    reposicion: 'Recurso de reposición',
    tea_abreviado: 'Reclamación económico-administrativa · procedimiento abreviado',
    tea_general: 'Reclamación económico-administrativa · procedimiento general',
    tea_alzada: 'Reclamación ante el TEAR con recurso de alzada ante el TEAC',
    contencioso: 'Recurso contencioso-administrativo'
  };

  var TIPOS_DEUDA = {
    general: 'Liquidación, autoliquidación o sanción (IRPF, Sociedades, etc.)',
    repercutido: 'IVA u otro tributo repercutido',
    retenciones: 'Retenciones o ingresos a cuenta',
    pago_fraccionado: 'Pago fraccionado del Impuesto sobre Sociedades'
  };

  function r2(x) { return Math.round((Number(x) || 0) * 100) / 100; }
  function num(x) {
    if (typeof x === 'number') return isFinite(x) ? x : 0;
    var s = String(x == null ? '' : x).trim().replace(/\s/g, '').replace(/€/g, '');
    // Admite "1.250.000,50", "1250000.50" y "1,250,000.50"
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');
    else s = s.replace(',', '.');
    var v = parseFloat(s);
    return isFinite(v) ? v : 0;
  }
  function entero(x, min, max) {
    var v = Math.round(num(x));
    if (!isFinite(v)) v = min;
    return Math.min(max, Math.max(min, v));
  }

  // Valor mínimo que debe tener el bien ofrecido (Instrucción 1/2023, TERCERA)
  function valorMinimoBien(garantia, importe, cargas) {
    var cob = NORMATIVA.coberturaBien[garantia];
    if (!cob || importe <= 0) return null;
    var c = Math.max(0, cargas || 0);
    var neto = importe * cob;
    return {
      cobertura: cob,
      cargas: r2(c),
      valorNetoMinimo: r2(neto),
      tasacionMinima: r2(neto + c),
      estricto: garantia === 'urbano_cargas'   // la norma dice "superase": debe quedar por encima
    };
  }

  /* --------------------------------------------------------------
     APLAZAMIENTO / FRACCIONAMIENTO
     e = {
       deuda, otrasDeudas, periodo: 'voluntario'|'ejecutivo',
       modalidad: 'fraccionamiento'|'aplazamiento', meses,
       garantia: clave de GARANTIAS, cargas,
       contribuyente: 'juridica'|'fisica', mesesTranscurridos,
       tipoDeuda: clave de TIPOS_DEUDA
     }
     -------------------------------------------------------------- */
  function calcularAplazamiento(e) {
    e = e || {};
    var deuda = r2(Math.max(0, num(e.deuda)));
    var otras = r2(Math.max(0, num(e.otrasDeudas)));
    var periodo = e.periodo === 'ejecutivo' ? 'ejecutivo' : 'voluntario';
    var modalidad = e.modalidad === 'aplazamiento' ? 'aplazamiento' : 'fraccionamiento';
    var garantia = GARANTIAS[e.garantia] ? e.garantia : 'urbano_libre';
    var contribuyente = e.contribuyente === 'fisica' ? 'fisica' : 'juridica';
    var tipoDeuda = TIPOS_DEUDA[e.tipoDeuda] ? e.tipoDeuda : 'general';
    var cargas = Math.max(0, num(e.cargas));
    var transcurridos = periodo === 'ejecutivo' ? entero(e.mesesTranscurridos, 0, 120) : 0;
    var meses = entero(e.meses || 12, 1, 60);
    var avisos = [];
    var fundamentos = [];

    var inaplazable = tipoDeuda === 'retenciones' || tipoDeuda === 'pago_fraccionado';
    if (inaplazable) {
      avisos.push({ nivel: 'alto', texto: (tipoDeuda === 'retenciones'
        ? 'Las retenciones e ingresos a cuenta no se pueden aplazar ni fraccionar'
        : 'Los pagos fraccionados del Impuesto sobre Sociedades no se pueden aplazar ni fraccionar') +
        ' (art. 65.2 LGT): la AEAT inadmite la solicitud. Hay que buscar otra vía (pago, suspensión si se recurre, etc.).' });
    }
    if (tipoDeuda === 'repercutido') {
      avisos.push({ nivel: 'medio', texto: 'El IVA y demás tributos repercutidos solo se pueden aplazar si acreditas que las cuotas repercutidas no se han cobrado (art. 65.2.f LGT). Si se han cobrado, la solicitud se inadmite.' });
    }

    // Límite exento de garantía (Orden HFP/311/2023)
    var computo = deuda + otras;
    var exento = deuda > 0 && computo <= NORMATIVA.limiteExento;
    var dudoso = false;
    if (exento && periodo === 'ejecutivo' && (deuda * (1 + NORMATIVA.recargoApremio / 100) + otras) > NORMATIVA.limiteExento) {
      dudoso = true;
      avisos.push({ nivel: 'medio', texto: 'Estás cerca del límite de 50.000 €: si la AEAT computa también el recargo del periodo ejecutivo, podría exigirte garantía. Conviene revisarlo antes de presentar la solicitud.' });
    }

    var plazoMax = exento
      ? NORMATIVA.plazosMax[contribuyente === 'fisica' ? 'exento_fisica' : 'exento_juridica']
      : NORMATIVA.plazosMax[garantia];
    if (meses > plazoMax) {
      avisos.push({ nivel: 'medio', texto: 'Has pedido ' + meses + ' meses y el máximo habitual ' +
        (exento ? 'sin garantía para ' + (contribuyente === 'fisica' ? 'personas físicas' : 'empresas') : 'con esta garantía') +
        ' es de ' + plazoMax + ' meses (Instrucción 2/2023). Solo se supera en casos excepcionales, con autorización del Departamento de Recaudación y hasta 60 meses.' });
    }

    var interesLegal = !exento && garantia === 'aval';
    var tipo = interesLegal ? NORMATIVA.interesLegal : NORMATIVA.interesDemora;
    var recargo = periodo === 'ejecutivo' ? r2(deuda * NORMATIVA.recargoApremio / 100) : 0;

    // Calendario (art. 53 RGR): intereses por fracción, sobre principal sin recargo
    var cuadro = [];
    var intereses = 0;
    if (modalidad === 'aplazamiento') {
      var i1 = r2(deuda * tipo / 100 * (meses + transcurridos) / 12);
      intereses = i1;
      cuadro.push({ n: 1, mes: meses, principal: deuda, recargo: recargo, intereses: i1, total: r2(deuda + recargo + i1) });
    } else {
      var acumP = 0, acumR = 0;
      for (var n = 1; n <= meses; n++) {
        var p = n < meses ? r2(deuda / meses) : r2(deuda - acumP);
        var rc = n < meses ? r2(recargo / meses) : r2(recargo - acumR);
        acumP = r2(acumP + p); acumR = r2(acumR + rc);
        var it = r2(p * tipo / 100 * (n + transcurridos) / 12);
        intereses = r2(intereses + it);
        cuadro.push({ n: n, mes: n, principal: p, recargo: rc, intereses: it, total: r2(p + rc + it) });
      }
    }

    var margenPct = periodo === 'ejecutivo' ? NORMATIVA.margenEjecutivo : NORMATIVA.margenVoluntario;
    var baseGarantia = r2(deuda + recargo + intereses);
    var margen = exento ? 0 : r2(baseGarantia * margenPct / 100);
    var importeGarantizar = exento ? 0 : r2(baseGarantia + margen);

    var bien = exento ? null : valorMinimoBien(garantia, importeGarantizar, cargas);

    if (!exento && garantia !== 'aval' && garantia !== 'dispensa') {
      avisos.push({ nivel: 'info', texto: 'La AEAT solo admite hipoteca u otras garantías si justificas que no puedes obtener aval bancario o seguro de caución, o que obtenerlo compromete gravemente la viabilidad de tu actividad (art. 82.1 LGT). Guarda las denegaciones de los bancos.' });
    }
    if (bien) {
      avisos.push({ nivel: 'info', texto: 'Tasación: en aplazamientos la AEAT prefiere una sociedad o profesional inscrito en un registro oficial de tasadores, pero desde la Instrucción 1/2026 ya no es requisito indispensable: vale un perito con titulación suficiente. No sirve la valoración de un agente de la propiedad inmobiliaria.' });
    }
    if (garantia === 'dispensa' && !exento) {
      avisos.push({ nivel: 'medio', texto: 'La dispensa de garantías exige acreditar que careces de bienes suficientes y que la ejecución afectaría gravemente a la actividad o al empleo (art. 82.2.b LGT). Si se concede, el plazo máximo es de 12 meses.' });
    }

    fundamentos.push('Art. 65 LGT y arts. 44 a 54 RGR (RD 939/2005)');
    fundamentos.push(exento ? 'Orden HFP/311/2023: exento de garantía hasta 50.000 €' : 'Art. 48.' + (modalidad === 'fraccionamiento' ? '3' : '2') + ' RGR: deuda ' + (periodo === 'ejecutivo' ? '+ recargo ' : '') + '+ intereses + ' + margenPct + ' %');
    fundamentos.push('Art. 26.6 LGT: ' + (interesLegal ? 'interés legal (3,25 %) por garantía de aval o seguro de caución' : 'interés de demora (4,0625 % en 2026)'));
    fundamentos.push('Instrucción 2/2023 del Departamento de Recaudación: plazo máximo de ' + plazoMax + ' meses');
    if (bien) fundamentos.push('Instrucción 1/2023 de garantías (mod. Instrucción 1/2026): valor mínimo del inmueble');

    var cuotaMedia = cuadro.length ? r2(cuadro.reduce(function (s, c) { return s + c.total; }, 0) / cuadro.length) : 0;

    return {
      modo: 'aplazamiento',
      entrada: { deuda: deuda, otrasDeudas: otras, periodo: periodo, modalidad: modalidad, meses: meses, garantia: garantia,
                 cargas: r2(cargas), contribuyente: contribuyente, mesesTranscurridos: transcurridos, tipoDeuda: tipoDeuda },
      inaplazable: inaplazable,
      exento: exento,
      dispensa: garantia === 'dispensa' && !exento,
      exentoDudoso: dudoso,
      plazoMax: plazoMax,
      tipoInteres: tipo,
      interesLegal: interesLegal,
      recargo: recargo,
      intereses: r2(intereses),
      margenPct: margenPct,
      margen: margen,
      importeGarantizar: importeGarantizar,
      totalAPagar: r2(deuda + recargo + intereses),
      cuotaMedia: cuotaMedia,
      primeraCuota: cuadro.length ? cuadro[0].total : 0,
      ultimaCuota: cuadro.length ? cuadro[cuadro.length - 1].total : 0,
      bien: bien,
      cuadro: cuadro,
      avisos: avisos,
      fundamentos: fundamentos,
      etiquetas: { garantia: GARANTIAS[garantia], tipoDeuda: TIPOS_DEUDA[tipoDeuda] }
    };
  }

  /* --------------------------------------------------------------
     SUSPENSIÓN DE LA EJECUCIÓN MIENTRAS SE RECURRE
     e = { deuda, sanciones, via: clave de VIAS, reposicionPrevia,
           garantia: clave de GARANTIAS, cargas }
     -------------------------------------------------------------- */
  function calcularSuspension(e) {
    e = e || {};
    var deuda = r2(Math.max(0, num(e.deuda)));
    var sanciones = r2(Math.min(deuda, Math.max(0, num(e.sanciones))));
    var via = VIAS[e.via] ? e.via : 'tea_general';
    var garantia = GARANTIAS[e.garantia] ? e.garantia : 'urbano_libre';
    if (garantia === 'dispensa') garantia = 'otras';
    var cargas = Math.max(0, num(e.cargas));
    var esTea = /^tea_/.test(via);
    var reposicionPrevia = !!e.reposicionPrevia && esTea;
    var avisos = [];
    var fundamentos = [];

    // Sanciones: suspensión automática sin garantía en vía administrativa
    var sancionesExcluidas = via !== 'contencioso' ? sanciones : 0;
    var base = r2(deuda - sancionesExcluidas);
    if (sanciones > 0 && via !== 'contencioso') {
      avisos.push({ nivel: 'info', texto: 'Las sanciones recurridas (' + fmt(sanciones) + ') quedan suspendidas automáticamente y sin garantía mientras no sean firmes en vía administrativa (arts. 212.3 y 233.1 LGT). No las incluimos en la garantía.' });
    }
    if (sanciones > 0 && via === 'contencioso') {
      avisos.push({ nivel: 'medio', texto: 'En vía contencioso-administrativa la suspensión de las sanciones se mantiene si la pides al tribunal, que decidirá sobre ella. Por prudencia las incluimos en el cálculo.' });
    }

    var meses = NORMATIVA.mesesSuspension[via] + (reposicionPrevia ? NORMATIVA.mesesSuspension.reposicion : 0);
    var interesLegal = garantia === 'aval';
    var tipo = interesLegal ? NORMATIVA.interesLegal : NORMATIVA.interesDemora;
    var intereses = r2(base * tipo / 100 * meses / 12);
    var recargo = r2(base * NORMATIVA.recargoApremio / 100);
    var importeGarantizar = base > 0 ? r2(base + intereses + recargo) : 0;
    var automatica = garantia === 'aval';
    var bien = valorMinimoBien(garantia, importeGarantizar, cargas);

    if (via === 'reposicion' && !automatica) {
      avisos.push({ nivel: 'alto', texto: 'En el recurso de reposición la suspensión solo se obtiene con depósito, aval o seguro de caución (art. 224 LGT). Con un inmueble, la vía es la reclamación económico-administrativa, donde cabe la suspensión con otras garantías (art. 233.3 LGT).' });
    } else if (!automatica) {
      avisos.push({ nivel: 'info', texto: 'Con hipoteca u otras garantías la suspensión no es automática: la acuerda el órgano competente si acreditas que no puedes aportar aval, depósito o seguro de caución (art. 233.3 LGT). Si la deuda está en periodo voluntario, la solicitud paraliza cautelarmente el cobro mientras se decide (art. 44 RGRVA).' });
    } else {
      avisos.push({ nivel: 'info', texto: 'Con depósito, aval o seguro de caución la suspensión es automática (art. 233.2 LGT) y se aplica el interés legal (3,25 %) en lugar del de demora (art. 26.6 LGT).' });
    }
    if (bien) {
      avisos.push({ nivel: 'medio', texto: 'Tasación: en suspensiones sigue siendo obligatorio que la haga una sociedad o profesional inscrito en el registro oficial de tasadores (Instrucción 1/2026). Una tasación sin ese requisito se deniega.' });
    }
    if (via === 'contencioso') {
      avisos.push({ nivel: 'medio', texto: 'En vía judicial es el tribunal quien fija la garantía (caución). Calculamos 2 años de intereses como estimación; la suspensión obtenida en vía administrativa puede mantenerse si se comunica la interposición del recurso y la petición de suspensión.' });
    }

    fundamentos.push('Art. 233.1 LGT: importe del acto + intereses de demora + recargos (20 %) que procederían si se ejecuta la garantía');
    fundamentos.push(via === 'reposicion' ? 'Art. 224 LGT y art. 25 RGRVA (RD 520/2005)' : 'Arts. 39 a 47 RGRVA (RD 520/2005)');
    fundamentos.push('Meses de intereses: ' + meses + ' (arts. 25.3 y 41.1 RGRVA' + (via === 'contencioso' ? '; en contencioso, estimación' : '') + ')');
    fundamentos.push('Art. 26.6 LGT: ' + (interesLegal ? 'interés legal (3,25 %)' : 'interés de demora (4,0625 % en 2026)'));
    if (bien) fundamentos.push('Instrucción 1/2023 de garantías (mod. Instrucción 1/2026): valor mínimo del inmueble');

    return {
      modo: 'suspension',
      entrada: { deuda: deuda, sanciones: sanciones, via: via, reposicionPrevia: reposicionPrevia, garantia: garantia, cargas: r2(cargas) },
      base: base,
      sancionesExcluidas: sancionesExcluidas,
      meses: meses,
      tipoInteres: tipo,
      interesLegal: interesLegal,
      intereses: intereses,
      recargo: recargo,
      importeGarantizar: importeGarantizar,
      automatica: automatica,
      bien: bien,
      avisos: avisos,
      fundamentos: fundamentos,
      etiquetas: { garantia: GARANTIAS[garantia], via: VIAS[via] }
    };
  }

  var fmtEur = null;
  function fmt(x) {
    try {
      if (!fmtEur) fmtEur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
      return fmtEur.format(x || 0);
    } catch (e) { return (Math.round((x || 0) * 100) / 100).toFixed(2) + ' €'; }
  }
  function pct(x) { return String(x).replace('.', ',') + ' %'; }

  return {
    NORMATIVA: NORMATIVA,
    GARANTIAS: GARANTIAS,
    VIAS: VIAS,
    TIPOS_DEUDA: TIPOS_DEUDA,
    calcularAplazamiento: calcularAplazamiento,
    calcularSuspension: calcularSuspension,
    calcular: function (modo, e) { return modo === 'suspension' ? calcularSuspension(e) : calcularAplazamiento(e); },
    num: num,
    fmt: fmt,
    pct: pct
  };
});
