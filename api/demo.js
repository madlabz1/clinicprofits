const store = require('../lib/store');
const ghl = require('../lib/ghlService');
const retell = require('../lib/retellService');
const SCENARIOS = {
  inbound_new: { agentType: 'inbound', direction: 'inbound', from_number: '+12125551234', duration_ms: 134000, transcript: [{ role: 'agent', content: "Thanks for calling Peak Performance Chiropractic! This is Ashley - how can I help you today?" }, { role: 'user', content: "Hi, I've been having really bad lower back pain for about three weeks. A friend recommended you guys." }, { role: 'agent', content: "I'm so sorry you're dealing with that! You've definitely called the right place. Can I get your name?" }, { role: 'user', content: "My name is Marcus Williams." }, { role: 'agent', content: "Great to meet you Marcus! Let me check availability... I've got tomorrow at 10 AM or Thursday at 2 PM - which works better?" }, { role: 'user', content: "Tomorrow at 10 works perfectly." }, { role: 'agent', content: "Awesome! What's the best cell number to reach you at?" }, { role: 'user', content: "It's 212-555-0198." }, { role: 'agent', content: "Got it! You're all set for tomorrow at 10 AM Marcus. You'll get a text confirmation shortly. Anything else I can help with?" }, { role: 'user', content: "No that's great, thank you!" }, { role: 'agent', content: "Of course! We'll see you tomorrow. Have a great day - bye!" }], summary: 'Marcus Williams called with 3 weeks of lower back pain. Booked new patient exam for tomorrow 10 AM. Patient was friendly and engaged.', sentiment: 'Positive', intent: 'Book Appointment' },
  inbound_transfer: { agentType: 'inbound', direction: 'inbound', from_number: '+13105559876', duration_ms: 72000, transcript: [{ role: 'agent', content: "Thanks for calling Peak Performance Chiropractic! This is Ashley - how can I help you today?" }, { role: 'user', content: "Hi, I was in a car accident last week and I'm trying to figure out if you take auto insurance." }, { role: 'agent', content: "Absolutely - we treat auto accident injuries all the time and can often bill directly to auto insurance. Let me connect you with our billing team right now - one moment!" }, { role: 'user', content: "Oh great, thank you." }, { role: 'agent', content: "Please hold just a moment!" }], summary: 'Auto accident inquiry. Transferred to billing team to discuss direct auto insurance billing.', sentiment: 'Neutral', intent: 'Insurance Inquiry' },
  outbound_booked: { agentType: 'outbound', direction: 'outbound', to_number: '+17185554321', duration_ms: 98000, transcript: [{ role: 'agent', content: "Hey, is this Jennifer?" }, { role: 'user', content: "Yes, this is Jennifer." }, { role: 'agent', content: "Hey Jennifer! This is Jordan from Peak Performance Chiropractic. You'd reached out about your neck pain - just wanted to follow up and see how you're doing?" }, { role: 'user', content: "Honestly it's still bothering me, I kept putting it off." }, { role: 'agent', content: "I totally get it - life gets busy! We just had some time open up. Would Wednesday morning or Thursday afternoon work better?" }, { role: 'user', content: "Thursday afternoon works pretty well." }, { role: 'agent', content: "Perfect! I've got 2 PM or 4 PM Thursday - which one?" }, { role: 'user', content: "2 PM sounds good." }, { role: 'agent', content: "You're all set Jennifer! Thursday at 2 PM. You'll get a confirmation text shortly. See you Thursday - bye!" }], summary: 'Jennifer had unresolved neck pain. Successfully booked new patient exam Thursday 2 PM via outbound follow-up.', sentiment: 'Positive', intent: 'Book Appointment' },
  outbound_voicemail: { agentType: 'outbound', direction: 'outbound', to_number: '+16465557890', duration_ms: 28000, transcript: [{ role: 'agent', content: "Hey David, this is Jordan from Peak Performance Chiropractic. I was just following up since you'd reached out about your back pain. Give us a call back at 212-555-0100 whenever you get a chance - we'd love to get you taken care of. Talk soon!" }], summary: 'Reached voicemail for David. Left callback message. Follow-up SMS queued.', sentiment: 'Unknown', intent: 'Voicemail Left' },
  reminder_confirmed: { agentType: 'reminder', direction: 'outbound', to_number: '+12015553456', duration_ms: 45000, transcript: [{ role: 'agent', content: "Hi, may I speak with Sarah?" }, { role: 'user', content: "This is Sarah." }, { role: 'agent', content: "Hi Sarah! This is Casey from Peak Performance Chiropractic. Calling to confirm your appointment with Dr. Johnson this Thursday at 10 AM - are you still planning to come in?" }, { role: 'user', content: "Yes absolutely! I've got it on my calendar." }, { role: 'agent', content: "Wonderful! Please arrive 10 minutes early and bring your insurance card. Any questions?" }, { role: 'user', content: "Nope, I'm all set!" }, { role: 'agent', content: "Great - we're looking forward to seeing you Thursday Sarah! Have a wonderful day - bye!" }], summary: 'Sarah confirmed Thursday 10 AM with Dr. Johnson. Reminded about early arrival and insurance card.', sentiment: 'Positive', intent: 'Confirmed Attendance' },
  reminder_reschedule: { agentType: 'reminder', direction: 'outbound', to_number: '+13475558765', duration_ms: 67000, transcript: [{ role: 'agent', content: "Hi, may I speak with Robert?" }, { role: 'user', content: "Yeah speaking." }, { role: 'agent', content: "Hey Robert! Casey from Peak Performance Chiropractic. Calling to confirm your appointment tomorrow at 3 PM - still good to come in?" }, { role: 'user', content: "Oh man, something came up at work. Is there any way to move it?" }, { role: 'agent', content: "Of course! I've got Friday at 11 AM or Monday at 9 AM - which works better?" }, { role: 'user', content: "Friday at 11 would be perfect." }, { role: 'agent', content: "You're all set - moved to Friday at 11 AM! We'll send a new confirmation text. See you Friday Robert!" }], summary: 'Robert rescheduled from tomorrow to Friday 11 AM during reminder call.', sentiment: 'Positive', intent: 'Rescheduled' }
};
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const path = req.url.split('?')[0];
  if (path.endsWith('/simulate')) return simulate(req, res);
  if (path.endsWith('/call')) return triggerCall(req, res);
  if (path.endsWith('/reset')) { store.reset(); return res.json({ success: true }); }
  res.status(404).json({ error: 'Not found' });
};
async function simulate(req, res) {
  const key = req.body?.scenario || 'inbound_new';
  const sc = SCENARIOS[key] || SCENARIOS.inbound_new;
  const callId = 'demo_' + key + '_' + Date.now();
  const phone = sc.from_number || sc.to_number;
  const t = sc.transcript;
  const nl = t.find(l => /my name is|this is|i'm\s+[A-Z]/i.test(l.content));
  const nm = nl?.content.match(/(?:my name is|this is|i'm)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
  const firstName = nm?.[1]?.split(' ')[0] || 'Demo';
  const lastName = nm?.[1]?.split(' ')[1] || 'Patient';
  store.addCall({ callId, agentId: 'demo_agent_' + sc.agentType, agentType: sc.agentType, direction: sc.direction, status: 'ended', phone, startTime: new Date(Date.now() - sc.duration_ms).toISOString(), endTime: new Date().toISOString(), duration: Math.round(sc.duration_ms / 1000), transcript: t, summary: sc.summary, sentiment: sc.sentiment, intent: sc.intent, events: ['call_started', 'call_ended', 'call_analyzed'], simulated: true });
  try {
    const tags = ['simulated-demo', 'agent-' + sc.agentType, sc.intent === 'Book Appointment' ? 'appointment-booked' : 'demo-call'];
    const contact = await ghl.createContact({ firstName, lastName, phone, tags, source: 'Retell AI Demo - ' + sc.agentType });
    store.addContact({ id: contact.id, name: firstName + ' ' + lastName, phone, tags: contact.tags || [], agentType: sc.agentType, createdAt: new Date().toISOString(), callId });
    if (sc.intent === 'Book Appointment') {
      const startTime = nextSlot();
      const appt = await ghl.bookAppointment({ contactId: contact.id, startTime, endTime: new Date(new Date(startTime).getTime() + 60 * 60000).toISOString(), title: firstName + ' ' + lastName + ' - ' + (sc.agentType === 'outbound' ? 'Outbound Lead' : 'New Patient'), notes: 'Booked via ' + sc.agentType + ' AI agent demo' }).catch(e => { console.error(e.message); return null; });
      if (appt) {
        store.addAppointment({ id: appt.id, contactName: firstName + ' ' + lastName, phone, complaint: 'Demo', startTime, agentType: sc.agentType, createdAt: new Date().toISOString(), callId });
        await ghl.sendSMS(contact.id, 'Hi ' + firstName + '! Your appointment is confirmed. See you then! Reply STOP to opt out.').catch(console.error);
      }
    }
    if (sc.agentType === 'reminder') {
      const outcome = sc.intent === 'Confirmed Attendance' ? 'confirmed' : sc.intent === 'Rescheduled' ? 'rescheduled' : 'no-answer';
      store.addReminder({ phone, firstName, outcome, smsSent: true, callId, createdAt: new Date().toISOString() });
      await ghl.addTag(contact.id, ['reminder-' + outcome]).catch(console.error);
    }
    res.json({ success: true, contactId: contact.id, callId, scenario: key });
  } catch (err) {
    res.json({ success: true, simulated: true, ghlError: err.message });
  }
}
async function triggerCall(req, res) {
  const { phone, agentType = 'outbound', metadata = {} } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Phone required' });
  try {
    const call = await retell.createOutboundCall({ toNumber: phone, agentType, metadata });
    res.json({ success: true, callId: call.call_id });
  } catch (err) { res.status(500).json({ error: err.message }); }
}
function nextSlot() { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0); return d.toISOString(); }