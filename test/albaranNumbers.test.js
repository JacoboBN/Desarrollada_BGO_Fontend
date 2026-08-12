'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  cleanAlbaranDisplayId,
  normalizeAlbaranNumberForMatch
} = require('../lib/albaranNumbers');

const equivalentPairs = [
  ['AL-1234', 'AL1234'],
  ['AL/1234', 'AL1234'],
  ['AL 1234', 'AL1234'],
  ['AL.1234', 'AL1234'],
  ['12.345.678', '12345678'],
  ['AL AB123', 'AB123'],
  ['ALAB123', 'AB123']
];

test('normaliza formatos equivalentes de números de albarán', () => {
  for (const [left, right] of equivalentPairs) {
    assert.equal(
      normalizeAlbaranNumberForMatch(left),
      normalizeAlbaranNumberForMatch(right),
      `${left} debería coincidir con ${right}`
    );
  }
});

test('conserva prefijos AL que forman parte de un identificador genuino', () => {
  assert.equal(cleanAlbaranDisplayId('ALANTR123'), 'ALANTR123');
  assert.equal(normalizeAlbaranNumberForMatch('ALANTR123'), 'alantr123');
  assert.notEqual(
    normalizeAlbaranNumberForMatch('ALANTR123'),
    normalizeAlbaranNumberForMatch('ANTR123')
  );
});

test('tolera mayúsculas, espacios, puntuación y tildes al comparar', () => {
  assert.equal(
    normalizeAlbaranNumberForMatch('  ALB-ÁB/12.345  '),
    normalizeAlbaranNumberForMatch('ab12345')
  );
});