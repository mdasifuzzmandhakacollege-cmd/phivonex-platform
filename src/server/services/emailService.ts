import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/db';
import { logAdminAction } from './adminService';

// Provider Interface
export interface EmailProvider {
  sendEmail(to: string, subject: string, html: string): Promise<{ providerMessageId?: string; error?: string }>;
}

// 1. Mock Email Provider
export class MockEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, html: string): Promise<{ providerMessageId: string }> {
    console.log(`[MockEmailProvider] Sending email to ${to}: "${subject}"`);
    return { providerMessageId: `mock_msg_${uuidv4()}` };
  }
}

// 2. Resend Email Provider
export class ResendEmailProvider implements EmailProvider {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(to: string, subject: string, html: string): Promise<{ providerMessageId?: string; error?: string }> {
    try {
      const defaultDomain = process.env.RESEND_DOMAIN || process.env.CUSTOM_DOMAIN || 'phivonex.com';
      const fromAddress = process.env.EMAIL_FROM_ADDRESS || `support@${defaultDomain}`;
      const fromName = process.env.EMAIL_FROM_NAME || 'PHIVONEX';
      const from = `${fromName} <${fromAddress}>`;

      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          from,
          to,
          subject,
          html
        })
      });

      const data = await response.json();
      if (!response.ok) {
        console.warn('[Resend Provider] API response error:', data);
        return { error: data.message || data.error || 'Resend provider error' };
      }

      console.log(`[Resend Provider] Live email sent successfully to ${to} from ${from}, ID: ${data.id}`);
      return { providerMessageId: data.id };
    } catch (err: any) {
      console.warn('[Resend Provider] Network error communicating with Resend:', err);
      return { error: err.message || 'Network error communicating with Resend' };
    }
  }
}

// Instantiate Provider (Uses Resend whenever RESEND_API_KEY is provided)
export function getEmailProvider(): EmailProvider {
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && apiKey.trim() !== '' && !apiKey.includes('your_resend_api_key')) {
    return new ResendEmailProvider(apiKey.trim());
  }
  return new MockEmailProvider();
}

// Types
export interface EmailTemplate {
  id: string;
  eventName: string;
  subject: string;
  bodyHtml: string;
  enabled: boolean;
  createdAt: string;
}

export interface EmailQueueItem {
  id: string;
  toEmail: string;
  subject: string;
  bodyHtml: string;
  status: 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
  providerMessageId?: string;
  errorMessage?: string;
  sentAt?: string;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  triggerCriteria: 'STRONG_GROWTH' | 'MATCHING_ACTIVITY' | 'NODE_SALES' | 'MILESTONE_PROGRESS' | 'INACTIVITY';
  delayHours: number;
  cooldownDays: number;
  templateId: string;
  createdAt: string;
}

// ----------------------------------------------------------------------------
// EMAIL QUEUE & EVENTS ENGINE
// ----------------------------------------------------------------------------

/**
 * Queue a new system event email.
 * Renders template variables automatically.
 */
export async function queueEventEmail(
  toEmail: string,
  eventName: string,
  templateData: Record<string, string>,
  scheduledSendAt?: Date
): Promise<string> {
  const db = await getDb();

  // 1. Fetch template
  const templateRes = await db.query(
    `SELECT * FROM email_templates WHERE event_name = $1 AND enabled = TRUE`,
    [eventName]
  );

  if (templateRes.rows.length === 0) {
    console.warn(`[EmailEngine] Template for event "${eventName}" is disabled or not found. Skipping.`);
    return '';
  }

  const template = templateRes.rows[0];
  let subject = template.subject;
  let bodyHtml = template.body_html;

  // Replace placeholders dynamically
  for (const [key, val] of Object.entries(templateData)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    subject = subject.replace(regex, val);
    bodyHtml = bodyHtml.replace(regex, val);
  }

  const queueId = uuidv4();
  await db.query(
    `
    INSERT INTO email_queue (id, to_email, subject, body_html, status, scheduled_send_at)
    VALUES ($1, $2, $3, $4, 'QUEUED', $5)
    `,
    [queueId, toEmail, subject, bodyHtml, scheduledSendAt || null]
  );

  // Trigger non-blocking async execution
  processEmailQueue().catch(err => {
    console.error('[EmailEngine] Immediate processEmailQueue error:', err);
  });

  return queueId;
}

