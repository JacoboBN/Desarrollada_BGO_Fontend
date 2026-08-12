'use strict';

// "AL" puede aparecer como etiqueta del proveedor delante del número real.
// Se elimina cuando está separada por puntuación/espacio, cuando precede
// directamente a dígitos (AL1234) o en el formato histórico ALAB123.
// No se eliminan letras de identificadores genuinos como ALANTR123.
const AL_LABEL_PREFIX = /^AL(?:[\s._\-/:#]+|(?=\d)|(?=AB\d))/i;

function cleanAlbaranDisplayId(value = '') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';

  return raw.replace(AL_LABEL_PREFIX, '').trim();
}

function normalizeAlbaranNumberForMatch(value = '') {
  return cleanAlbaranDisplayId(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^(?:(?:albaran(?:es)?|alb)[\s._\-/:#]+)+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

module.exports = {
  cleanAlbaranDisplayId,
  normalizeAlbaranNumberForMatch
};