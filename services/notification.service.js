const Notification = require('../models/Notification');
const { sendPushToUser } = require('../utils/pushNotifications');

function normalizeUrl(url) {
  if (!url) return null;
  const value = String(url).trim();
  if (!value) return null;
  if (value.startsWith('/')) return value;
  if (value.startsWith('/user/')) return '/frontend' + value;
  if (value.startsWith('/admin/')) return '/frontend' + value;

  const configured = String(process.env.FRONTEND_URL || '').replace(/\/$/, '');
  let path = value;
  if (configured && value.startsWith(configured + '/')) {
    path = value.slice(configured.length);
  }

  const routes = {
    '/dashboard': '/user/dashboard.html',
    '/dashboard/account-settings': '/user/account-settings.html',
    '/dashboard/verify-account': '/user/verify-account.html',
    '/dashboard/connect-wallet': '/user/connect-wallet.html',
    '/dashboard/deposits': '/user/deposits.html',
    '/dashboard/withdrawals': '/user/withdrawals.html',
    '/dashboard/withdraw-funds': '/user/withdraw-funds.html',
    '/dashboard/buy-plan': '/user/buy-plan.html',
    '/dashboard/cards': '/user/cards.html',
    '/dashboard/portfolio': '/user/portfolio.html',
    '/dashboard/copy-trading': '/user/copy-trading.html',
    '/dashboard/bot-trading': '/user/bot-trading.html',
    '/dashboard/markets': '/user/markets.html',
    '/dashboard/mining': '/user/mining.html',
    '/dashboard/trade': '/user/trade.html',
    '/dashboard/real-estate': '/user/real-estate.html',
    '/dashboard/my-loans': '/user/my-loans.html',
    '/dashboard/stocks': '/user/stocks.html',
    '/dashboard/courses': '/user/courses.html',
    '/dashboard/singalssubscriptions': '/user/singalssubscriptions.html',
    '/dashboard/accounthistory': '/user/accounthistory.html',
    '/dashboard/tradinghistory': '/user/tradinghistory.html',
    '/dashboard/transfer-funds': '/user/transfertouser.html',
    '/dashboard/support': '/user/support.html',
    '/dashboard/notification': '/user/notification.html',
    '/dashboard/convert': '/user/convert.html',
    '/dashboard/trades/history': '/user/trades-history.html'
  };

  if (path === '/user/notification.html') return '/user/notification.html';
  if (path === '/user/dashboard.html') return '/user/dashboard.html';
  if (routes[path]) return routes[path];
  if (path.startsWith('/dashboard/')) {
    const tail = path.slice('/dashboard/'.length).replace(/^\/+|\/+$/g, '');
    if (!tail) return '/user/dashboard.html';
    return '/user/' + tail.replace(/\//g, '-') + '.html';
  }
  return value;
}

async function notifyUser(user, type, title, message, actionUrl = null, options = {}) {
  const userId = user?._id || user?.id || user;
  if (!userId) throw new Error('A user is required to create a notification');

  const notification = await Notification.create({
    user_id: userId,
    type: type || 'account',
    title: String(title || 'Notification'),
    message: String(message || ''),
    icon: options.icon || (type === 'kyc' ? 'shield' : type === 'account' ? 'user' : 'bell'),
    action_url: normalizeUrl(actionUrl),
    data: {
      title: String(title || 'Notification'),
      message: String(message || ''),
      type: type || 'account',
      icon: options.icon || (type === 'kyc' ? 'shield' : type === 'account' ? 'user' : 'bell'),
      action_url: normalizeUrl(actionUrl),
    },
  });

  if (options.push !== false) {
    try {
      await sendPushToUser(user, {
        title: notification.title,
        body: notification.message,
        url: notification.action_url || '/user/dashboard.html',
        tag: options.tag || `digital-grownt-${notification.type}-${notification._id}`,
        icon: options.pushIcon,
        badge: options.pushBadge,
      });
    } catch (error) {
      if (error.code !== 'PUSH_NOT_CONFIGURED') console.error('Push notification failed:', error.message);
    }
  }

  return notification;
}

module.exports = { notifyUser, normalizeUrl };
