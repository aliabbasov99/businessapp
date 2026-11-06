const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

const source = readFileSync(path.join(__dirname, '../src/utils/carousel.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
});
const api = {};
vm.runInNewContext(compiled.outputText, { exports: api });
const { carouselOffset, dragCarouselPosition, previewCarouselPosition, wrapCarouselIndex } = api;

function previewTrace(start, translations, step = 180) {
  let selected = Math.round(start);
  return translations.map(translation => {
    const position = dragCarouselPosition(start, translation, step);
    selected = previewCarouselPosition(position, selected);
    return { position, selected };
  });
}

test('a small drag keeps the current list selected in either direction', () => {
  for (const direction of [-1, 1]) {
    const trace = previewTrace(1, [10, 24, 60, 89].map(distance => direction * distance));
    assert.deepEqual(trace.map(frame => frame.selected), [1, 1, 1, 1]);
  }
});

test('crossing halfway changes the list during the drag', () => {
  assert.deepEqual(previewTrace(1, [-30, -89, -91, -140]).map(frame => frame.selected), [1, 1, 2, 2]);
  assert.deepEqual(previewTrace(1, [30, 89, 91, 140]).map(frame => frame.selected), [1, 1, 0, 0]);
});

test('a full-width drag stretches past the card while keeping that list selected', () => {
  for (const step of [144, 180, 252]) {
    for (const direction of [-1, 1]) {
      const frame = previewTrace(1, [direction * 420], step)[0];
      assert.equal(wrapCarouselIndex(frame.selected, 4), 1 - direction);
      const stretch = (frame.selected - frame.position) * direction;
      assert.ok(stretch > 0 && stretch < 0.25);
    }
  }
});

test('dragging back before release restores the original list and target together', () => {
  const trace = previewTrace(1, [-40, -120, -180, -250, -300, -250, -180, -100, -60, -20]);
  assert.deepEqual(trace.map(frame => frame.selected), [1, 2, 2, 2, 2, 2, 2, 2, 1, 1]);
  assert.ok(trace[4].position > trace[3].position);
  assert.ok(trace[5].position < trace[4].position);
  assert.equal(trace[6].position, 2);
});

test('resistance starts continuously and never locks further finger movement', () => {
  for (const direction of [-1, 1]) {
    const distances = [179.99, 180, 180.01, 200, 250, 320, 420];
    const positions = distances.map(distance => dragCarouselPosition(0, -direction * distance, 180) * direction);
    for (let i = 1; i < positions.length; i++) assert.ok(positions[i] > positions[i - 1]);
    assert.ok(Math.abs((positions[2] - positions[1]) - (positions[1] - positions[0])) < 0.000001);
    assert.ok(positions.at(-1) < 1.25);
  }
});

test('holding at the exact midpoint retains the currently displayed list on either side', () => {
  assert.equal(previewCarouselPosition(0.5, 0), 0);
  assert.equal(previewCarouselPosition(0.5, 1), 1);
  assert.equal(previewCarouselPosition(-0.5, 0), 0);
  assert.equal(previewCarouselPosition(-0.5, -1), -1);
});

test('interrupting a transition continues previewing the visible nearest card', () => {
  const trace = previewTrace(1.35, [-18, -54]);
  assert.deepEqual(trace.map(frame => frame.selected), [1, 2]);
});

test('preview selection wraps with the carousel in both directions', () => {
  const next = previewTrace(3, [-100]).at(-1);
  const previous = previewTrace(0, [100]).at(-1);
  assert.equal(wrapCarouselIndex(next.selected, 4), 0);
  assert.equal(wrapCarouselIndex(previous.selected, 4), 3);
  assert.equal(carouselOffset(0, 3, 4), 1);
  assert.equal(carouselOffset(3, 0, 4), -1);
});
