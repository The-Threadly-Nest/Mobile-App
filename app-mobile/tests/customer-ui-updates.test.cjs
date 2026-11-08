const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
function compile(file, imports = {}) {
  const filename = path.resolve(__dirname, '../src/shared', file);
  const mod = new Module(filename, module);
  mod.require = id => { if (!(id in imports)) throw new Error('Unexpected import ' + id); return imports[id]; };
  mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, filename);
  return mod.exports;
}
test('booking separates dates and shows only times belonging to the selected date', () => {
  const { groupBookingSlots, bookingTimeLabel } = compile('utils/bookingDates.ts');
  const groups = groupBookingSlots([
    { id: 'a', date: '2030-01-01', time: '09:00', label: 'Jan 1 09:00' },
    { id: 'b', date: '2030-01-01', time: '10:00', label: 'Jan 1 10:00' },
    { id: 'c', date: '2030-01-02', time: '11:00', label: 'Jan 2 11:00' },
  ]);
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].slots.map(slot => slot.id), ['a', 'b']);
  assert.equal(bookingTimeLabel(groups[1].slots[0]), '11:00');
  const legacy = groupBookingSlots([{ id: 'x', label: 'Wed, 11 Nov 2026, 11:00' }, { id: 'y', label: 'Wed, 11 Nov 2026, 12:00' }]);
  assert.equal(legacy.length, 1);
  assert.equal(legacy[0].label, 'Wed, 11 Nov 2026');
  const picker = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/BookingSlotPicker.tsx'), 'utf8');
  assert.match(picker, /useState<string \| null>\(null\)/);
  assert.match(picker, /selected \? <>/);
  assert.match(picker, /selected\.slots\.map/);
});
test('measurement popup groups by fashion house and uses only the latest field readings', () => {
  const { measurementGroups, measurementLabel } = compile('utils/customerMeasurements.ts');
  const rows = [
    { id: 'old', customerId: 'a', field: 'bust', value: 30, unit: 'in', recordedAt: '2026-01-01' },
    { id: 'new', customerId: 'a', field: 'bust', value: 90, unit: 'cm', recordedAt: '2026-02-01' },
    { id: 'other', customerId: 'b', field: 'bust', value: 35, unit: 'in', recordedAt: '2026-02-01' },
    { id: 'invalid', customerId: 'a', field: 'waist', value: NaN, unit: 'in' },
  ];
  const groups = measurementGroups(rows);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(group => group.id === 'a').rows[0].id, 'new');
  assert.equal(groups.find(group => group.id === 'a').rows[0].unit, 'cm');
  assert.equal(groups.find(group => group.id === 'a').rows.length, 1);
  assert.equal(measurementLabel('sleeveLength'), 'Sleeve Length');
  assert.equal(measurementLabel('HIP'), 'HIP');
});
test('measurement popup uses a compact responsive two-column layout', () => {
  const popup = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/CustomerMeasurementsModal.tsx'), 'utf8');
  assert.match(popup, /maxWidth: 440/);
  assert.match(popup, /height - insets\.top - insets\.bottom - 40/);
  assert.match(popup, /flexDirection: "row", flexWrap: "wrap", gap: 10/);
  assert.match(popup, /flexBasis: "45%"/);
  assert.match(popup, /backgroundColor: "#F96951"/);
  assert.match(popup, /accessibilityLabel="Close measurements"/);
});
test('Google account selection signs out the SDK before interactive sign-in without revoking access', async () => {
  const calls = [];
  const google = { configure: () => {}, hasPlayServices: async () => { calls.push('available'); }, signOut: async () => { calls.push('picker-reset'); }, signIn: async () => { calls.push('choose-account'); return { type: 'cancelled' }; } };
  const hook = compile('hooks/useGoogleAuth.ts', {
    react: { useState: value => [value, () => {}], useRef: value => ({ current: value }) },
    'react-native': { NativeModules: { RNGoogleSignin: {} } },
    '@/shared/utils/apiClient': { apiFetch: () => assert.fail('Cancelled picker must not sign into Owuja') },
    '@/stores/useAuthStore': { useAuthStore: selector => selector({ setSession: () => assert.fail('Must preserve current session') }) },
    'expo-router': { router: {} },
    '@/shared/utils/pushNotifications': { registerPushToken: async () => {} },
    '@react-native-google-signin/google-signin': { GoogleSignin: google, isSuccessResponse: response => response.type === 'success', isCancelledResponse: response => response.type === 'cancelled' },
  });
  await hook.useGoogleAuth().promptAsync();
  assert.deepEqual(calls, ['available', 'picker-reset', 'choose-account']);
});
test('primary shared buttons use tomato and black text without changing chat bubbles', () => {
  const button = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/Button.tsx'), 'utf8');
  assert.match(button, /primary: \{ container: "bg-tomato", text: "text-black"/);
  const chat = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/chat/[fashionHouseId].tsx'), 'utf8');
  assert.match(chat, /color: isUser \? "#453332" : "#FFFFFF"/);
  assert.match(chat, /<BookingSlotPicker/);
});