/**
 * Process all pending emails in the queue
 */
export async function processEmailQueue(): Promise<void> {
  const db = await getDb();

  // Find all queued messages that are scheduled for now or earlier (or not scheduled)
  const res = await db.query(
    `SELECT * FROM email_queue 
     WHERE status = 'QUEUED' AND (scheduled_send_at IS NULL OR scheduled_send_at <= CURRENT_TIMESTAMP) 
     ORDER BY created_at ASC`
  );

  if (res.rows.length === 0) {
    return;
  }

  const provider = getEmailProvider();

  for (const row of res.rows) {
    try {
      const sendRes = await provider.sendEmail(row.to_email, row.subject, row.body_html);
      
      if (sendRes.error) {
        await db.query(
          `
          UPDATE email_queue
          SET status = 'FAILED', error_message = $1, sent_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [sendRes.error, row.id]
        );
      } else {
        await db.query(
          `
          UPDATE email_queue
          SET status = 'SENT', provider_message_id = $1, sent_at = CURRENT_TIMESTAMP
          WHERE id = $2
          `,
          [sendRes.providerMessageId || null, row.id]
        );
      }
    } catch (err: any) {
      await db.query(
        `
        UPDATE email_queue
        SET status = 'FAILED', error_message = $1, sent_at = CURRENT_TIMESTAMP
        WHERE id = $2
        `,
        [err.message || 'Unknown processing error', row.id]
      );
    }
  }
}

// ----------------------------------------------------------------------------
// AUTOMATED PERFORMANCE FOLLOW-UP ENGINE
// ----------------------------------------------------------------------------

/**
 * Trigger an automation rule check for a user.
 * Enforces delay and cooldown limits.
 */
export async function triggerAutomationRule(
  userId: string,
  criteria: 'STRONG_GROWTH' | 'MATCHING_ACTIVITY' | 'NODE_SALES' | 'MILESTONE_PROGRESS' | 'INACTIVITY',
  templateData: Record<string, string>
): Promise<boolean> {
  const db = await getDb();

  // 1. Fetch active rules for this criteria
  const rulesRes = await db.query(
    `SELECT * FROM automation_rules WHERE trigger_criteria = $1 AND enabled = TRUE`,
    [criteria]
  );

  if (rulesRes.rows.length === 0) {
    return false;
  }

  // Fetch user info
  const userRes = await db.query(`SELECT email, public_id, full_name FROM users WHERE id = $1`, [userId]);
  if (userRes.rows.length === 0) {
    return false;
  }
  const user = userRes.rows[0];

  let triggeredAny = false;

  for (const rule of rulesRes.rows) {
    // 2. Cooldown check
    const cooldownRes = await db.query(
      `SELECT last_triggered_at FROM automation_cooldowns WHERE user_id = $1 AND rule_id = $2`,
      [userId, rule.id]
    );

    if (cooldownRes.rows.length > 0) {
      const lastTriggered = new Date(cooldownRes.rows[0].last_triggered_at);
      const cooldownMs = rule.cooldown_days * 24 * 60 * 60 * 1000;
      if (Date.now() - lastTriggered.getTime() < cooldownMs) {
        console.log(`[AutomationEngine] Cooldown active for user ${userId} on rule ${rule.id}. Skipping.`);
        continue;
      }
    }

    // 3. Trigger & Queue email
    const templateRes = await db.query(`SELECT event_name FROM email_templates WHERE id = $1`, [rule.template_id]);
    if (templateRes.rows.length === 0) {
      continue;
    }

    const eventName = templateRes.rows[0].event_name;
    const mergedData = {
      displayName: user.full_name,
      publicId: user.public_id,
      ...templateData
    };

    // Calculate delay hour offset
    const scheduledSendAt = rule.delay_hours > 0 
      ? new Date(Date.now() + rule.delay_hours * 60 * 60 * 1000)
      : undefined;

    await queueEventEmail(user.email, eventName, mergedData, scheduledSendAt);

    // 4. Update Cooldown record
    await db.query(
      `
      INSERT INTO automation_cooldowns (id, user_id, rule_id, last_triggered_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, rule_id) 
      DO UPDATE SET last_triggered_at = CURRENT_TIMESTAMP
      `,
      [uuidv4(), userId, rule.id]
    );

    triggeredAny = true;
  }

  return triggeredAny;
}

// ----------------------------------------------------------------------------
// TEMPLATES CRUD & BROADCAST CAMPAIGNS
// ----------------------------------------------------------------------------

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM email_templates ORDER BY event_name ASC`);
  return res.rows.map(r => ({
    id: r.id,
    eventName: r.event_name,
    subject: r.subject,
    bodyHtml: r.body_html,
    enabled: r.enabled,
    createdAt: r.created_at
  }));
}

export async function updateEmailTemplate(
  adminUserId: string,
  adminPublicId: string,
  id: string,
  template: { subject: string; bodyHtml: string; enabled: boolean }
): Promise<EmailTemplate> {
  const db = await getDb();

  const oldRes = await db.query(`SELECT * FROM email_templates WHERE id = $1`, [id]);
  if (oldRes.rows.length === 0) {
    throw new Error('Template not found');
  }

  await db.query(
    `
    UPDATE email_templates
    SET subject = $1, body_html = $2, enabled = $3
    WHERE id = $4
    `,
    [template.subject, template.bodyHtml, template.enabled, id]
  );

  const updated: EmailTemplate = {
    id,
    eventName: oldRes.rows[0].event_name,
    subject: template.subject,
    bodyHtml: template.bodyHtml,
    enabled: template.enabled,
    createdAt: oldRes.rows[0].created_at
  };

  await logAdminAction({
    adminUserId,
    adminPublicId,
    action: 'UPDATE_EMAIL_TEMPLATE',
    targetType: 'email_templates',
    targetId: id,
    details: `Updated email template for event "${updated.eventName}"`
  });

  return updated;
}

export async function sendBroadcastCampaign(
  adminUserId: string,
  adminPublicId: string,
  campaign: {
    subject: string;
    bodyHtml: string;
    audience: 'ALL' | 'ACTIVE_USERS' | 'NODE_HOLDERS';
  }
): Promise<{ queuedCount: number }> {
  const db = await getDb();

  let userQuery = `SELECT email, full_name, public_id FROM users WHERE status = 'ACTIVE'`;
  if (campaign.audience === 'ACTIVE_USERS') {
    userQuery = `SELECT email, full_name, public_id FROM users WHERE status = 'ACTIVE'`;
  } else if (campaign.audience === 'NODE_HOLDERS') {
    userQuery = `
      SELECT DISTINCT u.email, u.full_name, u.public_id 
      FROM users u
      INNER JOIN node_orders o ON u.id = o.user_id
      WHERE o.status = 'COMPLETED'
    `;
  }

  const usersRes = await db.query<any>(userQuery);
  let queuedCount = 0;

  for (const user of usersRes.rows) {
    let subject = campaign.subject;
    let bodyHtml = campaign.bodyHtml;

    // Render basic user context variables
    subject = subject.replace(/{{displayName}}/g, user.full_name).replace(/{{publicId}}/g, user.public_id);
    bodyHtml = bodyHtml.replace(/{{displayName}}/g, user.full_name).replace(/{{publicId}}/g, user.public_id);

    const queueId = uuidv4();
    await db.query(
      `
      INSERT INTO email_queue (id, to_email, subject, body_html, status)
      VALUES ($1, $2, $3, $4, 'QUEUED')
      `,
      [queueId, user.email, subject, bodyHtml]
    );
    queuedCount++;
  }

  // Trigger immediate async processing
  processEmailQueue().catch(err => {
    console.error('[EmailEngine] Campaign queue processing error:', err);
  });

  await logAdminAction({
    adminUserId,
    adminPublicId,
    action: 'SEND_EMAIL_CAMPAIGN',
    targetType: 'email_queue',
    targetId: 'broadcast_campaign',
    details: `Broadcast campaign "${campaign.subject}" sent to ${queuedCount} users of audience: "${campaign.audience}"`
  });

  return { queuedCount };
}

// ----------------------------------------------------------------------------
// AUTOMATION RULES CRUD
// ----------------------------------------------------------------------------

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const db = await getDb();
  const res = await db.query(`SELECT * FROM automation_rules ORDER BY created_at DESC`);
  return res.rows.map(r => ({
    id: r.id,
    name: r.name,
    enabled: r.enabled,
    triggerCriteria: r.trigger_criteria,
    delayHours: r.delay_hours,
    cooldownDays: r.cooldown_days,
    templateId: r.template_id,
    createdAt: r.created_at
  }));
}

export async function createAutomationRule(
  adminUserId: string,
  adminPublicId: string,
  rule: Omit<AutomationRule, 'id' | 'createdAt'>
): Promise<AutomationRule> {
  const db = await getDb();
  const id = uuidv4();

  await db.query(
    `
    INSERT INTO automation_rules (id, name, enabled, trigger_criteria, delay_hours, cooldown_days, template_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    `,
    [id, rule.name, rule.enabled, rule.triggerCriteria, rule.delayHours, rule.cooldownDays, rule.templateId]
  );

  const created: AutomationRule = {
    id,
    ...rule,
    createdAt: new Date().toISOString()
  };

  await logAdminAction({
    adminUserId,
    adminPublicId,
    action: 'CREATE_AUTOMATION_RULE',
    targetType: 'automation_rules',
    targetId: id,
    details: `Created automation rule: "${rule.name}"`
  });

  return created;
}

export async function updateAutomationRule(
  adminUserId: string,
  adminPublicId: string,
  id: string,
  rule: Omit<AutomationRule, 'id' | 'createdAt'>
): Promise<AutomationRule> {
  const db = await getDb();

  const oldRes = await db.query(`SELECT * FROM automation_rules WHERE id = $1`, [id]);
  if (oldRes.rows.length === 0) {
    throw new Error('Rule not found');
  }

  await db.query(
    `
    UPDATE automation_rules
    SET name = $1, enabled = $2, trigger_criteria = $3, delay_hours = $4, cooldown_days = $5, template_id = $6
    WHERE id = $7
    `,
    [rule.name, rule.enabled, rule.triggerCriteria, rule.delayHours, rule.cooldownDays, rule.templateId, id]
  );

  const updated: AutomationRule = {
    id,
    ...rule,
    createdAt: oldRes.rows[0].created_at
  };

  await logAdminAction({
    adminUserId,
    adminPublicId,
    action: 'UPDATE_AUTOMATION_RULE',
    targetType: 'automation_rules',
    targetId: id,
    details: `Updated automation rule: "${rule.name}"`
  });

  return updated;
}

export async function deleteAutomationRule(
  adminUserId: string,
  adminPublicId: string,
  id: string
): Promise<boolean> {
  const db = await getDb();

  const oldRes = await db.query(`SELECT name FROM automation_rules WHERE id = $1`, [id]);
  if (oldRes.rows.length === 0) {
    return false;
  }

  await db.query(`DELETE FROM automation_rules WHERE id = $1`, [id]);

  await logAdminAction({
    adminUserId,
    adminPublicId,
    action: 'DELETE_AUTOMATION_RULE',
    targetType: 'automation_rules',
    targetId: id,
    details: `Deleted automation rule: "${oldRes.rows[0].name}"`
  });

  return true;
}

// ----------------------------------------------------------------------------
// PROVIDER WEBHOOK
// ----------------------------------------------------------------------------

/**
 * Handle incoming provider events (bounces, deliveries, failures)
 */
export async function handleProviderEmailWebhook(
  providerMessageId: string,
  status: 'delivered' | 'bounced' | 'failed',
  errorReason?: string
): Promise<boolean> {
  const db = await getDb();

  const mappedStatus = 
    status === 'delivered' ? 'DELIVERED' :
    status === 'bounced' ? 'FAILED' : 'FAILED';

  const res = await db.query(
    `
    UPDATE email_queue
    SET status = $1, error_message = $2
    WHERE provider_message_id = $3
    `,
    [mappedStatus, errorReason || (status === 'bounced' ? 'Email Bounced' : null), providerMessageId]
  );

  return res.rowCount > 0;
}

/**
 * Sends a premium PHIVONEX HTML email containing a 6-digit registration verification code.
 */
export async function sendVerificationCodeEmail(toEmail: string, code: string): Promise<boolean> {
  const provider = getEmailProvider();
  const subject = 'Verify your PHIVONEX account';
  const html = `
    <div style="background-color: #05070c; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; padding: 40px 15px; margin: 0; width: 100%;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 620px; margin: 0 auto; background-color: #0b1329; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 207, 255, 0.08);">
        <tr>
          <td style="background: linear-gradient(135deg, #0f172a 0%, #070d1e 100%); padding: 32px 30px; border-bottom: 1px solid rgba(0, 207, 255, 0.2); text-align: center;">
            <div style="font-size: 26px; font-weight: 900; letter-spacing: 4px; color: #ffffff; font-family: monospace;">PHIVONEX</div>
            <div style="font-size: 10px; font-weight: 700; letter-spacing: 2px; color: #00CFFF; margin-top: 6px; text-transform: uppercase;">DECENTRALIZED AUTONOMOUS NODE INFRASTRUCTURE</div>
          </td>
        </tr>
        <tr>
          <td style="padding: 35px 30px; text-align: center;">
            <div style="display: inline-block; padding: 6px 14px; background: rgba(0, 207, 255, 0.12); border: 1px solid rgba(0, 207, 255, 0.3); border-radius: 20px; font-size: 11px; font-weight: 700; color: #00CFFF; font-family: monospace; text-transform: uppercase; margin-bottom: 20px;">
              ACCOUNT AUTHENTICATION
            </div>
            <h1 style="font-size: 22px; font-weight: 800; color: #ffffff; margin: 0 0 14px 0; line-height: 1.3;">Verify Your Email Address</h1>
            <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; max-width: 480px; margin: 0 auto 25px auto;">
              Welcome to PHIVONEX. Use the 6-digit cryptographic verification code below to complete your secure account registration. This code expires in 10 minutes.
            </p>
            <div style="background: rgba(0, 207, 255, 0.08); border: 1px solid rgba(0, 207, 255, 0.3); border-radius: 12px; padding: 18px 30px; display: inline-block; font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #00CFFF; font-family: monospace; margin-bottom: 30px; box-shadow: 0 0 25px rgba(0, 207, 255, 0.2);">
              ${code}
            </div>
            <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 20px; max-width: 480px; margin: 0 auto; text-align: left; font-size: 11px; color: #64748b; line-height: 1.5;">
              <p style="margin-bottom: 6px;"><strong>Security Note:</strong> Never share this verification code with anyone. PHIVONEX administrators will never request your OTP.</p>
              <p style="margin: 0;">If you did not initiate this request, please ignore this transmission.</p>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background-color: #070c1a; padding: 20px 30px; border-top: 1px solid rgba(255, 255, 255, 0.06); font-size: 11px; color: #475569; line-height: 1.5; text-align: center;">
            <p style="margin: 0 0 4px 0; font-family: monospace; color: #64748b;">PHIVONEX Security Matrix • 256-Bit Cryptographic Authorization</p>
            <p style="margin: 0;">Automated Authentication Transmission.</p>
          </td>
        </tr>
      </table>
    </div>
  `;
  const result = await provider.sendEmail(toEmail, subject, html);
  if (result.error) {
    console.warn(`[EmailService] Failed to send verification email to ${toEmail}:`, result.error);
  } else {
    console.log(`[EmailService] Verification code email sent to ${toEmail}`);
  }
  return !result.error;
}
