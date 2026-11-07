const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const filename = path.resolve(__dirname, '../src/shared/components/BookingScheduleForm.tsx');
const compiled = new Module(filename, module);
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
const originalRequire = compiled.require.bind(compiled);
compiled.require = id => id === 'react-native' ? { StyleSheet: { create: styles => styles } } : originalRequire(id);
compiled._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }
}).outputText, filename);
const { bookingScheduleError, DEFAULT_BOOKING_SCHEDULE } = compiled.exports;

test('hours-per-fitting accepts exactly one through five whole hours', () => {
  for (const hours of [1, 2, 3, 4, 5]) assert.equal(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, durationMinutes: hours * 60 }), null);
  for (const minutes of [0, 30, 90, 330, 360]) assert.match(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, durationMinutes: minutes }), /1 to 5 hours/);
});
test('a schedule needs selected days, real clock times and enough time for one full fitting', () => {
  assert.ok(bookingScheduleError(null));
  assert.ok(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, days: [] }));
  assert.ok(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, startTime: '24:00' }));
  assert.ok(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, endTime: '08:00' }));
  assert.ok(bookingScheduleError({ ...DEFAULT_BOOKING_SCHEDULE, endTime: '10:00', durationMinutes: 120 }));
});
