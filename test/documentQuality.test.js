const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildQualityPayload,
  evaluateDocumentExtractionQuality,
  SEVERITIES
} = require('../lib/documentQuality');

test('un albarán persistido individualmente se normaliza como albarán válido', () => {
  const extracted = buildQualityPayload({
    documentType: 'albaran',
    persistence: {
      supplier: { name: 'Segado, S.L.', cif: 'B12345678' },
      deliveryNotes: [{
        delivery_note_number: '260120',
        date: '2026-01-26',
        total_amount: 120.5,
        receiver: 'Cliente',
        extraction_confidence: 0.88,
        raw_extraction: { num_albaran: '260120', fecha: '2026-01-26', total: 120.5 },
        extraction_warnings: []
      }]
    }
  });
  const quality = evaluateDocumentExtractionQuality({ docType: 'albaran', extracted });

  assert.deepEqual(extracted.albaranes.map((item) => item.num_albaran), ['260120']);
  assert.equal(extracted.proveedor_nombre, 'Segado, S.L.');
  assert.equal(quality.shouldSendEmail, false);
  assert.deepEqual(quality.mortalFields, []);
});

test('un albarán sin proveedor no genera email si tiene número y total', () => {
  const quality = evaluateDocumentExtractionQuality({
    docType: 'albaran',
    extracted: { confidence: 0.88, albaranes: [{ num_albaran: 'A-1', fecha: '2026-01-26', total: 100 }] }
  });

  assert.equal(quality.shouldSendEmail, false);
  assert.ok(quality.fieldsBySeverity[SEVERITIES.CRITICAL].includes('proveedor_nombre'));
});

test('una factura sin importes individuales por albarán se puede comparar por total global', () => {
  const quality = evaluateDocumentExtractionQuality({
    docType: 'factura',
    extracted: {
      num_factura: '0947',
      fecha: '2026-01-31',
      total: 1000,
      confidence: 0.88,
      albaranes: [
        { num_albaran: 'A-1', total: null },
        { num_albaran: 'A-2', total: null },
        { num_albaran: 'A-3', total: null },
        { num_albaran: 'A-4', total: null }
      ]
    }
  });

  assert.equal(quality.shouldSendEmail, false);
  assert.equal(quality.mortalFields.length, 0);
  assert.deepEqual(quality.fieldsBySeverity[SEVERITIES.MEDIUM].filter((field) => field.endsWith('.total')), [
    'albaranes[0].total',
    'albaranes[1].total',
    'albaranes[2].total',
    'albaranes[3].total'
  ]);
});

test('los identificadores y totales principales ausentes siguen siendo mortales', () => {
  const factura = evaluateDocumentExtractionQuality({
    docType: 'factura',
    extracted: { confidence: 0.88, albaranes: [] }
  });
  const albaran = evaluateDocumentExtractionQuality({
    docType: 'albaran',
    extracted: { confidence: 0.88, albaranes: [{ num_albaran: null, total: null }] }
  });

  assert.ok(factura.mortalFields.includes('num_factura'));
  assert.ok(factura.mortalFields.includes('total'));
  assert.ok(factura.mortalFields.includes('albaranes'));
  assert.ok(albaran.mortalFields.includes('albaranes[0].num_albaran'));
  assert.ok(albaran.mortalFields.includes('albaranes[0].total'));
  assert.equal(factura.shouldSendEmail, true);
  assert.equal(albaran.shouldSendEmail, true);
});

test('la confianza inferior a 0,60 es mortal y entre 0,60 y 0,75 es crítica', () => {
  const low = evaluateDocumentExtractionQuality({
    docType: 'albaran',
    extracted: { confidence: 0.59, albaranes: [{ num_albaran: 'A-1', total: 100 }] }
  });
  const review = evaluateDocumentExtractionQuality({
    docType: 'albaran',
    extracted: { confidence: 0.7, albaranes: [{ num_albaran: 'A-1', total: 100 }] }
  });

  assert.ok(low.mortalFields.includes('confidence'));
  assert.equal(low.shouldSendEmail, true);
  assert.ok(review.criticalFields.includes('confidence'));
  assert.equal(review.shouldSendEmail, false);
});