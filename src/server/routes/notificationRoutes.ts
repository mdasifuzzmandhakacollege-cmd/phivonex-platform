import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/authMiddleware';
import {
  getUserNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  deleteAllNotifications,
} from '../services/notificationService';

export const notificationRouter = Router();

/**
 * GET /api/notifications
 * Retrieves paginated notifications for the authenticated user with optional filtering.
 */
notificationRouter.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const offset = req.query.offset ? parseInt(String(req.query.offset), 10) : 0;
    const unreadOnly = req.query.unreadOnly === 'true' || req.query.unreadOnly === '1';
    const type = req.query.type ? String(req.query.type) : undefined;

    const result = await getUserNotifications(userId, {
      limit: isNaN(limit) ? 20 : limit,
      offset: isNaN(offset) ? 0 : offset,
      unreadOnly,
      type,
    });

    return res.json(result);
  } catch (err: any) {
    console.error('[Notification API] Error fetching notifications:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve notifications.',
    });
  }
});

/**
 * GET /api/notifications/unread-count
 * Returns the unread notification badge count for the authenticated user.
 */
notificationRouter.get('/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const unreadCount = await getUnreadNotificationCount(userId);
    return res.json({ unreadCount });
  } catch (err: any) {
    console.error('[Notification API] Error fetching unread count:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to retrieve unread notification count.',
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Marks a specific notification as read.
 */
notificationRouter.patch('/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const publicNotificationId = req.params.id;

    if (!publicNotificationId) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Notification ID is required.',
      });
    }

    const success = await markNotificationAsRead(userId, publicNotificationId);
    return res.json({ success, id: publicNotificationId });
  } catch (err: any) {
    console.error('[Notification API] Error marking notification as read:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to mark notification as read.',
    });
  }
});

/**
 * PATCH /api/notifications/read-all
 * POST /api/notifications/read-all
 * Marks all notifications for the authenticated user as read.
 */
const handleReadAll = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await markAllNotificationsAsRead(userId);
    return res.json({ success: true, count });
  } catch (err: any) {
    console.error('[Notification API] Error marking all notifications as read:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to mark all notifications as read.',
    });
  }
};

notificationRouter.patch('/read-all', requireAuth, handleReadAll);
notificationRouter.post('/read-all', requireAuth, handleReadAll);

/**
 * DELETE /api/notifications/:id
 * Deletes a specific notification for the authenticated user.
 */
notificationRouter.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const publicNotificationId = req.params.id;

    if (!publicNotificationId) {
      return res.status(400).json({
        error: 'INVALID_ID',
        message: 'Notification ID is required.',
      });
    }

    const success = await deleteNotification(userId, publicNotificationId);
    if (!success) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Notification not found or already deleted.',
      });
    }

    return res.json({ success: true, id: publicNotificationId });
  } catch (err: any) {
    console.error('[Notification API] Error deleting notification:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to delete notification.',
    });
  }
});

/**
 * DELETE /api/notifications
 * Deletes notifications for the authenticated user (supports ?readOnly=true).
 */
notificationRouter.delete('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const readOnly = req.query.readOnly === 'true' || req.query.readOnly === '1';

    const count = await deleteAllNotifications(userId, { readOnly });
    return res.json({ success: true, count });
  } catch (err: any) {
    console.error('[Notification API] Error bulk deleting notifications:', err);
    return res.status(500).json({
      error: 'SERVER_ERROR',
      message: 'Failed to delete notifications.',
    });
  }
});
