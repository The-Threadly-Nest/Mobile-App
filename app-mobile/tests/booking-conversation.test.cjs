const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('booking asks for garment once and does not force occasion or fabric selection', () => {
  const chat = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/chat/[fashionHouseId].tsx'), 'utf8');
  assert.match(chat, /What garment would you like us to make/);
  assert.doesNotMatch(chat, /options: \["Wedding"|options: \["Fashion House Fabric"|responseTurn\.options = styleOptions/);
  assert.match(chat, /garmentName: activeGarment === "Bespoke Fitting Session" \? undefined : activeGarment/);
  assert.match(chat, /slots: responseSlots\.length \? responseSlots : undefined/);
  assert.match(chat, /Choose an available date, then a time below/);
  assert.match(chat, /We couldn't reach the booking assistant/);
});

test('AI prompt follows garment, date/time, saved confirmation without mandatory fabric questions', () => {
  const prompt = fs.readFileSync(path.resolve(__dirname, '../../server/src/lib/gemini.ts'), 'utf8');
  assert.doesNotMatch(prompt, /STEP 1 \(Occasion\)|STEP 3 \(Fabric Choice\)/);
  assert.match(prompt, /Occasion and fabric discussion are optional, never prerequisites to booking/);
  assert.match(prompt, /Confirm only after a real slot has been saved/);
});

test('chat shows three dates, then asks for a time in a separate conversation turn', () => {
  const picker = fs.readFileSync(path.resolve(__dirname, '../src/shared/components/BookingSlotPicker.tsx'), 'utf8');
  assert.match(picker, /days\.slice\(datePage \* 3, datePage \* 3 \+ 3\)/);
  assert.match(picker, /More dates/);
  assert.match(picker, /mode !== "dates" && \(selected/);
  const chat = fs.readFileSync(path.resolve(__dirname, '../app/(customer)/chat/[fashionHouseId].tsx'), 'utf8');
  assert.match(chat, /mode=\{turn\.slotStage \|\| "dates"\}/);
  assert.match(chat, /role: "user", text: day\.label/);
  assert.match(chat, /What time works for you on/);
  assert.match(chat, /slots: day\.slots, slotStage: "times"/);
  assert.match(chat, /slotPickerComplete: true/);
});
