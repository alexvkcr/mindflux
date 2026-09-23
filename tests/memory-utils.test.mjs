import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareAnswer,
  formatExposure,
  generateSequence,
  groupSequence,
  normalizeExposure,
  normalizeLength,
  sanitizeAnswer,
  stepExposure,
} from "../src/games/memory/utils.ts";

test("exposure steps cross 1.5 / 2 seconds in both directions and continue beyond 5", () => {
  const expected = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 2000, 3000, 4000, 5000, 6000];
  for (let index = 0; index < expected.length - 1; index += 1) {
    assert.equal(stepExposure(expected[index], 1), expected[index + 1]);
    assert.equal(stepExposure(expected[index + 1], -1), expected[index]);
  }
  assert.equal(stepExposure(100, -1), 100);
  assert.equal(stepExposure(60_000, 1), 61_000);
  assert.equal(normalizeExposure(1600), 2000);
  assert.equal(normalizeExposure(0), 100);
  assert.equal(normalizeExposure(NaN), 1000);
  assert.equal(formatExposure(10_000_000), "10000");
});

test("length is a count of individual digits between 1 and 30", () => {
  assert.equal(normalizeLength(0), 1);
  assert.equal(normalizeLength(31), 30);
  for (const mode of ["decimal", "binary"]) {
    for (const length of [1, 5, 8, 30]) {
      const sequence = generateSequence(mode, length);
      assert.equal(sequence.length, length);
      assert.match(sequence, mode === "binary" ? /^[01]+$/ : /^[0-9]+$/);
    }
  }
});

test("generation supports leading zeros, repeated digits and both alphabet endpoints", (context) => {
  const random = context.mock.method(Math, "random", () => 0);
  assert.equal(generateSequence("decimal", 6), "000000");
  assert.equal(generateSequence("binary", 8), "00000000");
  random.mock.mockImplementation(() => 0.99999);
  assert.equal(generateSequence("decimal", 3), "999");
  assert.equal(generateSequence("binary", 3), "111");
});

test("decimal pairs and binary blocks preserve order without padding incomplete groups", () => {
  assert.deepEqual(groupSequence("704928", "decimal"), ["70", "49", "28"]);
  assert.deepEqual(groupSequence("012", "decimal"), ["01", "2"]);
  assert.deepEqual(groupSequence("010101110001", "binary"), ["010101", "110001"]);
  assert.deepEqual(groupSequence("01010111", "binary"), ["010101", "11"]);
  assert.deepEqual(groupSequence("0", "binary"), ["0"]);
});

test("keyboard input preserves leading zeros and enforces mode and digit count", () => {
  assert.equal(sanitizeAnswer("00 12 34", "decimal", 6), "001234");
  assert.equal(sanitizeAnswer("0012345", "decimal", 4), "0012");
  assert.equal(sanitizeAnswer("010\n101", "binary", 6), "010101");
  assert.equal(sanitizeAnswer("a2-0.1e9", "binary", 30), "01");
});

test("reveal compares positions and returns a correction for wrong or missing digits", () => {
  assert.deepEqual(compareAnswer("7049", "705"), [
    { expected: "7", actual: "7", correct: true },
    { expected: "0", actual: "0", correct: true },
    { expected: "4", actual: "5", correct: false },
    { expected: "9", actual: "", correct: false },
  ]);
  assert.ok(compareAnswer("001", "001").every((digit) => digit.correct));
  assert.ok(compareAnswer("001", "").every((digit) => !digit.correct));
});
