const Notification = require('../models/Notification');

function userId(req) {
  return req.user?._id || req.session?.userId;
}

function toClient(n) {
  return {
    id: n._id,
    title: n.title || n.data?.title || 'Notification',
    message: n.message || n.data?.message || '',
    icon: n.icon || n.data?.icon || 'bell',
    action_url: n.action_url || n.data?.action_url || null,
    time: n.createdAt,
    read: Boolean(n.read_at),
    read_at: n.read_at,
  };
}

async function list(req, res) {
  try {
    const id = userId(req);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = { user_id: id };
    const [items, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read_at: null }),
    ]);
    return res.json({ success: true, notifications: items.map(toClient), unreadCount, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    console.error('NotificationController.list error:', error);
    return res.status(500).json({ success: false, message: 'Could not load notifications' });
  }
}

async function unread(req, res) {
  try {
    const id = userId(req);
    const items = await Notification.find({ user_id: id, read_at: null }).sort({ createdAt: -1 }).limit(10).lean();
    const count = await Notification.countDocuments({ user_id: id, read_at: null });
    return res.json({ success: true, count, notifications: items.map(toClient) });
  } catch (error) {
    console.error('NotificationController.unread error:', error);
    return res.status(500).json({ success: false, count: 0, notifications: [] });
  }
}

async function markAsRead(req, res) {
  try {
    const id = userId(req);
    const result = await Notification.updateOne({ _id: req.params.id, user_id: id, read_at: null }, { $set: { read_at: new Date() } });
    const count = await Notification.countDocuments({ user_id: id, read_at: null });
    return res.json({ success: true, modified: result.modifiedCount || 0, unreadCount: count });
  } catch (error) {
    console.error('NotificationController.markAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Could not mark notification as read' });
  }
}

async function markAllAsRead(req, res) {
  try {
    const id = userId(req);
    await Notification.updateMany({ user_id: id, read_at: null }, { $set: { read_at: new Date() } });
    return res.json({ success: true, unreadCount: 0 });
  } catch (error) {
    console.error('NotificationController.markAllAsRead error:', error);
    return res.status(500).json({ success: false, message: 'Could not mark notifications as read' });
  }
}

async function destroy(req, res) {
  try {
    const id = userId(req);
    await Notification.deleteOne({ _id: req.params.id, user_id: id });
    const count = await Notification.countDocuments({ user_id: id, read_at: null });
    return res.json({ success: true, unreadCount: count });
  } catch (error) {
    console.error('NotificationController.destroy error:', error);
    return res.status(500).json({ success: false, message: 'Could not delete notification' });
  }
}

module.exports = { list, unread, markAsRead, markAllAsRead, destroy };
