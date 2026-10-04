import { getDb, DatabaseClient } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { notifySupportTicketCreated, notifySupportTicketUpdate } from './notificationService';

export interface SupportTicketRecord {
  id: string;
  publicTicketId: string;
  userId: string;
  userPublicId?: string;
  userEmail?: string;
  userDisplayName?: string;
  category: string;
  subject: string;
  userMessage: string;
  supportSummary: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  relatedEntityType: string | null;
  relatedPublicReference: string | null;
  automatedDiagnosisSummary: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  messageCount?: number;
  latestMessageSnippet?: string;
}

export interface SupportMessageRecord {
  id: string;
  ticketId: string;
  senderType: 'USER' | 'SUPPORT' | 'ADMIN';
  senderUserId: string | null;
  senderPublicName: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface SupportUserLiveData {
  user: {
    publicId: string;
    email: string;
    displayName: string;
    status: string;
    createdAt: string;
  };
  balances: {
    availableDepositBalanceUsd: number;
    phivoCoinBalance: number;
    pendingWithdrawalTotalUsd: number;
  };
  withdrawals: Array<{
    publicWithdrawalId: string;
    amount: number;
    status: string;
    destinationType: string;
    requestedAt: string;
    txHash: string | null;
  }>;
  deposits: Array<{
    publicDepositId: string;
    amount: number;
    status: string;
    requestedAt: string;
  }>;
  nodes: {
    activeNodeCount: number;
    totalLifetimePhivoAllocation: number;
    distributedPhivo: number;
    remainingPhivo: number;
  };
  openTickets: Array<{
    publicTicketId: string;
    category: string;
    subject: string;
    status: string;
  }>;
}

function generatePublicTicketId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `PHX-SUP-${rand}`;
}

