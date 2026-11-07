// Explicitly opt-in: calls the deployed AI and may create a real pending booking.
// Always attempts to cancel only the booking created by this test account.
const { randomUUID, randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
if (!process.argv.includes('--confirm-live-booking')) throw new Error('Pass --confirm-live-booking to authorize the live test.');
const base = 'https://owuja-server-production.up.railway.app';
let token, bookingId, houseId;
let cleanupFailed = false;
async function request(route, body, key) {
  const response = await fetch(base + route, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`${route}: HTTP ${response.status}, ${typeof data.error === 'string' ? data.error : data.error?.message || 'Request failed'}`);
  return data;
}
async function main() {
  const email = `booking-check-${randomUUID()}@example.invalid`;
  const account = await request('/api/auth/signup', { name: 'Owuja Live Booking Test', email, password: randomBytes(24).toString('base64url') + 'Aa1', role: 'customer' });
  token = account.token;
  assert.ok(token, 'Signup must return a session');
  console.log('PASS customer signup; test account:', account.user.id);
  const houses = await request('/api/fashion-houses?limit=20');
  assert.ok(Array.isArray(houses), 'Expected real fashion-house list');
  console.log('PASS authenticated fashion-house listing:', houses.length);
  let slot;
  for (const house of houses) {
    const session = await request('/api/chat/session/' + house.id);
    if (session.availableSlots?.length) {
      houseId = house.id; slot = session.availableSlots[session.availableSlots.length - 1]; break;
    }
  }
  assert.ok(slot, 'No published future appointments are available; no booking attempted');
  console.log('PASS available appointment loaded for house:', houseId);
  const introduction = await request('/api/chat/message', { fashionHouseId: houseId, message: 'I would like a wedding suit fitting. I will bring my own fabric.' }, 'live-intro:' + randomUUID());
  console.log('AI response:', introduction.reply);
  assert.equal(introduction.type, 'message', 'Expected normal AI conversation');
  assert.ok(introduction.reply && !/temporarily unavailable|couldn.t prepare a reply/i.test(introduction.reply), 'Live AI provider did not return a usable reply');
  const key = 'live-booking:' + randomUUID();
  const payload = { fashionHouseId: houseId, message: `I confirm the fitting for my wedding suit with my own fabric at ${slot.label}. This is an Owuja live booking test appointment.`, availableSlotId: slot.id, idempotencyKey: key };
  const confirmation = await request('/api/chat/message', payload, key);
  if (confirmation.booking?.id) bookingId = confirmation.booking.id;
  console.log('AI booking response:', confirmation.reply);
  assert.equal(confirmation.type, 'booking_created', 'AI did not complete the selected-slot booking');
  assert.ok(bookingId, 'Server must return the saved booking');
  assert.equal(confirmation.booking.availableSlotId, slot.id);
  assert.equal(confirmation.booking.status, 'pending_admin_review');
  console.log('PASS live booking saved:', bookingId);
  const orders = await request('/api/orders/my-orders?limit=100');
  assert.ok(orders.some(order => order.id === bookingId || order.bookingId === bookingId), 'Saved booking must appear in customer orders');
  console.log('PASS booking appears in customer orders');
  const retry = await request('/api/chat/message', payload, key);
  assert.equal(retry.booking?.id, bookingId, 'Retry must return the same saved booking');
  console.log('PASS retry returns the same booking');
}
(async () => {
  try { await main(); }
  catch (error) { console.error('FAIL:', error.message); process.exitCode = 1; }
  finally {
    // Recover a committed booking if the confirmation response was lost.
    if (token && !bookingId) {
      try {
        const orders = await request('/api/orders/my-orders?limit=100');
        const own = orders.filter(order => !houseId || order.fashionHouseId === houseId);
        if (own.length === 1) bookingId = own[0].bookingId || own[0].id;
      } catch { /* No destructive fallback or broad database cleanup. */ }
    }
    if (token && bookingId) {
      try {
        await request('/api/orders/track/' + bookingId + '/cancel', {});
        console.log('CLEANUP: test booking cancelled:', bookingId);
      } catch (error) { cleanupFailed = true; console.error('CLEANUP REQUIRED for booking ' + bookingId + ': ' + error.message); process.exitCode = 1; }
    }
    console.log('No existing accounts were modified. Test account/chat history remain for audit.' + (cleanupFailed ? ' Appointment requires manual cancellation.' : ''));
  }
})();
