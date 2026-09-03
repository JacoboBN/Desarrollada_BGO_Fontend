const NULL_SENTINELS = new Set(['', '-', 'n/a', 'na', 'null', 'undefined', 'nan']);

const SEVERITIES = Object.freeze({
  MORTAL: 'mortal',
  CRITICAL: 'critico',
  MEDIUM: 'medio',
  INDIFFERENT: 'indiferente'
});

const EMAIL_CONFIDENCE_THRESHOLD = 0.6;
const REVIEW_CONFIDENCE_THRESHOLD = 0.75;

function isMissing(value) {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  return NULL_SENTINELS.has(value.trim().toLowerCase());
}

function normalizeDocumentType(value) {
  const type = String(value || '').trim().toLowerCase();
  return type === 'factura' || type === 'albaran' ? type : null;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstPresent(source = {}, keys = []) {
  for (const key of keys) {
    if (!isMissing(source?.[key])) return source[key];
  }
  return null;
}

// delivery_notes persiste cada albarán de forma individual. Se reconstruye el
// contrato de análisis para no confundir un albarán válido con un objeto raíz
// que no tenga la propiedad albaranes.
function buildQualityPayload({ documentType, persistence, fallback = {} } = {}) {
  const type = normalizeDocumentType(documentType);
  const source = fallback && typeof fallback === 'object' ? fallback : {};
  const persisted = persistence && typeof persistence === 'object' ? persistence : {};

  if (type === 'factura' && persisted?.invoice?.raw_extraction) {
    return persisted.invoice.raw_extraction;
  }

  const deliveryNotes = toArray(persisted?.deliveryNotes);
  if (type !== 'albaran' || !deliveryNotes.length) return source;

  const supplier = persisted?.supplier || {};
  const firstNote = deliveryNotes[0] || {};
  return {
    ...source,
    proveedor_cif: source.proveedor_cif ?? firstPresent(supplier, ['cif', 'normalized_cif']),
    proveedor_nombre: source.proveedor_nombre ?? firstPresent(supplier, ['name', 'nombre']),
    recibidor: source.recibidor ?? firstNote.receiver ?? firstNote.raw_extraction?.recibidor ?? null,
    albaranes: deliveryNotes.map((note) => {
      const raw = note?.raw_extraction && typeof note.raw_extraction === 'object'
        ? note.raw_extraction
        : {};
      return {
        ...raw,
        num_albaran: raw.num_albaran ?? note?.delivery_note_number ?? null,
        fecha: raw.fecha ?? note?.date ?? null,
        total: raw.total ?? note?.total_amount ?? null
      };
    }),
    confidence: source.confidence ?? firstNote.extraction_confidence ?? firstNote.raw_extraction?.confidence ?? null,
    extraction_warnings: source.extraction_warnings
      ?? firstNote.extraction_warnings
      ?? firstNote.raw_extraction?.extraction_warnings
      ?? []
  };
}

function evaluateDocumentExtractionQuality({ docType, extracted = {} } = {}) {
  const documentType = normalizeDocumentType(docType);
  const source = extracted && typeof extracted === 'object' ? extracted : {};
  const issues = [];
  const addMissing = (field, severity) => issues.push({ field, severity, reason: 'missing' });
  const checkMissing = (field, value, severity) => {
    if (isMissing(value)) addMissing(field, severity);
  };

  if (!documentType) addMissing('document_type', SEVERITIES.MORTAL);

  const albaranes = toArray(source.albaranes);
  const confidenceValue = Number(source.confidence);
  const confidence = Number.isFinite(confidenceValue) ? confidenceValue : null;
  const warnings = toArray(source.extraction_warnings)
    .map((warning) => String(warning || '').trim())
    .filter(Boolean);

  if (documentType === 'factura') {
    checkMissing('num_factura', source.num_factura, SEVERITIES.MORTAL);
    checkMissing('total', source.total, SEVERITIES.MORTAL);
    if (!albaranes.length) addMissing('albaranes', SEVERITIES.MORTAL);
    albaranes.forEach((albaran, index) => {
      checkMissing(`albaranes[${index}].num_albaran`, albaran?.num_albaran, SEVERITIES.MORTAL);
      // Una factura puede declarar los albaranes sin desglosar importe por cada
      // uno. En ese caso la comparación sigue siendo posible por total global.
      checkMissing(`albaranes[${index}].total`, albaran?.total, SEVERITIES.MEDIUM);
      checkMissing(`albaranes[${index}].fecha_albaran`, albaran?.fecha_albaran ?? albaran?.fecha, SEVERITIES.MEDIUM);
    });
    checkMissing('fecha', source.fecha, SEVERITIES.CRITICAL);
    checkMissing('proveedor_nombre', source.proveedor_nombre ?? source?.proveedor?.nombre, SEVERITIES.CRITICAL);
    checkMissing('proveedor_cif', source.proveedor_cif ?? source?.proveedor?.cif, SEVERITIES.MEDIUM);
    checkMissing('recibidor', source.recibidor, SEVERITIES.MEDIUM);
    checkMissing('total_sin_iva', source.total_sin_iva, SEVERITIES.MEDIUM);
    checkMissing('porcentaje_iva', source.porcentaje_iva, SEVERITIES.MEDIUM);
    checkMissing('iva', source.iva, SEVERITIES.MEDIUM);
  }

  if (documentType === 'albaran') {
    if (!albaranes.length) addMissing('albaranes', SEVERITIES.MORTAL);
    albaranes.forEach((albaran, index) => {
      checkMissing(`albaranes[${index}].num_albaran`, albaran?.num_albaran, SEVERITIES.MORTAL);
      checkMissing(`albaranes[${index}].total`, albaran?.total, SEVERITIES.MORTAL);
      checkMissing(`albaranes[${index}].fecha`, albaran?.fecha, SEVERITIES.CRITICAL);
    });
    checkMissing('proveedor_nombre', source.proveedor_nombre ?? source?.proveedor?.nombre, SEVERITIES.CRITICAL);
    checkMissing('proveedor_cif', source.proveedor_cif ?? source?.proveedor?.cif, SEVERITIES.MEDIUM);
    checkMissing('recibidor', source.recibidor, SEVERITIES.MEDIUM);
  }

  if (confidence === null) {
    issues.push({ field: 'confidence', severity: SEVERITIES.MEDIUM, reason: 'unavailable' });
  } else if (confidence < EMAIL_CONFIDENCE_THRESHOLD) {
    issues.push({ field: 'confidence', severity: SEVERITIES.MORTAL, reason: 'below_email-threshold' });
  } else if (confidence < REVIEW_CONFIDENCE_THRESHOLD) {
    issues.push({ field: 'confidence', severity: SEVERITIES.CRITICAL, reason: 'below-review-threshold' });
  }

  const fieldsBySeverity = Object.values(SEVERITIES).reduce((result, severity) => {
    result[severity] = issues.filter((issue) => issue.severity === severity).map((issue) => issue.field);
    return result;
  }, {});
  const mortalFields = fieldsBySeverity[SEVERITIES.MORTAL];
  const criticalFields = fieldsBySeverity[SEVERITIES.CRITICAL];
  const reasons = [];
  if (mortalFields.length) reasons.push(`Faltan o no son fiables campos mortales: ${mortalFields.join(', ')}.`);
  if (criticalFields.length) reasons.push(`Campos críticos a revisar: ${criticalFields.join(', ')}.`);

  return {
    documentType,
    extracted: source,
    confidence,
    warnings,
    issues,
    fieldsBySeverity,
    mortalFields,
    criticalFields,
    missingFields: issues.filter((issue) => issue.reason === 'missing').map((issue) => issue.field),
    blockingFields: mortalFields,
    hasErrors: mortalFields.length > 0,
    shouldSendEmail: mortalFields.length > 0,
    reasons
  };
}

module.exports = {
  SEVERITIES,
  EMAIL_CONFIDENCE_THRESHOLD,
  REVIEW_CONFIDENCE_THRESHOLD,
  isMissing,
  buildQualityPayload,
  evaluateDocumentExtractionQuality
};