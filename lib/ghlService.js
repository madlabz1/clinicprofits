const axios = require('axios');
const BASE = 'https://services.leadconnectorhq.com';
const LOC = () => process.env.GHL_LOCATION_ID;
const CAL = () => process.env.GHL_CALENDAR_ID;
const h = () => ({
  'Authorization': 'Bearer ' + process.env.GHL_API_KEY,
  'Version': '2021-07-28',
  'Content-Type': 'application/json'
});
async function createContact({ firstName, lastName, phone, email = '', tags = [], source = 'Retell AI' }) {
  const { data } = await axios.post(BASE + '/contacts/', {
    firstName, lastName, phone, email, locationId: LOC(), tags, source
  }, { headers: h() });
  return data.contact;
}
async function searchContact(phone) {
  const { data } = await axios.get(BASE + '/contacts/search', {
    headers: h(), params: { locationId: LOC(), phone }
  });
  return data.contacts?.[0] || null;
}
async function addNote(contactId, body) {
  const { data } = await axios.post(BASE + '/contacts/' + contactId + '/notes', { body }, { headers: h() });
  return data;
}
async function addTag(contactId, tags) {
  const { data } = await axios.post(BASE + '/contacts/' + contactId + '/tags', { tags }, { headers: h() });
  return data;
}
async function getSlots(startDate, endDate) {
  const { data } = await axios.get(BASE + '/calendars/' + CAL() + '/free-slots', {
    headers: h(), params: { startDate, endDate, timezone: 'America/New_York' }
  });
  return data.slots || [];
}
async function bookAppointment({ contactId, startTime, endTime, title, notes }) {
  const { data } = await axios.post(BASE + '/calendars/events/appointments', {
    calendarId: CAL(), locationId: LOC(), contactId, startTime, endTime,
    title: title || 'New Patient Appointment', appointmentStatus: 'confirmed', notes: notes || ''
  }, { headers: h() });
  return data.appointment;
}
async function sendSMS(contactId, message) {
  const { data } = await axios.post(BASE + '/conversations/messages', {
    type: 'SMS', contactId, message
  }, { headers: h() });
  return data;
}
module.exports = { createContact, searchContact, addNote, addTag, getSlots, bookAppointment, sendSMS };