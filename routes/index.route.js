const router = require('express').Router();
const VisitorAlert = require('../models/VisitorAlert');
const VisitorSettings = require('../models/VisitorSettings');
const User = require('../models/user.model');
const { roles } = require('../utils/constants');
const { notifyUser } = require('../services/notification.service');

const frontendUrl = () => (process.env.FRONTEND_URL || '').replace(/\/$/, '');

router.get('/', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Use the frontend home page',
    redirect: `${frontendUrl()}/index.html`,
  });
});

function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const raw = xf || req.headers['x-real-ip'] || req.ip || req.connection?.remoteAddress || '';
  return String(raw).replace(/^::ffff:/, '').trim();
}

function parseUa(ua) {
  const s = String(ua || '');
  let browser = 'Unknown';
  if (/edg\//i.test(s)) browser = 'Edge';
  else if (/chrome\//i.test(s) && !/edg\//i.test(s)) browser = 'Chrome';
  else if (/safari\//i.test(s) && !/chrome\//i.test(s)) browser = 'Safari';
  else if (/firefox\//i.test(s)) browser = 'Firefox';
  else if (/opera|opr\//i.test(s)) browser = 'Opera';
  else if (/msie|trident/i.test(s)) browser = 'IE';

  let os = 'Unknown';
  if (/windows nt/i.test(s)) os = 'Windows';
  else if (/android/i.test(s)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(s)) os = 'iOS';
  else if (/mac os x/i.test(s)) os = 'macOS';
  else if (/linux/i.test(s)) os = 'Linux';

  let device_type = 'desktop';
  if (/mobile|iphone|android(?!.*tablet)/i.test(s)) device_type = 'mobile';
  else if (/ipad|tablet/i.test(s)) device_type = 'tablet';

  return { browser, os, device_type };
}

async function lookupGeo(ip) {
  const empty = { country: '', country_code: '', region: '', city: '', is_nigeria: false };
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
    return { ...empty, country: 'Local', country_code: 'LOCAL', city: 'Localhost' };
  }
  try {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,regionName,city,query`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    const data = await res.json();
    if (!data || data.status !== 'success') return empty;
    const code = String(data.countryCode || '').toUpperCase();
    return {
      country: data.country || '',
      country_code: code,
      region: data.regionName || '',
      city: data.city || '',
      is_nigeria: code === 'NG',
    };
  } catch (e) {
    console.error('visitor geo lookup failed', e.message);
    return empty;
  }
}

async function getSettings() {
  let s = await VisitorSettings.findOne({ key: 'default' });
  if (!s) s = await VisitorSettings.create({ key: 'default' });
  return s;
}

/**
 * Public first-visit / visitor beacon.
 * Body: { visitor_key, page_url, referrer, language, screen, timezone }
 */
router.post('/visitor-ping', async (req, res) => {
  try {
    const body = req.body || {};
    let visitorKey = String(body.visitor_key || body.visitorKey || '').trim().slice(0, 80);
    if (!visitorKey || visitorKey.length < 8) {
      visitorKey = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    }

    const ip = clientIp(req);
    const ua = String(req.headers['user-agent'] || body.user_agent || '');
    const parsed = parseUa(ua);
    const geo = await lookupGeo(ip);

    const prior = await VisitorAlert.findOne({ visitor_key: visitorKey }).sort({ createdAt: 1 }).lean();
    const isFirstVisit = !prior;

    const settings = await getSettings();
    const nonNgEvery = Boolean(settings.alert_non_nigeria_every_visit);
    const firstEnabled = settings.first_visit_alerts_enabled !== false;

    let shouldAlert = false;
    if (isFirstVisit && firstEnabled) shouldAlert = true;
    else if (!isFirstVisit && nonNgEvery && !geo.is_nigeria) shouldAlert = true;

    if (!shouldAlert) {
      return res.json({
        success: true,
        alerted: false,
        is_first_visit: isFirstVisit,
        visitor_key: visitorKey,
      });
    }

    // Session de-dupe: same visitor_key + same IP within 2 minutes → skip duplicate
    const recent = await VisitorAlert.findOne({
      visitor_key: visitorKey,
      ip,
      createdAt: { $gte: new Date(Date.now() - 2 * 60 * 1000) },
    }).lean();
    if (recent) {
      return res.json({ success: true, alerted: false, deduped: true, visitor_key: visitorKey, alert_id: recent._id });
    }

    const alert = await VisitorAlert.create({
      visitor_key: visitorKey,
      ip,
      country: geo.country,
      country_code: geo.country_code,
      region: geo.region,
      city: geo.city,
      is_nigeria: geo.is_nigeria,
      is_first_visit: isFirstVisit,
      user_agent: ua.slice(0, 500),
      browser: parsed.browser,
      os: parsed.os,
      device_type: parsed.device_type,
      language: String(body.language || req.headers['accept-language'] || '').slice(0, 80),
      page_url: String(body.page_url || body.pageUrl || '').slice(0, 500),
      referrer: String(body.referrer || '').slice(0, 500),
      screen: String(body.screen || '').slice(0, 40),
      timezone: String(body.timezone || '').slice(0, 60),
    });

    // Notify all admins: in-app notification + web push (works even when admin is offline)
    try {
      const { sendPushToUser } = require('../utils/pushNotifications');
      const admins = await User.find({ role: roles.admin })
        .select('name email role pushSubscription pushSubscriptions')
        .lean();
      const place = [geo.city, geo.region, geo.country].filter(Boolean).join(', ') || 'Unknown location';
      const title = isFirstVisit ? 'New first-time visitor' : 'Visitor alert (non-Nigeria)';
      const message = `${place} · IP ${ip || '—'} · ${parsed.browser} / ${parsed.os} · ${parsed.device_type}`;
      const actionUrl = '/admin/visitor-alerts.html';
      await Promise.all(
        admins.map(async (admin) => {
          try {
            await notifyUser(admin, 'visitor', title, message, actionUrl, {
              icon: 'eye',
              tag: `visitor-${alert._id}`,
              requireInteraction: true,
              push: true,
              data: {
                visitor_alert_id: String(alert._id),
                ip,
                country: geo.country,
                country_code: geo.country_code,
                is_first_visit: isFirstVisit,
              },
            });
          } catch (err) {
            console.error('visitor notifyUser failed', err.message);
            // Fallback: try push alone if notification record failed
            try {
              await sendPushToUser(admin, {
                title,
                body: message,
                url: actionUrl,
                tag: `visitor-${alert._id}`,
                requireInteraction: true,
              });
            } catch (pushErr) {
              if (pushErr.code !== 'PUSH_NOT_CONFIGURED') {
                console.error('visitor push fallback failed', pushErr.message);
              }
            }
          }
        })
      );
    } catch (e) {
      console.error('visitor admin notify', e.message);
    }

    return res.json({
      success: true,
      alerted: true,
      is_first_visit: isFirstVisit,
      visitor_key: visitorKey,
      alert_id: alert._id,
    });
  } catch (error) {
    console.error('visitor-ping error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Visitor ping failed' });
  }
});

module.exports = router;
