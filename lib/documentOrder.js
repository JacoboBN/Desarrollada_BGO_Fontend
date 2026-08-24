const { normalizeAlbaranNumberForMatch } = require('./albaranNumbers');

function isTotalAlbaranFileForNumber(file, albaranNumber) {
  const expected = normalizeAlbaranNumberForMatch(albaranNumber);
  if (!expected) return false;
  const name = String(file?.name || '').trim();
  if (!/^total/i.test(name) || !/alb\.txt$/i.test(name)) return false;
  const numberFromFile = name.replace(/^total/i, '').replace(/alb\.txt$/i, '');
  return normalizeAlbaranNumberForMatch(numberFromFile) === expected;
}

function getMissingExpectedAlbaranes(expectedAlbaranes = [], availableFiles = []) {
  const expected = (Array.isArray(expectedAlbaranes) ? expectedAlbaranes : [])
    .map((number) => String(number || '').trim())
    .filter(Boolean);
  const files = Array.isArray(availableFiles) ? availableFiles : [];
  return expected.filter((number) => !files.some((file) => isTotalAlbaranFileForNumber(file, number)));
}

function areAllExpectedAlbaranesReady(compareResult = {}) {
  const expected = Array.isArray(compareResult?.expectedAlbaranes) ? compareResult.expectedAlbaranes : [];
  if (!expected.length) return false;
  const missing = Array.isArray(compareResult?.missingAlbaranes)
    ? compareResult.missingAlbaranes
    : null;
  if (missing) return missing.length === 0;

  const matched = Array.isArray(compareResult?.matchedAlbaranes) ? compareResult.matchedAlbaranes : [];
  const matchedSet = new Set(matched.map(normalizeAlbaranNumberForMatch).filter(Boolean));
  return expected
    .map(normalizeAlbaranNumberForMatch)
    .filter(Boolean)
    .every((number) => matchedSet.has(number));
}

module.exports = {
  isTotalAlbaranFileForNumber,
  getMissingExpectedAlbaranes,
  areAllExpectedAlbaranesReady
};
