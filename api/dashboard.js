const store = require('../lib/store');
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).end();
  res.json({
    calls: store.getCallsByAgent(),
    inbound: store.getCallsByAgent('inbound'),
    outbound: store.getCallsByAgent('outbound'),
    reminder: store.getCallsByAgent('reminder'),
    contacts: store.getContacts(),
    appointments: store.getAppointments(),
    reminders: store.getReminders(),
    stats: store.getStats()
  });
};