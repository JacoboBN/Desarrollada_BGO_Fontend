const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getMissingExpectedAlbaranes,
  areAllExpectedAlbaranesReady
} = require('../lib/documentOrder');

const totalFile = (number) => ({ name: `Total${number}Alb.txt` });

test('albaranes primero y factura después: la factura queda lista', () => {
  const available = [totalFile('A-1'), totalFile('A-2')];
  assert.deepEqual(getMissingExpectedAlbaranes(['A-1', 'A-2'], available), []);
});

test('factura primero y todos los albaranes después', () => {
  assert.deepEqual(getMissingExpectedAlbaranes(['A-1', 'A-2'], []), ['A-1', 'A-2']);
  assert.deepEqual(
    getMissingExpectedAlbaranes(['A-1', 'A-2'], [totalFile('A-1'), totalFile('A-2')]),
    []
  );
});

test('factura, algunos albaranes y el resto posteriormente', () => {
  assert.deepEqual(getMissingExpectedAlbaranes(['A-1', 'A-2'], [totalFile('A-1')]), ['A-2']);
  assert.deepEqual(
    getMissingExpectedAlbaranes(['A-1', 'A-2'], [totalFile('A-1'), totalFile('A-2')]),
    []
  );
});

test('documentos sin contraparte permanecen pendientes', () => {
  assert.deepEqual(getMissingExpectedAlbaranes(['A-9'], [totalFile('B-1')]), ['A-9']);
  assert.equal(areAllExpectedAlbaranesReady({ expectedAlbaranes: [], matchedAlbaranes: [] }), false);
  assert.equal(
    areAllExpectedAlbaranesReady({ expectedAlbaranes: ['A-9'], missingAlbaranes: ['A-9'] }),
    false
  );
});
