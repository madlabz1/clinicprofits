const Retell = require('retell-sdk');
const client = new Retell({ apiKey: process.env.RETELL_API_KEY });
const AGENTS = {
  inbound:  () => process.env.RETELL_AGENT_INBOUND_ID,
  outbound: () => process.env.RETELL_AGENT_OUTBOUND_ID,
  reminder: () => process.env.RETELL_AGENT_REMINDER_ID
};
async function createOutboundCall({ toNumber, agentType = 'outbound', metadata = {} }) {
  const agentId = AGENTS[agentType]?.();
  if (!agentId) throw new Error('Unknown agent type: ' + agentType);
  return await client.call.createPhoneCall({
    from_number: process.env.RETELL_PHONE_NUMBER,
    to_number: toNumber,
    agent_id: agentId,
    metadata: { ...metadata, agent_type: agentType, ts: Date.now() }
  });
}
module.exports = { createOutboundCall, AGENTS };