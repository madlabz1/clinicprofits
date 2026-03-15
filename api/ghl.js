const ghl = require('../lib/ghlService');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const path = req.url.split('?')[0];
  if (path.endsWith('/slots') && req.method === 'GET') {
    try {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const slots = await ghl.getSlots(start, end);
      return res.json({ slots: slots.slice(0, 5) });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  if (path.endsWith('/book') && req.method === 'POST') {
    const { first_name, last_name, phone, appointment_type, slot_time, complaint } = req.body;
    try {
      const contact = await ghl.createContact({
        firstName: first_name, lastName: last_name || '', phone,
        tags: ['retell-booked', appointment_type], source: 'Retell AI Agent'
      });
      const endTime = new Date(new Date(slot_time).getTime() + 60 * 60000).toISOString();
      const appt = await ghl.bookAppointment({
        contactId: contact.id, startTime: slot_time, endTime,
        title: first_name + ' ' + (last_name || '') + ' - ' + (complaint || appointment_type),
        notes: 'Booked via Retell AI Voice Agent'
      });
      await ghl.sendSMS(contact.id, 'Hi ' + first_name + '! Your appointment is confirmed. See you soon!');
      return res.json({ success: true, contactId: contact.id, appointmentId: appt.id });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  if (path.endsWith('/lead') && req.method === 'POST') {
    const { first_name, last_name, phone, reason, tag } = req.body;
    try {
      const contact = await ghl.createContact({
        firstName: first_name, lastName: last_name || '', phone,
        tags: ['lead-captured', tag || 'callback-requested'], source: 'Retell AI Lead Capture'
      });
      if (reason) await ghl.addNote(contact.id, 'Lead Capture - Reason: ' + reason);
      return res.json({ success: true, contactId: contact.id });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  if (path.endsWith('/confirm') && req.method === 'POST') {
    const { contact_id, status, new_slot } = req.body;
    try {
      if (contact_id) {
        await ghl.addTag(contact_id, ['reminder-' + status]);
        await ghl.addNote(contact_id, 'Reminder Call: ' + status.toUpperCase() + (new_slot ? ' | New slot: ' + new_slot : ''));
      }
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  if (path.endsWith('/optout') && req.method === 'POST') {
    const { contact_id } = req.body;
    try {
      if (contact_id) await ghl.addTag(contact_id, ['dnc', 'opted-out']);
      return res.json({ success: true });
    } catch (e) { return res.status(500).json({ error: e.message }); }
  }
  res.status(404).json({ error: 'Not found' });
};