import { Router, Response } from 'express';
import { requireAuth, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import {
  getUserTickets,
  getTicketByPublicId,
  createSupportTicket,
  addTicketMessage,
  updateTicketStatus,
  getAdminTickets,
  getUserLiveDataForSupport,
} from '../services/supportService';
import { processSupportInquiry } from '../services/supportEngineService';

const router = Router();

// ============================================================================
// USER SUPPORT ROUTES
// ============================================================================

/**
 * POST /api/support/chat
 * Server-authoritative AI Support Chat endpoint.
 * Reads safe user live data and queries support engine.
 */
router.post('/chat', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { prompt, conversationHistory } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Prompt is required.' });
      return;
    }

    const liveData = await getUserLiveDataForSupport(userId);
    const engineResponse = await processSupportInquiry({
      userId,
      prompt: prompt.trim(),
      conversationHistory,
      liveData,
    });

    res.json({
      success: true,
      response: engineResponse,
    });
  } catch (err: any) {
    console.error('[SupportRoutes] Chat error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An error occurred processing your inquiry.' });
  }
});

/**
 * GET /api/support/tickets
 * Get authenticated user's support ticket history.
 */
router.get('/tickets', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const tickets = await getUserTickets(userId);
    res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('[SupportRoutes] Get tickets error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch support tickets.' });
  }
});

/**
 * POST /api/support/tickets
 * Create a new support ticket manually.
 */
router.post('/tickets', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const { category, subject, message, relatedEntityType, relatedPublicReference } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message is required.' });
      return;
    }

    const ticket = await createSupportTicket({
      userId,
      category: category || 'Other',
      subject: subject || 'Support Request',
      userMessage: message.trim(),
      relatedEntityType: relatedEntityType || null,
      relatedPublicReference: relatedPublicReference || null,
    });

    res.status(201).json({ success: true, ticket });
  } catch (err: any) {
    console.error('[SupportRoutes] Create ticket error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to create support ticket.' });
  }
});

/**
 * GET /api/support/tickets/:publicTicketId
 * Get detailed ticket and message history for a specific ticket.
 * Enforces strict user ownership guardrails.
 */
router.get('/tickets/:publicTicketId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const isAdmin = (req.user!.role || '').toUpperCase() === 'ADMIN' || (req.user!.role || '').toUpperCase() === 'SUPER_ADMIN';
    const { publicTicketId } = req.params;

    const data = await getTicketByPublicId(publicTicketId, userId, isAdmin);
    if (!data) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Support ticket not found.' });
      return;
    }

    res.json({ success: true, ticket: data.ticket, messages: data.messages });
  } catch (err: any) {
    if (err.statusCode === 403) {
      res.status(403).json({ error: 'ACCESS_DENIED', message: err.message });
      return;
    }
    console.error('[SupportRoutes] Get ticket detail error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch support ticket details.' });
  }
});

/**
 * POST /api/support/tickets/:publicTicketId/messages
 * Add a user message to an existing support ticket.
 */
router.post('/tickets/:publicTicketId/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const userDisplayName = (req.user as any).displayName || (req.user as any).fullName || req.user!.email || 'User';
    const { publicTicketId } = req.params;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message is required.' });
      return;
    }

    // Verify ownership
    const ticketData = await getTicketByPublicId(publicTicketId, userId, false);
    if (!ticketData) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Support ticket not found.' });
      return;
    }

    const newMessage = await addTicketMessage({
      publicTicketId,
      senderType: 'USER',
      senderUserId: userId,
      senderPublicName: userDisplayName,
      message: message.trim(),
    });

    res.json({ success: true, message: newMessage });
  } catch (err: any) {
    if (err.statusCode === 403) {
      res.status(403).json({ error: 'ACCESS_DENIED', message: err.message });
      return;
    }
    console.error('[SupportRoutes] Add message error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send message.' });
  }
});

// ============================================================================
// ADMIN SUPPORT ROUTES
// ============================================================================

/**
 * GET /api/admin/support/tickets
 * Admin inbox for all support tickets with filtering and stats.
 */
router.get('/admin/tickets', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, category, search, page, limit } = req.query;
    const result = await getAdminTickets({
      status: status as string,
      category: category as string,
      search: search as string,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
    });

    res.json({ success: true, ...result });
  } catch (err: any) {
    console.error('[SupportRoutes] Admin get tickets error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch admin support queue.' });
  }
});

/**
 * GET /api/admin/support/tickets/:publicTicketId
 * Admin detail view for a ticket, user live context, and message history.
 */
router.get('/admin/tickets/:publicTicketId', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { publicTicketId } = req.params;
    const data = await getTicketByPublicId(publicTicketId, undefined, true);
    if (!data) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Support ticket not found.' });
      return;
    }

    const userLiveData = await getUserLiveDataForSupport(data.ticket.userId);

    res.json({
      success: true,
      ticket: data.ticket,
      messages: data.messages,
      userLiveData,
    });
  } catch (err: any) {
    console.error('[SupportRoutes] Admin get ticket detail error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to fetch admin ticket detail.' });
  }
});

/**
 * POST /api/admin/support/tickets/:publicTicketId/reply
 * Admin reply to a support ticket.
 */
router.post('/admin/tickets/:publicTicketId/reply', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const adminUserId = req.user!.id;
    const { publicTicketId } = req.params;
    const { message, isInternalNote, status, priority } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Message is required.' });
      return;
    }

    const newMessage = await addTicketMessage({
      publicTicketId,
      senderType: 'ADMIN',
      senderUserId: adminUserId,
      senderPublicName: 'PHIVONEX Support Specialist',
      message: message.trim(),
      isInternalNote: Boolean(isInternalNote),
    });

    if (status) {
      await updateTicketStatus({ publicTicketId, status, priority });
    }

    res.json({ success: true, message: newMessage });
  } catch (err: any) {
    console.error('[SupportRoutes] Admin reply error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to send admin reply.' });
  }
});

/**
 * PATCH /api/admin/support/tickets/:publicTicketId/status
 * Admin updates support ticket status or priority.
 */
router.patch('/admin/tickets/:publicTicketId/status', requireAuth, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { publicTicketId } = req.params;
    const { status, priority } = req.body;

    if (!status) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Status is required.' });
      return;
    }

    const updatedTicket = await updateTicketStatus({ publicTicketId, status, priority });
    res.json({ success: true, ticket: updatedTicket });
  } catch (err: any) {
    console.error('[SupportRoutes] Admin status update error:', err);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to update ticket status.' });
  }
});

export default router;
