// ─────────────────────────────────────────────────────────────
//  Clinic Profits AI — Dashboard v2.0
//  3 Agents: Ashley (Inbound) · Jordan (Outbound) · Casey (Reminder)
//  Polls /api/dashboard every 3s
// ─────────────────────────────────────────────────────────────

let allCalls      = [];
let prevTotal     = 0;
let activeFilter  = 'all';
let activeTab     = 'all';

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  refresh();
  setInterval(refresh, 3000);
});

// ── Fetch & Render ────────────────────────────────────────────
async function refresh() {
  try {
    const r = await fetch('/api/dashboard');
    if (!r.ok) return;
    const d = await r.json();

    allCalls = d.calls || [];

    renderStats(d.stats);
    renderCalls(allCalls, activeFilter);
    renderContacts(d.contacts || []);
    renderAppointments(d.appointments || []);
    renderReminders(d.reminders || []);
    updateTabBadges(d.stats);

    if (d.stats.totalCalls > prevTotal && prevTotal > 0) {
      toast('📞 New call processed!');
    }
    prevTotal = d.stats.totalCalls;
  } catch (e) {
    console.error('Refresh error:', e);
  }
}

// ── Stats ─────────────────────────────────────────────────────
function renderStats(s) {
  setNum('sTot',  s.totalCalls);
  setNum('sInb',  s.inboundCalls);
  setNum('sOut',  s.outboundCalls);
  setNum('sRem',  s.reminderCalls);
  setNum('sCon',  s.contactsCreated);
  setNum('sApp',  s.appointmentsBooked);
  setNum('sConf', s.appointmentsConfirmed);
  setNum('sSMS',  s.smsSent);
  setText('bCalls', s.totalCalls + ' calls');
}

function updateTabBadges(s) {
  setText('bContacts',  s.contactsCreated);
  setText('bAppts',     s.appointmentsBooked);
  setText('bReminders', s.appointmentsConfirmed + s.appointmentsCancelled);
  // Agent tab badges
  const inbBadges = document.querySelectorAll('.inb-badge');
  const outBadges = document.querySelectorAll('.out-badge');
  const remBadges = document.querySelectorAll('.rem-badge');
  inbBadges.forEach(b => b.textContent = s.inboundCalls);
  outBadges.forEach(b => b.textContent = s.outboundCalls);
  remBadges.forEach(b => b.textContent = s.reminderCalls);
}

// ── Call Log ──────────────────────────────────────────────────
function renderCalls(calls, filter) {
  const el = document.getElementById('callLog');
  const filtered = filter === 'all' ? calls : calls.filter(c => c.agentType === filter);

  if (!filtered.length) {
    el.innerHTML = `
      <div class="empty">
        <div class="ei">📞</div>
        <div>${filter === 'all' ? 'No calls yet' : 'No ' + filter + ' calls yet'}</div>
        <div class="es">Run a simulation above to see live data</div>
      </div>`;
    return;
  }

  el.innerHTML = filtered.map(c => `
    <div class="call-card ${c.agentType}-card ${c.status === 'active' ? 'active-call' : ''}"
         onclick="showTranscript('${c.callId}')">
      <div class="cc-top">
        <div class="cc-left">
          <span class="cc-agent-badge badge-${c.agentType}">
            ${agentLabel(c.agentType)}
          </span>
          <span class="cc-phone">${formatPhone(c.phone)}</span>
        </div>
        <span class="cc-status ${c.status === 'active' ? 's-active' : 's-ended'}">
          ${c.status === 'active' ? '● LIVE' : '✓ Done'}
        </span>
      </div>
      <div class="cc-intent">${c.intent || 'Processing…'}</div>
      <div class="cc-meta">
        ${c.duration ? `<span class="cc-dur">⏱ ${c.duration}s</span>` : ''}
        ${c.direction ? `<span class="cc-dur">${c.direction === 'inbound' ? '↙ Inbound' : '↗ Outbound'}</span>` : ''}
        ${c.sentiment && c.sentiment !== 'Unknown' ? `<span class="cc-sent sent-${c.sentiment.toLowerCase()}">${c.sentiment}</span>` : ''}
        ${c.simulated ? `<span class="cc-sim">⚡ SIM</span>` : ''}
      </div>
      ${c.transcript && c.transcript.length ? `<div class="cc-transcript-hint">Tap to view transcript →</div>` : ''}
    </div>
  `).join('');
}

function agentLabel(type) {
  if (type === 'inbound')  return '📞 Ashley';
  if (type === 'outbound') return '📤 Jordan';
  if (type === 'reminder') return '⏰ Casey';
  return type;
}

