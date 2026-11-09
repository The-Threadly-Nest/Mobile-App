const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function load(file) {
  const filename = path.join(root, file);
  const mod = new Module(filename, module);
  mod.require = id => id === '../domain/statuses' ? load('src/shared/domain/statuses.ts') : id === './orderFulfillment' ? load('src/shared/utils/orderFulfillment.ts') : require(id);
  mod._compile(ts.transpileModule(read(file), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, filename);
  return mod.exports;
}

test('ready orders are detected from real checkout snapshots, not garment labels', () => {
  const { isReadyToWear, READY_ORDER_STAGES } = load('src/shared/utils/orderFulfillment.ts');
  assert.equal(isReadyToWear({ fulfillmentType: 'ready_to_wear' }), true);
  assert.equal(isReadyToWear({ items: [{ selectedSize: 'M' }, { selectedSize: 'L' }] }), true);
  assert.equal(isReadyToWear({ order: { items: [{ selectedSize: 'M' }] } }), true);
  assert.equal(isReadyToWear({ catalogSnapshot: { fulfillmentType: 'ready_to_fit' } }), true);
  for (const item of [null, {}, { items: [] }, { itemName: 'Ready-to-Wear Alteration' }, { fulfillmentType: 'custom_fit', selectedSize: 'M' }, { items: [{ selectedSize: 'M' }, { fulfillmentType: 'custom_fit' }] }]) {
    assert.equal(isReadyToWear(item), false);
  }
  assert.deepEqual(READY_ORDER_STAGES.map(stage => stage.label), ['Placed', 'Production / Sourcing', 'Ready for Pickup', 'Completed']);
});

test('most recently updated house is first and same-name houses stay isolated', () => {
  const { measurementGroups } = load('src/shared/utils/customerMeasurements.ts');
  const row = (id, house, value, recordedAt, updatedAt) => ({ id, field: 'waist', value, unit: 'cm', recordedAt, updatedAt, customer: { fashionHouse: { id: house, shopName: 'Atelier' } } });
  const groups = measurementGroups([
    row('old', 'a', 70, '2026-01-01'),
    row('b', 'b', 80, '2026-03-01'),
    row('updated', 'a', 75, '2026-02-01', '2026-04-01'),
  ]);
  assert.deepEqual(groups.map(group => group.id), ['a', 'b']);
  assert.deepEqual(groups.map(group => group.rows.map(row => row.value)), [[75], [80]]);
  const popup = read('src/shared/components/CustomerMeasurementsModal.tsx');
  assert.match(popup, /groups\.length > 1/);
  assert.match(popup, /setSelectedHouseId\(house\.id\)/);
  assert.match(popup, /groups\.find\(group => group\.id === selectedHouseId\) \|\| groups\[0\]/);
});

test('catalog chat entry has slot picker and booking confirmation remains in chat', () => {
  const catalog = read('app/(customer)/catalog/[id].tsx');
  assert.match(catalog, /pathname: "\/\(customer\)\/chat\/\[fashionHouseId\]"/);
  for (const param of ['fashionHouseId', 'fashionHouseName', 'garmentName', 'garmentPrice', 'startNew']) assert.ok(catalog.includes(param));
  const chat = read('app/(customer)/chat/[fashionHouseId].tsx');
  assert.match(chat, /garmentName && startNew && !humanHandoffActive/);
  assert.match(chat, /<BookingSlotPicker/);
  assert.match(chat, /slots: serverSlots/);
  assert.doesNotMatch(chat, /pathname: "\/\(customer\)\/confirmation"/);
  assert.match(chat, /sendLockRef\.current/);
});

test('ready assignment bypasses custom measurements and uses existing order endpoint', () => {
  assert.match(read('app/(admin)/escalations/index.tsx'), /token && !booking\.readyToWear/);
  const assign = read('app/(admin)/escalations/assign.tsx');
  assert.match(assign, /\/api\/orders\/\$\{encodeURIComponent\(params\.orderId\)\}\/assign/);
  assert.match(assign, /method: "PATCH", body: JSON\.stringify\(\{ staffId: tailor\.id \}\)/);
  assert.doesNotMatch(assign, /measurements:\s*\{/);
  const detail = read('app/(admin)/order-detail.tsx');
  assert.match(detail, /readyToWear \? READY_ORDER_STAGES : STAGES/);
  assert.match(detail, /!readyToWear && measurementsList/);
});

test('profile uses native icons; admin circles retain their distinct requested styles', () => {
  const profile = read('app/(customer)/(tabs)/profile.tsx');
  assert.doesNotMatch(profile, /ProfileDesignIcon name="(?:chevron|logout|personal)"/);
  assert.match(profile, /ChevronRight size=\{18\}/);
  assert.match(profile, /LogOut size=\{20\}/);
  assert.match(profile, /User size=\{20\}/);
  assert.doesNotMatch(read('src/shared/components/ProfileDesign.tsx'), /SvgUri|Asset\.fromModule/);
  const nav = read('app/(admin)/_layout.tsx');
  assert.match(nav, /Circle cx=\{19\} cy=\{19\} r=\{19\} fill="#453332"/);
  assert.match(nav, /width: 38, height: 38, minWidth: 38, minHeight: 38, flexShrink: 0, borderRadius: 19/);
  assert.match(nav, /width: 42, height: 42, flexShrink: 0, borderRadius: 21, backgroundColor: "#FFFFFF"/);
  assert.match(nav, /<Plus size=\{22\} color="#F96951"/);
  assert.match(nav, /ADMIN_ALLOWED_TAB_ROUTES = \["dashboard", "escalations\/index", "orders", "settings"\]/);
  const newItem = read('app/(admin)/catalog/new.tsx');
  const footer = newItem.slice(newItem.indexOf('  bottomBar: {'), newItem.indexOf('  submitBtn: {'));
  assert.doesNotMatch(footer, /borderTop/);
});

test('unassigned purchases appear in requests, never running orders, without name-based merging', () => {
  const { adminOrderRequests, isRunningOrder, isUnassignedOrder } = load('src/shared/utils/adminOrderQueues.ts');
  const order = (id, staffId, status = 'order_placed', bookingId = null) => ({ id, staffId, status, bookingId, itemName: id, customer: { name: 'Same Customer' }, createdAt: '2026-11-09' });
  const orders = [order('a', null), order('b', null), order('assigned', 'staff'), order('closed', null, 'completed'), order('cancelled', null, 'cancelled'), order('linked', null, 'booked', 'booking-a')];
  const bookings = [{ id: 'booking-a', bookingStatus: 'pending' }, { id: 'booking-b', bookingStatus: 'pending' }, { id: 'declined', status: 'declined' }, { id: 'manual', reason: 'Customer initiated manual escalation', status: 'pending', resolved: false }];
  assert.deepEqual(adminOrderRequests(orders, bookings).map(item => item.id).sort(), ['a', 'b', 'booking-b', 'linked']);
  assert.deepEqual(orders.filter(isRunningOrder).map(item => item.id), ['assigned']);
  assert.equal(isUnassignedOrder({ staff: { id: 'staff' }, status: 'booked' }), false);
  assert.equal(isRunningOrder(order('ready', 'staff', 'ready')), false);
  const dashboard = read('app/(admin)/dashboard.tsx');
  assert.match(dashboard, /const displayRequests = pendingEscalations\.slice\(0, 2\);/);
  assert.match(dashboard, /Order requests/);
  const nav = read('src/shared/components/FloatingTabBar.tsx');
  assert.match(nav, /android_ripple=\{\{ color: "transparent", borderless: false \}\}/);
  assert.match(nav, /borderRadius: 27, overflow: "hidden"/);
});

test('ready-to-wear acceptance does not require staff and leaves the request queue', () => {
  const { adminOrderRequests, isRunningOrder } = load('src/shared/utils/adminOrderQueues.ts');
  const ready = { id: 'ready', fulfillmentType: 'ready_to_wear', staffId: null, status: 'order_placed' };
  assert.equal(adminOrderRequests([ready], []).length, 1);
  const accepted = { ...ready, status: 'in_production' };
  assert.equal(adminOrderRequests([accepted], []).length, 0);
  assert.equal(isRunningOrder(accepted), true);
  assert.equal(isRunningOrder({ ...accepted, status: 'ready_for_pickup' }), false);
  assert.equal(adminOrderRequests([{ ...accepted, status: 'completed' }], []).length, 0);
  const alert = read('src/shared/components/AppAlert.tsx');
  assert.match(alert, /confirmLabel \|\| "OK"\)\.length > 12/);
  assert.match(alert, /btnStack: \{ flex: 0, width: "100%", minHeight: 48 \}/);
  assert.doesNotMatch(alert, /height: 48,/);
});
