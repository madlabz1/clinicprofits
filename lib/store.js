if (!globalThis._cpStore) {
  globalThis._cpStore = {
    calls: [], contacts: [], appointments: [], reminders: [], outbound: []
  };
}
const S = globalThis._cpStore;
module.exports = {
  addCall: (c) => { S.calls.unshift(c); if (S.calls.length > 100) S.calls.pop(); },
  updateCall: (id, p) => { const i = S.calls.findIndex(c => c.callId === id); if (i !== -1) Object.assign(S.calls[i], p); },
  getCallsByAgent: (t) => t ? S.calls.filter(c => c.agentType === t) : S.calls,
  getCall: (id) => S.calls.find(c => c.callId === id),
  addContact: (c) => { S.contacts.unshift(c); if (S.contacts.length > 100) S.contacts.pop(); },
  getContacts: () => S.contacts,
  addAppointment: (a) => { S.appointments.unshift(a); if (S.appointments.length > 100) S.appointments.pop(); },
  getAppointments: () => S.appointments,
  addReminder: (r) => { S.reminders.unshift(r); if (S.reminders.length > 100) S.reminders.pop(); },
  getReminders: () => S.reminders,
  addOutbound: (o) => { S.outbound.unshift(o); if (S.outbound.length > 100) S.outbound.pop(); },
  getOutbound: () => S.outbound,
  getStats: () => ({
    totalCalls: S.calls.length,
    inboundCalls: S.calls.filter(c => c.agentType === 'inbound').length,
    outboundCalls: S.calls.filter(c => c.agentType === 'outbound').length,
    reminderCalls: S.calls.filter(c => c.agentType === 'reminder').length,
    activeCalls: S.calls.filter(c => c.status === 'active').length,
    completedCalls: S.calls.filter(c => c.status === 'ended').length,
    contactsCreated: S.contacts.length,
    appointmentsBooked: S.appointments.length,
    appointmentsConfirmed: S.reminders.filter(r => r.outcome === 'confirmed').length,
    appointmentsCancelled: S.reminders.filter(r => r.outcome === 'cancelled').length,
    smsSent: S.appointments.length + S.reminders.filter(r => r.smsSent).length
  }),
  reset: () => { S.calls = []; S.contacts = []; S.appointments = []; S.reminders = []; S.outbound = []; }
};