// ── Contacts ──────────────────────────────────────────────────
function renderContacts(contacts) {
  const el = document.getElementById('contactList');
  if (!contacts.length) {
    el.innerHTML = `<div class="empty"><div class="ei">👤</div><div class="es">Auto-created in GoHighLevel after each call</div></div>`;
    return;
  }
  el.innerHTML = contacts.map(c => `
    <div class="contact-card">
      <div class="co-top">
        <span class="co-name">👤 ${c.name || 'Unknown'}</span>
        <span class="co-agent badge-${c.agentType || 'inbound'}">${agentLabel(c.agentType)}</span>
      </div>
      <div class="co-phone">${formatPhone(c.phone)}</div>
      <div class="co-tags">
        ${(c.tags || []).map(t => `
          <span class="ctag ${tagClass(t)}">${t}</span>
        `).join('')}
      </div>
      ${c.id ? `<div class="co-id">✓ GHL ID: ${c.id.slice(0, 16)}…</div>` : ''}
    </div>
  `).join('');
}

function tagClass(tag) {
  if (tag.includes('appointment') || tag.includes('booked')) return 'ctag-appt';
  if (tag.includes('dnc') || tag.includes('opted')) return 'ctag-dnc';
  if (tag.includes('inbound'))  return 'ctag-inbound';
  if (tag.includes('outbound')) return 'ctag-outbound';
  if (tag.includes('reminder')) return 'ctag-reminder';
  return '';
}

// ── Appointments ──────────────────────────────────────────────
function renderAppointments(appts) {
  const el = document.getElementById('apptList');
  if (!appts.length) {
    el.innerHTML = `<div class="empty"><div class="ei">📅</div><div class="es">Booked live by AI agents</div></div>`;
    return;
  }
  el.innerHTML = appts.map(a => `
    <div class="appt-card ${a.agentType === 'outbound' ? 'out-appt' : ''}">
      <div class="ap-top">
        <span class="ap-name">📅 ${a.contactName || 'Patient'}</span>
        <span class="ap-badge ${a.agentType === 'outbound' ? 'ap-badge-out' : 'ap-badge-in'}">
          ${agentLabel(a.agentType)}
        </span>
      </div>
      <div class="ap-time">${formatDate(a.startTime)}</div>
      <div class="ap-type">${a.complaint || 'Consultation'}</div>
      <div class="ap-sms">✅ SMS confirmation sent</div>
    </div>
  `).join('');
}

// ── Reminders ─────────────────────────────────────────────────
function renderReminders(reminders) {
  const el = document.getElementById('reminderList');
  if (!reminders.length) {
    el.innerHTML = `<div class="empty"><div class="ei">⏰</div><div class="es">Confirmation outcomes from Agent 3 (Casey)</div></div>`;
    return;
  }
  el.innerHTML = reminders.map(r => `
    <div class="reminder-card">
      <div class="rr-top">
        <span class="rr-name">⏰ ${r.firstName || 'Patient'}</span>
        <span class="rr-outcome outcome-${r.outcome || 'no-answer'}">${outcomeLabel(r.outcome)}</span>
      </div>
      <div class="rr-phone">${formatPhone(r.phone)}</div>
      ${r.smsSent ? `<div class="rr-sms">💬 Follow-up SMS sent</div>` : ''}
    </div>
  `).join('');
}

function outcomeLabel(o) {
  const map = {
    confirmed:   '✅ Confirmed',
    cancelled:   '❌ Cancelled',
    rescheduled: '🔄 Rescheduled',
    voicemail:   '📱 Voicemail',
    'no-answer': '📵 No Answer'
  };
  return map[o] || o || 'Unknown';
}

