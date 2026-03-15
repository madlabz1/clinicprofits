const store = require('../../lib/store');
const ghl = require('../../lib/ghlService');
function getAgentMap() {
  return {
    [process.env.RETELL_AGENT_INBOUND_ID]: 'inbound',
    [process.env.RETELL_AGENT_OUTBOUND_ID]: 'outbound',
    [process.env.RETELL_AGENT_REMINDER_ID]: 'reminder'
  };
}
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method !== 'POST') return res.status(405).end();
  const { event: evt, call } = req.body || {};
  if (!evt || !call) return res.status(400).json({ error: 'Invalid payload' });
  const agentType = getAgentMap()[call.agent_id] || 'inbound';
  try {
    if (evt === 'call_started') {
      store.addCall({
        callId: call.call_id, agentId: call.agent_id, agentType,
        status: 'active', phone: call.from_number || call.to_number || 'Unknown',
        direction: agentType === 'inbound' ? 'inbound' : 'outbound',
        startTime: new Date().toISOString(), transcript: [], events: ['call_started']
      });
    }
    if (evt === 'call_ended') {
      const t = call.transcript || [];
      store.updateCall(call.call_id, {
        status: 'ended', endTime: new Date().toISOString(),
        duration: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,
        transcript: t, summary: call.call_analysis?.call_summary || '',
        sentiment: call.call_analysis?.user_sentiment || 'Unknown',
        events: ['call_started', 'call_ended']
      });
      if (agentType === 'inbound') await processInbound(call);
      if (agentType === 'outbound') await processOutbound(call);
      if (agentType === 'reminder') await processReminder(call);
    }
    if (evt === 'call_analyzed') {
      store.updateCall(call.call_id, {
        summary: call.call_analysis?.call_summary,
        sentiment: call.call_analysis?.user_sentiment
      });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};
async function processInbound(call) {
  const t = call.transcript || [];
  const phone = call.from_number;
  const firstName = extract(t, 'firstName') || 'New';
  const lastName = extract(t, 'lastName') || 'Patient';
  const complaint = extract(t, 'complaint') || 'General Consultation';
  const wantsAppt = mentions(t, ['appointment', 'book', 'schedule', 'yes', 'tomorrow', 'works', 'perfect']);
  try {
    let contact = await ghl.searchContact(phone).catch(() => null);
    if (!contact) contact = await ghl.createContact({
      firstName, lastName, phone,
      tags: ['inbound-call', 'retell-ai', wantsAppt ? 'appointment-booked' : 'inquiry'],
      source: 'Retell Inbound Call'
    });
    store.addContact({ id: contact.id, name: firstName + ' ' + lastName, phone, tags: contact.tags || [], agentType: 'inbound', createdAt: new Date().toISOString(), callId: call.call_id });
    await ghl.addNote(contact.id, 'INBOUND CALL\nComplaint: ' + complaint + '\nBooked: ' + (wantsAppt ? 'YES' : 'NO') + '\nSummary: ' + (call.call_analysis?.call_summary || 'N/A')).catch(console.error);
    if (wantsAppt) {
      const startTime = nextSlot();
      const endTime = new Date(new Date(startTime).getTime() + 60 * 60000).toISOString();
      const appt = await ghl.bookAppointment({ contactId: contact.id, startTime, endTime, title: 'New Patient: ' + firstName + ' ' + lastName + ' - ' + complaint, notes: 'Booked via Retell Inbound Agent' }).catch(e => { console.error(e.message); return null; });
      if (appt) {
        store.addAppointment({ id: appt.id, contactName: firstName + ' ' + lastName, phone, complaint, startTime, agentType: 'inbound', createdAt: new Date().toISOString(), callId: call.call_id });
        await ghl.sendSMS(contact.id, 'Hi ' + firstName + '! Your appointment is confirmed. Please arrive 10 mins early and bring your insurance card. See you then!').catch(console.error);
      }
    }
  } catch (e) { console.error('processInbound:', e.message); }
}
async function processOutbound(call) {
  const t = call.transcript || [];
  const phone = call.to_number;
  const booked = mentions(t, ['appointment', 'book', 'yes', 'perfect', 'works', 'sounds good']);
  const optOut = mentions(t, ['remove', 'opt out', 'stop calling', 'do not call']);
  const voicemail = mentions(t, ['voicemail', 'leave a message']);
  const firstName = extract(t, 'firstName') || call.metadata?.first_name || 'Patient';
  store.addOutbound({ phone, firstName, outcome: optOut ? 'opted-out' : voicemail ? 'voicemail' : booked ? 'booked' : 'no-booking', callId: call.call_id, createdAt: new Date().toISOString() });
  try {
    const contactId = call.metadata?.contact_id;
    if (!contactId) return;
    const tags = optOut ? ['dnc', 'opted-out'] : voicemail ? ['voicemail-left'] : booked ? ['appointment-booked', 'outbound-converted'] : ['outbound-called', 'no-booking'];
    await ghl.addTag(contactId, tags).catch(console.error);
    if (booked) {
      const startTime = nextSlot();
      const appt = await ghl.bookAppointment({ contactId, startTime, endTime: new Date(new Date(startTime).getTime() + 60 * 60000).toISOString(), title: 'New Patient: ' + firstName + ' - Outbound Booked', notes: 'Booked via Retell Outbound Agent' }).catch(e => { console.error(e.message); return null; });
      if (appt) {
        store.addAppointment({ id: appt.id, contactName: firstName, phone, complaint: 'Outbound Lead', startTime, agentType: 'outbound', createdAt: new Date().toISOString(), callId: call.call_id });
        await ghl.sendSMS(contactId, 'Hi ' + firstName + '! Your appointment is confirmed. See you then! Reply STOP to opt out.').catch(console.error);
      }
    }
  } catch (e) { console.error('processOutbound:', e.message); }
}
async function processReminder(call) {
  const t = call.transcript || [];
  const phone = call.to_number;
  const confirmed = mentions(t, ['yes', 'confirmed', "i'll be there", 'absolutely']);
  const cancelled = mentions(t, ['cancel', "can't make it", 'reschedule']);
  const voicemail = mentions(t, ['voicemail', 'leave a message']);
  const firstName = extract(t, 'firstName') || call.metadata?.first_name || 'Patient';
  const outcome = voicemail ? 'voicemail' : confirmed ? 'confirmed' : cancelled ? 'cancelled' : 'no-answer';
  store.addReminder({ phone, firstName, outcome, smsSent: true, callId: call.call_id, createdAt: new Date().toISOString() });
  try {
    const contactId = call.metadata?.contact_id;
    if (contactId) {
      await ghl.addTag(contactId, ['reminder-' + outcome]).catch(console.error);
      if (confirmed) await ghl.sendSMS(contactId, 'Hi ' + firstName + '! Your appointment is confirmed. See you then!').catch(console.error);
      if (cancelled) await ghl.sendSMS(contactId, 'Hi ' + firstName + ' - no worries! Call us anytime to reschedule.').catch(console.error);
    }
  } catch (e) { console.error('processReminder:', e.message); }
}
function extract(t, field) {
  const txt = t.map(l => l.content || '').join(' ');
  if (field === 'firstName') { const m = txt.match(/(?:my name is|i'm|this is)\s+([A-Z][a-z]+)/i); return m?.[1] || null; }
  if (field === 'lastName') { const m = txt.match(/(?:my name is|i'm)\s+[A-Z][a-z]+\s+([A-Z][a-z]+)/i); return m?.[1] || null; }
  if (field === 'complaint') { const tl = txt.toLowerCase(); if (/lower back|back pain/.test(tl)) return 'Back Pain'; if (/neck/.test(tl)) return 'Neck Pain'; if (/shoulder/.test(tl)) return 'Shoulder Pain'; if (/knee/.test(tl)) return 'Knee Pain'; if (/sciatica/.test(tl)) return 'Sciatica'; if (/headache/.test(tl)) return 'Headaches'; if (/sport|injury|accident/.test(tl)) return 'Sports/Accident Injury'; return null; }
}
function mentions(t, kws) { const txt = t.map(l => l.content || '').join(' ').toLowerCase(); return kws.some(k => txt.includes(k)); }
function nextSlot() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString(); }