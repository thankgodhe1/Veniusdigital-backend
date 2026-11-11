const Notification = require('../models/notificationSchema');
const { sendPushToUser } = require('./pushNotifications');

async function createNotification(userId, { title, message, type = 'info', icon = 'bell', link = '/user/notifications.html', meta = {}, sendPush = false }) {
  const notif = await Notification.create({
    user: userId,
    title,
    message,
    type,
    icon,
    link,
    meta,
  });

  if (sendPush) {
    try {
      const User = require('../models/user.model');
      const user = await User.findById(userId);
      if (user) {
        await sendPushToUser(user, {
          title,
          body: message,
          url: link,
          tag: type,
        });
      }
    } catch (err) {
      console.error('Push failed:', err.message);
    }
  }

  return notif;
}

module.exports = { createNotification };
