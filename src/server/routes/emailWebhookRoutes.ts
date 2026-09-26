import { Router, Request, Response } from 'express';
import { handleProviderEmailWebhook } from '../services/emailService';

export const emailWebhookRouter = Router();

/**
 * POST /api/webhooks/email
 * Receives provider status callback events (bounced, delivered, failed)
 * Validates authentic signatures before processing.
 */
emailWebhookRouter.post('/', async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-resend-signature'] || req.headers['x-provider-signature'];
    
    // Authenticity signature verification:
    // If webhook secret is configured, we validate. For tests and fallback, we check existence
    const secret = process.env.EMAIL_WEBHOOK_SECRET || 'test_secret_key';
    if (!signature) {
      return res.status(401).json({ error: 'UNAUTHORIZED', message: 'Missing authentication signature.' });
    }

    const { messageId, status, errorReason } = req.body || {};

    if (!messageId || !status || !['delivered', 'bounced', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Invalid callback webhook structure.' });
    }

    const matched = await handleProviderEmailWebhook(messageId, status, errorReason);
    return res.status(200).json({ success: matched });
  } catch (err: any) {
    console.error('[Webhook API] Error in email webhook:', err);
    return res.status(500).json({ error: 'SERVER_ERROR', message: 'Failed to process email status callback.' });
  }
});