// ── Transcript ────────────────────────────────────────────────
async function showTranscript(callId) {
  const call = allCalls.find(c => c.callId === callId);
  if (!call || !call.transcript || !call.transcript.length) return;

  const drawer = document.getElementById('drawer');
  drawer.style.display = 'block';

  document.getElementById('dMeta').textContent =
    `${agentLabel(call.agentType)} · ${call.duration ? call.duration + 's' : ''} · ${call.sentiment || ''}`;

  document.getElementById('tLines').innerHTML = call.transcript.map(line => `
    <div class="t-line">
      <span class="t-role ${line.role}">${line.role === 'agent' ? '🤖 AI' : '👤 Patient'}</span>
      <span class="t-bubble">${escHtml(line.content || '')}</span>
    </div>
  `).join('');

  document.getElementById('dSummary').innerHTML = call.summary
    ? `<strong>AI Summary:</strong> ${escHtml(call.summary)}`
    : '';

  drawer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeDrawer() {
  document.getElementById('drawer').style.display = 'none';
}

// ── Tab Switching ─────────────────────────────────────────────
function setTab(tab, el) {
  activeTab = tab;

  // Update tab styles
  document.querySelectorAll('.atab').forEach(t => t.classList.remove('active'));
  if (el) el.classList.add('active');

  // Filter call log to match tab
  filterCalls(tab === 'all' ? 'all' : tab,
    document.querySelector(`.fb.${tab === 'all' ? 'active' : tab + '-fb'}`) || document.querySelector('.fb'));

  // Show/hide sim groups
  ['inbound', 'outbound', 'reminder'].forEach(type => {
    const group = document.getElementById('ctrl-' + type) ||
                  document.querySelector('.sim-group[data-agent="' + type + '"]');
    if (group) {
      group.style.display = (tab === 'all' || tab === type) ? 'block' : 'none';
    }
  });
}

// ── Call Filter ───────────────────────────────────────────────
function filterCalls(filter, btn) {
  activeFilter = filter;

  document.querySelectorAll('.fb').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  renderCalls(allCalls, filter);
}

// ── Simulations ───────────────────────────────────────────────
async function simulate(scenario) {
  const labels = {
    inbound_new:         '📞 Simulating new patient booking…',
    inbound_transfer:    '📞 Simulating insurance inquiry + transfer…',
    outbound_booked:     '📤 Simulating outbound lead booking…',
    outbound_voicemail:  '📤 Simulating outbound voicemail…',
    reminder_confirmed:  '⏰ Simulating appointment confirmation…',
    reminder_reschedule: '⏰ Simulating reminder reschedule…'
  };

  toast(labels[scenario] || '⚡ Running simulation…');

  try {
    const r = await fetch('/api/demo/simulate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ scenario })
    });
    const d = await r.json();

    if (d.success) {
      const ghlStatus = d.contactId
        ? `GHL contact ${d.contactId.slice(0, 10)}… created`
        : d.ghlError ? `(GHL: ${d.ghlError.slice(0, 40)})` : 'done';
      toast(`✅ ${scenario} complete — ${ghlStatus}`);
      await refresh();
    } else {
      toast('❌ ' + (d.error || 'Simulation failed'), 'err');
    }
  } catch (e) {
    toast('❌ ' + e.message, 'err');
  }
}

// ── Live Outbound Call ────────────────────────────────────────
async function liveCall(agentType, inputId) {
  const phone = document.getElementById(inputId)?.value?.trim();
  if (!phone) { toast('❌ Enter a US phone number (+1…)', 'err'); return; }
  if (!phone.startsWith('+1') && !phone.startsWith('1') && phone.length < 10) {
    toast('❌ Use US format: +12125550100', 'warn'); return;
  }

  toast(`🔴 Calling ${phone} with ${agentType} agent…`);

  try {
    const r = await fetch('/api/demo/call', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, agentType })
    });
    const d = await r.json();

    if (d.success) {
      toast(`📞 Live call started! ID: ${d.callId}`);
      await refresh();
    } else {
      toast('❌ ' + (d.error || 'Call failed'), 'err');
    }
  } catch (e) {
    toast('❌ ' + e.message, 'err');
  }
}

// ── Reset ─────────────────────────────────────────────────────
async function resetDemo() {
  if (!confirm('Reset all demo data? This cannot be undone.')) return;
  try {
    await fetch('/api/demo/reset', { method: 'POST' });
    toast('↺ All demo data cleared');
    await refresh();
  } catch (e) {
    toast('❌ Reset failed: ' + e.message, 'err');
  }
}

// ── Utilities ─────────────────────────────────────────────────
function setNum(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? 0;
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val ?? '';
}

function formatPhone(p) {
  if (!p) return 'Unknown';
  // +12125551234 → +1 (212) 555-1234
  const m = (p + '').replace(/\D/g, '');
  if (m.length === 11 && m[0] === '1') {
    return `+1 (${m.slice(1,4)}) ${m.slice(4,7)}-${m.slice(7)}`;
  }
  if (m.length === 10) {
    return `(${m.slice(0,3)}) ${m.slice(3,6)}-${m.slice(6)}`;
  }
  return p;
}

function formatDate(iso) {
  if (!iso) return 'TBC';
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toast(msg, type = 'ok') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast show${type === 'err' ? ' err' : type === 'warn' ? ' warn' : ''}`;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = 'toast'; }, 5000);
}
