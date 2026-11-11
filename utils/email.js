const BIRD_API_KEY = process.env.BIRD_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'support@digital-grownt.com';
const FROM_NAME = process.env.FROM_NAME || 'Digital-grownt';

/** Infer Bird regional API host from key prefix (bk_us1_... / bk_eu1_...) */
function birdBaseUrl() {
  const key = String(BIRD_API_KEY || '');
  if (key.includes('_us1_') || key.startsWith('bk_eu1')) return 'https://us1.platform.bird.com';
  return 'https://us1.platform.bird.com';
}

/**
 * Send transactional email via Bird.com
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 */
async function sendMail(to, subject, html) {
  if (!BIRD_API_KEY) {
    console.warn('BIRD_API_KEY not set – email not sent. Subject:', subject, 'To:', to);
    return { id: 'dev-skip' };
  }

  const fromEmail = String(FROM_EMAIL || '').trim();
  const payload = {
    from: { email: fromEmail, name: FROM_NAME },
    to: [String(to).trim()],
    subject: String(subject || ''),
    html: String(html || ''),
    category: 'transactional',
  };

  const url = birdBaseUrl() + '/v1/email/messages';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + BIRD_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = { raw: text }; }

  if (!res.ok) {
    const msg = (data && (data.message || data.error || data.detail)) || text || res.statusText;
    console.error('Bird email failed:', res.status, msg);
    const err = new Error(typeof msg === 'string' ? msg : 'Bird email send failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data || { id: 'bird-ok' };
}

function isEmailConfigured() {
  return Boolean(String(BIRD_API_KEY || '').trim());
}

module.exports = {
  sendMail,
  isEmailConfigured,
  FROM_EMAIL,
  FROM_NAME,
  BIRD_API_KEY,
  birdBaseUrl,
};
