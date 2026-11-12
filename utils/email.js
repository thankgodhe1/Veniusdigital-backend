/**
 * Zoho CPaaS / ZeptoMail REST email provider.
 * Same public interface as the previous Bird module: sendMail(to, subject, html [, text]).
 * Delivery is queued in-process so auth/register flows never block on network.
 * Templates are unchanged — only the transport is Zoho API key (no SMTP).
 */

const ZOHO_DEFAULT_ENDPOINT = 'https://cpaas.zoho.com/v1.1/email';
const EMAIL_MAX_CONCURRENT = 3;
const EMAIL_MAX_ATTEMPTS = 3;
const EMAIL_RETRY_BASE_MS = 1500;
const emailQueue = [];
let activeEmailWorkers = 0;

function cleanEmailConfig(value) {
  return String(value == null ? '' : value).trim().replace(/^(["'])(.*)\1$/, '$2').trim();
}

const FROM_EMAIL = cleanEmailConfig(process.env.ZOHO_FROM_EMAIL || process.env.FROM_EMAIL || 'support@digital-grownt.com');
const FROM_NAME = cleanEmailConfig(process.env.ZOHO_FROM_NAME || process.env.FROM_NAME || 'Digital-grownt');

function getZohoConfig() {
  return {
    apiKey: cleanEmailConfig(process.env.ZOHO_CPAAS_API_KEY || process.env.ZOHO_API_KEY || ''),
    fromEmail: FROM_EMAIL,
    fromName: FROM_NAME,
    endpoint: cleanEmailConfig(process.env.ZOHO_EMAIL_API_URL || ZOHO_DEFAULT_ENDPOINT),
  };
}

function isValidEmailAddress(value) {
  if (typeof value !== 'string' || value.length > 254 || /\s/.test(value)) return false;
  return /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?(?:\.[A-Z0-9](?:[A-Z0-9-]*[A-Z0-9])?)+$/i.test(value);
}

function maskEmailAddress(value) {
  const parts = String(value || '').split('@');
  if (parts.length !== 2) return '[invalid email]';
  return `${parts[0].slice(0, 2)}***@${parts[1]}`;
}

function getZohoAuthorization(apiKey) {
  const key = cleanEmailConfig(apiKey);
  if (!key) return null;
  return /^Zoho-enczapikey\s+/i.test(key) ? key : `Zoho-enczapikey ${key}`;
}

function diagnoseZohoResponse(status, data) {
  const safeResponse = data && typeof data === 'object' ? JSON.stringify(data).slice(0, 1200) : String(data || '').slice(0, 1200);
  console.error('[Zoho Debug] REST API rejected email:', { httpStatus: status, response: safeResponse });
  if (status === 401) {
    console.error('[Zoho Diagnosis] HTTP 401 — verify ZOHO_CPAAS_API_KEY (Agent Send Mail Token) and Authorization prefix "Zoho-enczapikey ".');
  } else if (status === 403) {
    console.error('[Zoho Diagnosis] HTTP 403 — check agent permissions and endpoint.');
  } else if (status === 400 || status === 422) {
    console.error('[Zoho Diagnosis] Invalid request — sender verification, recipient, or payload.');
  } else if (status === 404) {
    console.error('[Zoho Diagnosis] Endpoint not found — check ZOHO_EMAIL_API_URL / data center.');
  } else if (status === 429) {
    console.error('[Zoho Diagnosis] Rate limit — will retry.');
  } else if (status >= 500) {
    console.error('[Zoho Diagnosis] Zoho server error — will retry.');
  }
}

async function deliverZohoEmail(job) {
  const config = getZohoConfig();
  const authorization = getZohoAuthorization(config.apiKey);
  if (!authorization) throw Object.assign(new Error('ZOHO_CPAAS_API_KEY is missing.'), { permanent: true });
  if (typeof fetch !== 'function') throw Object.assign(new Error('Zoho REST email requires Node.js 18+.'), { permanent: true });
  if (!config.endpoint.startsWith('https://')) throw Object.assign(new Error('Zoho REST endpoint must use HTTPS.'), { permanent: true });
  if (!isValidEmailAddress(config.fromEmail)) throw Object.assign(new Error(`Invalid Zoho sender email: ${maskEmailAddress(config.fromEmail)}`), { permanent: true });
  if (!isValidEmailAddress(job.to)) throw Object.assign(new Error(`Invalid recipient email: ${maskEmailAddress(job.to)}`), { permanent: true });

  const payload = {
    from: { address: config.fromEmail, name: config.fromName },
    to: [{ email_address: { address: job.to, name: '' } }],
    subject: job.subject,
    htmlbody: job.html || `<p>${job.subject}</p>`,
  };
  if (job.text) payload.textbody = job.text;

  let response;
  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    throw new Error(`Could not connect to Zoho REST API: ${networkError.message}`);
  }

  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : null; }
  catch (_) { data = { responseText: raw.slice(0, 1200) }; }

  if (!response.ok) {
    diagnoseZohoResponse(response.status, data);
    const providerMessage = (data && (data.message || (data.error && data.error.message) || data.error)) || `Zoho REST request failed (HTTP ${response.status})`;
    const error = new Error(typeof providerMessage === 'string' ? providerMessage : JSON.stringify(providerMessage));
    error.status = response.status;
    error.permanent = response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404 || response.status === 422;
    throw error;
  }

  console.info('[Zoho] Email accepted:', {
    jobId: job.id,
    messageId: (data && data.data && data.data[0] && data.data[0].message_id) || (data && (data.message_id || data.request_id)) || null,
    recipient: maskEmailAddress(job.to),
  });
  return data;
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function processEmailQueue() {
  while (activeEmailWorkers < EMAIL_MAX_CONCURRENT && emailQueue.length > 0) {
    const job = emailQueue.shift();
    activeEmailWorkers += 1;
    (async () => {
      for (let attempt = 1; attempt <= EMAIL_MAX_ATTEMPTS; attempt += 1) {
        try {
          await deliverZohoEmail(job);
          return;
        } catch (error) {
          console.error(`[Zoho] Email attempt ${attempt}/${EMAIL_MAX_ATTEMPTS} failed:`, {
            jobId: job.id,
            recipient: maskEmailAddress(job.to),
            message: error.message,
            status: error.status || null,
          });
          if (error.permanent || attempt === EMAIL_MAX_ATTEMPTS) {
            console.error('[Zoho] Email delivery permanently failed:', {
              jobId: job.id,
              recipient: maskEmailAddress(job.to),
              subject: job.subject,
              reason: error.message,
            });
            return;
          }
          await delay(EMAIL_RETRY_BASE_MS * attempt);
        }
      }
    })().catch((error) => {
      console.error('[Zoho] Unexpected email worker error:', error.message);
    }).finally(() => {
      activeEmailWorkers -= 1;
      processEmailQueue();
    });
  }
}

/**
 * Non-blocking send. Queues delivery; does not throw on provider failure after queue accept.
 * @param {string} to
 * @param {string} subject
 * @param {string} html
 * @param {string} [text]
 */
async function sendMail(to, subject, html, text) {
  const config = getZohoConfig();
  const recipient = String(to || '').trim();
  const mailSubject = String(subject || '').trim();
  const jobId = `zoho-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  if (!config.apiKey) {
    console.warn('[Zoho] ZOHO_CPAAS_API_KEY not set – email not sent.', { subject: mailSubject, to: maskEmailAddress(recipient) });
    return { id: jobId, provider: 'zoho_rest_skipped', queued: false };
  }
  if (!isValidEmailAddress(recipient)) {
    console.error('[Zoho] Invalid recipient, not queued.', { jobId, recipient: maskEmailAddress(recipient) });
    return { id: jobId, provider: 'zoho_rest_skipped', queued: false };
  }
  if (!mailSubject) {
    console.error('[Zoho] Subject missing, not queued.', { jobId });
    return { id: jobId, provider: 'zoho_rest_skipped', queued: false };
  }

  emailQueue.push({
    id: jobId,
    to: recipient,
    subject: mailSubject,
    html: String(html || ''),
    text: text == null ? '' : String(text),
  });
  console.info('[Zoho] Email queued:', { jobId, recipient: maskEmailAddress(recipient), queueLength: emailQueue.length });
  setImmediate(processEmailQueue);
  return { id: jobId, provider: 'zoho_rest_queued', queued: true };
}

function isEmailConfigured() {
  return Boolean(getZohoConfig().apiKey);
}

module.exports = {
  sendMail,
  isEmailConfigured,
  FROM_EMAIL,
  FROM_NAME,
  getZohoConfig,
  ZOHO_DEFAULT_ENDPOINT,
};