export async function createSupportTicket(params: {
  userId: string;
  category: string;
  subject: string;
  userMessage: string;
  relatedEntityType?: string | null;
  relatedPublicReference?: string | null;
  automatedDiagnosisSummary?: string | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dbClient?: DatabaseClient;
}): Promise<SupportTicketRecord> {
  const db = params.dbClient || (await getDb());
  const ticketId = uuidv4();
  const publicTicketId = generatePublicTicketId();
  const priority = params.priority || 'MEDIUM';
  const category = params.category || 'Other';
  const subject = params.subject || 'PHIVONEX Support Inquiry';

  await db.query(
    `
    INSERT INTO support_tickets (
      id, public_ticket_id, user_id, category, subject, user_message,
      support_summary, status, priority, related_entity_type,
      related_public_reference, automated_diagnosis_summary, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'OPEN', $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
    [
      ticketId,
      publicTicketId,
      params.userId,
      category,
      subject,
      params.userMessage,
      params.userMessage.slice(0, 150),
      priority,
      params.relatedEntityType || null,
      params.relatedPublicReference || null,
      params.automatedDiagnosisSummary || null,
    ]
  );

  // Insert initial user message
  const msgId = uuidv4();
  await db.query(
    `
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_type, sender_user_id, sender_public_name, message, is_internal_note, created_at
    ) VALUES ($1, $2, 'USER', $3, 'User', $4, FALSE, CURRENT_TIMESTAMP)
    `,
    [msgId, ticketId, params.userId, params.userMessage]
  );

  // Notify user
  await notifySupportTicketCreated({
    userId: params.userId,
    publicTicketId,
    subject,
    dbClient: db,
  });

  const fetched = await getTicketByPublicId(publicTicketId, params.userId, false, db);
  return fetched!.ticket;
}

export async function getUserTickets(userId: string): Promise<SupportTicketRecord[]> {
  const db = await getDb();
  const res = await db.query(
    `
    SELECT 
      t.*,
      (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id AND m.is_internal_note = FALSE) as message_count,
      (SELECT message FROM support_ticket_messages m WHERE m.ticket_id = t.id AND m.is_internal_note = FALSE ORDER BY created_at DESC LIMIT 1) as latest_message_snippet
    FROM support_tickets t
    WHERE t.user_id = $1
    ORDER BY t.updated_at DESC
    `,
    [userId]
  );

  return res.rows.map(row => ({
    id: row.id,
    publicTicketId: row.public_ticket_id,
    userId: row.user_id,
    category: row.category,
    subject: row.subject,
    userMessage: row.user_message,
    supportSummary: row.support_summary,
    status: row.status,
    priority: row.priority,
    relatedEntityType: row.related_entity_type,
    relatedPublicReference: row.related_public_reference,
    automatedDiagnosisSummary: row.automated_diagnosis_summary,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    messageCount: Number(row.message_count || 0),
    latestMessageSnippet: row.latest_message_snippet || row.user_message,
  }));
}

export async function getTicketByPublicId(
  publicTicketId: string,
  requestingUserId?: string,
  isAdmin = false,
  dbClient?: DatabaseClient
): Promise<{ ticket: SupportTicketRecord; messages: SupportMessageRecord[] } | null> {
  const db = dbClient || (await getDb());
  const res = await db.query(
    `
    SELECT 
      t.*,
      u.public_id as user_public_id,
      u.email as user_email,
      u.display_name as user_display_name
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    WHERE t.public_ticket_id = $1
    `,
    [publicTicketId.trim().toUpperCase()]
  );

  if (res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];

  // User Data Isolation Guardrail:
  if (requestingUserId && !isAdmin && row.user_id !== requestingUserId) {
    const err: any = new Error('Access denied. You can only view your own support tickets.');
    err.statusCode = 403;
    err.code = 'ACCESS_DENIED';
    throw err;
  }

  // Fetch messages
  const msgQuery = isAdmin
    ? `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 ORDER BY created_at ASC`
    : `SELECT * FROM support_ticket_messages WHERE ticket_id = $1 AND is_internal_note = FALSE ORDER BY created_at ASC`;

  const msgRes = await db.query(msgQuery, [row.id]);

  const ticket: SupportTicketRecord = {
    id: row.id,
    publicTicketId: row.public_ticket_id,
    userId: row.user_id,
    userPublicId: row.user_public_id,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    category: row.category,
    subject: row.subject,
    userMessage: row.user_message,
    supportSummary: row.support_summary,
    status: row.status,
    priority: row.priority,
    relatedEntityType: row.related_entity_type,
    relatedPublicReference: row.related_public_reference,
    automatedDiagnosisSummary: row.automated_diagnosis_summary,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
  };

  const messages: SupportMessageRecord[] = msgRes.rows.map(m => ({
    id: m.id,
    ticketId: m.ticket_id,
    senderType: m.sender_type,
    senderUserId: m.sender_user_id,
    senderPublicName: m.sender_public_name,
    message: m.message,
    isInternalNote: m.is_internal_note,
    createdAt: new Date(m.created_at).toISOString(),
  }));

  return { ticket, messages };
}

export async function addTicketMessage(params: {
  publicTicketId: string;
  senderType: 'USER' | 'SUPPORT' | 'ADMIN';
  senderUserId?: string | null;
  senderPublicName: string;
  message: string;
  isInternalNote?: boolean;
  dbClient?: DatabaseClient;
}): Promise<SupportMessageRecord> {
  const db = params.dbClient || (await getDb());
  const ticketData = await getTicketByPublicId(params.publicTicketId, undefined, true, db);
  if (!ticketData) {
    const err: any = new Error(`Support ticket ${params.publicTicketId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const { ticket } = ticketData;
  const msgId = uuidv4();
  const isInternal = params.isInternalNote || false;

  await db.query(
    `
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_type, sender_user_id, sender_public_name, message, is_internal_note, created_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
    `,
    [
      msgId,
      ticket.id,
      params.senderType,
      params.senderUserId || null,
      params.senderPublicName,
      params.message,
      isInternal,
    ]
  );

  // Update ticket timestamp & status if user replied while WAITING_FOR_USER
  let newStatus = ticket.status;
  if (params.senderType === 'USER' && ticket.status === 'WAITING_FOR_USER') {
    newStatus = 'OPEN';
  } else if (params.senderType === 'ADMIN' && !isInternal && ticket.status === 'OPEN') {
    newStatus = 'IN_PROGRESS';
  }

  await db.query(
    `UPDATE support_tickets SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [newStatus, ticket.id]
  );

  // Notify user if admin/support replied
  if ((params.senderType === 'ADMIN' || params.senderType === 'SUPPORT') && !isInternal) {
    await notifySupportTicketUpdate({
      userId: ticket.userId,
      publicTicketId: ticket.publicTicketId,
      status: newStatus,
      messageSnippet: params.message.slice(0, 100),
      dbClient: db,
    });
  }

  const msgRes = await db.query(`SELECT * FROM support_ticket_messages WHERE id = $1`, [msgId]);
  const m = msgRes.rows[0];

  return {
    id: m.id,
    ticketId: m.ticket_id,
    senderType: m.sender_type,
    senderUserId: m.sender_user_id,
    senderPublicName: m.sender_public_name,
    message: m.message,
    isInternalNote: m.is_internal_note,
    createdAt: new Date(m.created_at).toISOString(),
  };
}

export async function updateTicketStatus(params: {
  publicTicketId: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'WAITING_FOR_USER' | 'RESOLVED' | 'CLOSED' | 'ESCALATED';
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dbClient?: DatabaseClient;
}): Promise<SupportTicketRecord> {
  const db = params.dbClient || (await getDb());
  const ticketData = await getTicketByPublicId(params.publicTicketId, undefined, true, db);
  if (!ticketData) {
    const err: any = new Error(`Support ticket ${params.publicTicketId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const { ticket } = ticketData;
  const isResolving = params.status === 'RESOLVED' || params.status === 'CLOSED';
  const newPriority = params.priority || ticket.priority;

  await db.query(
    `
    UPDATE support_tickets
    SET 
      status = $1,
      priority = $2,
      updated_at = CURRENT_TIMESTAMP,
      resolved_at = CASE WHEN $3 = TRUE THEN CURRENT_TIMESTAMP ELSE resolved_at END
    WHERE id = $4
    `,
    [params.status, newPriority, isResolving, ticket.id]
  );

  await notifySupportTicketUpdate({
    userId: ticket.userId,
    publicTicketId: ticket.publicTicketId,
    status: params.status,
    messageSnippet: `Ticket status updated to ${params.status}`,
    dbClient: db,
  });

  const updated = await getTicketByPublicId(params.publicTicketId, undefined, true, db);
  return updated!.ticket;
}

export async function getAdminTickets(filters?: {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const db = await getDb();
  const page = Math.max(1, filters?.page || 1);
  const limit = Math.min(100, Math.max(1, filters?.limit || 20));
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];

  if (filters?.status && filters.status !== 'ALL') {
    params.push(filters.status.toUpperCase());
    conditions.push(`t.status = $${params.length}`);
  }

  if (filters?.category && filters.category !== 'ALL') {
    params.push(filters.category);
    conditions.push(`t.category = $${params.length}`);
  }

  if (filters?.search && filters.search.trim() !== '') {
    params.push(`%${filters.search.trim()}%`);
    const pIdx = params.length;
    conditions.push(`(t.public_ticket_id ILIKE $${pIdx} OR t.subject ILIKE $${pIdx} OR u.email ILIKE $${pIdx} OR u.public_id ILIKE $${pIdx})`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total stats
  const statsRes = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'OPEN') as open_count,
      COUNT(*) FILTER (WHERE status = 'IN_PROGRESS') as in_progress_count,
      COUNT(*) FILTER (WHERE status = 'WAITING_FOR_USER') as waiting_count,
      COUNT(*) FILTER (WHERE status = 'RESOLVED' OR status = 'CLOSED') as resolved_count,
      COUNT(*) as total_count
    FROM support_tickets
  `);

  const stats = {
    openCount: Number(statsRes.rows[0]?.open_count || 0),
    inProgressCount: Number(statsRes.rows[0]?.in_progress_count || 0),
    waitingCount: Number(statsRes.rows[0]?.waiting_count || 0),
    resolvedCount: Number(statsRes.rows[0]?.resolved_count || 0),
    totalCount: Number(statsRes.rows[0]?.total_count || 0),
  };

  const ticketsQuery = `
    SELECT 
      t.*,
      u.public_id as user_public_id,
      u.email as user_email,
      u.display_name as user_display_name,
      (SELECT COUNT(*) FROM support_ticket_messages m WHERE m.ticket_id = t.id) as message_count,
      (SELECT message FROM support_ticket_messages m WHERE m.ticket_id = t.id ORDER BY created_at DESC LIMIT 1) as latest_message_snippet
    FROM support_tickets t
    JOIN users u ON u.id = t.user_id
    ${whereClause}
    ORDER BY t.updated_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;

  const queryParams = [...params, limit, offset];
  const res = await db.query(ticketsQuery, queryParams);

  const tickets: SupportTicketRecord[] = res.rows.map(row => ({
    id: row.id,
    publicTicketId: row.public_ticket_id,
    userId: row.user_id,
    userPublicId: row.user_public_id,
    userEmail: row.user_email,
    userDisplayName: row.user_display_name,
    category: row.category,
    subject: row.subject,
    userMessage: row.user_message,
    supportSummary: row.support_summary,
    status: row.status,
    priority: row.priority,
    relatedEntityType: row.related_entity_type,
    relatedPublicReference: row.related_public_reference,
    automatedDiagnosisSummary: row.automated_diagnosis_summary,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    messageCount: Number(row.message_count || 0),
    latestMessageSnippet: row.latest_message_snippet || row.user_message,
  }));

  return { tickets, stats, page, limit };
}

/**
 * Fetches safe live user data for support context.
 * STRICTLY NO PASSWORDS, NO SECRETS, NO PRIVATE KEYS, NO OTHER USER DATA.
 */
export async function getUserLiveDataForSupport(userId: string): Promise<SupportUserLiveData> {
  const db = await getDb();

  // User profile
  const uRes = await db.query(`SELECT public_id, email, display_name, status, created_at FROM users WHERE id = $1`, [userId]);
  if (uRes.rows.length === 0) {
    throw new Error(`User ${userId} not found`);
  }
  const u = uRes.rows[0];

  // Balances
  const balRes = await db.query(
    `SELECT available_deposit_balance_usd, phivo_coin_balance, pending_withdrawal_total_usd FROM user_balances WHERE user_id = $1`,
    [userId]
  );
  const bal = balRes.rows[0] || { available_deposit_balance_usd: 0, phivo_coin_balance: 0, pending_withdrawal_total_usd: 0 };

  // Withdrawals (last 5)
  const wRes = await db.query(
    `
    SELECT public_withdrawal_id, amount, status, destination_type, requested_at, tx_hash
    FROM withdrawals
    WHERE user_id = $1
    ORDER BY requested_at DESC LIMIT 5
    `,
    [userId]
  );

  // Deposits (last 5)
  const dRes = await db.query(
    `
    SELECT public_deposit_id, amount, status, requested_at
    FROM deposit_requests
    WHERE user_id = $1
    ORDER BY requested_at DESC LIMIT 5
    `,
    [userId]
  );

  // Active Nodes
  const nRes = await db.query(
    `
    SELECT 
      COUNT(*) as active_count,
      COALESCE(SUM(lifetime_phivo_allocation), 0) as total_alloc,
      COALESCE(SUM(distributed_phivo), 0) as total_dist,
      COALESCE(SUM(remaining_phivo), 0) as total_rem
    FROM nodes
    WHERE owner_user_id = $1 AND status IN ('ACTIVE', 'EMITTING')
    `,
    [userId]
  );
  const n = nRes.rows[0] || { active_count: 0, total_alloc: 0, total_dist: 0, total_rem: 0 };

  // Open tickets
  const tRes = await db.query(
    `
    SELECT public_ticket_id, category, subject, status
    FROM support_tickets
    WHERE user_id = $1 AND status IN ('OPEN', 'IN_PROGRESS', 'WAITING_FOR_USER', 'ESCALATED')
    ORDER BY updated_at DESC LIMIT 5
    `,
    [userId]
  );

  return {
    user: {
      publicId: u.public_id,
      email: u.email,
      displayName: u.display_name || u.email,
      status: u.status,
      createdAt: new Date(u.created_at).toISOString(),
    },
    balances: {
      availableDepositBalanceUsd: Number(bal.available_deposit_balance_usd || 0),
      phivoCoinBalance: Number(bal.phivo_coin_balance || 0),
      pendingWithdrawalTotalUsd: Number(bal.pending_withdrawal_total_usd || 0),
    },
    withdrawals: wRes.rows.map(w => ({
      publicWithdrawalId: w.public_withdrawal_id,
      amount: Number(w.amount),
      status: w.status,
      destinationType: w.destination_type,
      requestedAt: new Date(w.requested_at).toISOString(),
      txHash: w.tx_hash || null,
    })),
    deposits: dRes.rows.map(d => ({
      publicDepositId: d.public_deposit_id,
      amount: Number(d.amount),
      status: d.status,
      requestedAt: new Date(d.requested_at).toISOString(),
    })),
    nodes: {
      activeNodeCount: Number(n.active_count || 0),
      totalLifetimePhivoAllocation: Number(n.total_alloc || 0),
      distributedPhivo: Number(n.total_dist || 0),
      remainingPhivo: Number(n.total_rem || 0),
    },
    openTickets: tRes.rows.map(t => ({
      publicTicketId: t.public_ticket_id,
      category: t.category,
      subject: t.subject,
      status: t.status,
    })),
  };
}
