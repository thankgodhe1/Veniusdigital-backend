let webpush;

function getWebPush() {
  if (webpush) return webpush;
  try {
    webpush = require('web-push');
    return webpush;
  } catch (_) {
    return null;
  }
}

function getPushConfig() {
  const library = getWebPush();
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!library || !publicKey || !privateKey || !subject) return null;
  return { library, publicKey, privateKey, subject };
}

function configurePush() {
  const config = getPushConfig();
  if (!config) return null;
  config.library.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  return config;
}

function subscriptionsForUser(user) {
  const list = Array.isArray(user.pushSubscriptions) ? user.pushSubscriptions.slice() : [];
  if (user.pushSubscription && !list.some((item) => item && item.endpoint === user.pushSubscription.endpoint)) {
    list.push(user.pushSubscription);
  }
  return list.filter((item) => item && item.endpoint && item.keys && item.keys.p256dh && item.keys.auth);
}

function normalizePayload(payload) {
  return {
    title: String(payload.title || 'Digital-grownt').slice(0, 120),
    body: String(payload.body || 'You have a new notification').slice(0, 500),
    icon: payload.icon || '/storage/app/public/photos/BCPc6799aTDnlcAtaRZAXzQZ7MBzrLZL0H6DStQv.png',
    badge: payload.badge || '/storage/app/public/photos/BCPc6799aTDnlcAtaRZAXzQZ7MBzrLZL0H6DStQv.png',
    url: payload.url || '/dashboard.html',
    tag: payload.tag || 'digital-grownt-notification',
  };
}

async function sendPushToUser(user, payload) {
  const config = configurePush();
  if (!config) {
    const error = new Error('Web push is not configured. Install web-push and set VAPID environment variables.');
    error.code = 'PUSH_NOT_CONFIGURED';
    throw error;
  }
  const subscriptions = subscriptionsForUser(user);
  if (!subscriptions.length) return { sent: 0, removed: 0 };

  const body = JSON.stringify(normalizePayload(payload));
  let sent = 0;
  let removed = 0;
  const active = [];
  for (const subscription of subscriptions) {
    try {
      await config.library.sendNotification(subscription, body);
      sent += 1;
      active.push(subscription);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        removed += 1;
      } else {
        active.push(subscription);
        console.error('Web push delivery failed:', error.message);
      }
    }
  }

  if (removed > 0) {
    user.pushSubscriptions = active;
    user.pushSubscription = active[active.length - 1] || null;
    await user.save({ validateBeforeSave: false });
  }
  return { sent, removed };
}

module.exports = { getPushConfig, sendPushToUser, normalizePayload, subscriptionsForUser };
