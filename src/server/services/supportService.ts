import { getDb, DatabaseClient } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { notifySupportTicketCreated, notifySupportTicketUpdate } from './notificationService';

export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketCategory = 'GENERAL' | 'DEPOSIT' | 'WITHDRAWAL' | 'NODE' | 'TECHNICAL' | 'SECURITY';

export interface SupportTicket {
  id: string;
  publicTicketId: string;
  userId: string;
  userEmail?: string;
  userFullName?: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assignedAdminId: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: SupportTicketMessage[];
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderRole: 'USER' | 'ADMIN';
  senderName?: string;
  message: string;
  createdAt: string;
}

function generateTicketPublicId(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let rand = '';
  for (let i = 0; i < 6; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `TCK-${rand}`;
}

/**
 * Creates a new support ticket and sends a confirmation notification.
 */
export async function createSupportTicket(params: {
  userId: string;
  subject: string;
  message: string;
  category?: TicketCategory;
  priority?: TicketPriority;
  dbClient?: DatabaseClient;
}): Promise<SupportTicket> {
  const { userId, subject, message, category = 'GENERAL', priority = 'MEDIUM', dbClient } = params;
  const db = dbClient || (await getDb());

  const ticketId = uuidv4();
  const publicTicketId = generateTicketPublicId();
  const now = new Date();

  // Create ticket
  await db.query(
    `
    INSERT INTO support_tickets (
      id, public_ticket_id, user_id, subject, category, priority, status, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, 'OPEN', $7, $7)
    `,
    [ticketId, publicTicketId, userId, subject.trim(), category, priority, now]
  );

  // Add initial message
  const messageId = uuidv4();
  await db.query(
    `
    INSERT INTO support_ticket_messages (
      id, ticket_id, sender_id, sender_role, message, created_at
    )
    VALUES ($1, $2, $3, 'USER', $4, $5)
    `,
    [messageId, ticketId, userId, message.trim(), now]
  );

  // Trigger notification
  try {
    await notifySupportTicketCreated({
      userId,
      ticketId,
      ticketPublicId: publicTicketId,
      subject,
      dbClient,
    });
  } catch (err) {
    console.warn('[SupportService] Failed to send ticket creation notification:', err);
  }

  return {
    id: ticketId,
    publicTicketId,
    userId,
    subject,
    category,
    priority,
    status: 'OPEN',
    assignedAdminId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    messages: [
      {
        id: messageId,
        ticketId,
        senderId: userId,
        senderRole: 'USER',
        message,
        createdAt: now.toISOString(),
      },
    ],
  };
}

/**
 * Get all tickets for a specific user.
 */
export async function getUserSupportTickets(userId: string): Promise<SupportTicket[]> {
  const db = await getDb();
  const ticketsRes = await db.query<{
    id: string;
    public_ticket_id: string;
    user_id: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assigned_admin_id: string | null;
    created_at: Date;
    updated_at: Date;
  }>(
    `
    SELECT id, public_ticket_id, user_id, subject, category, priority, status, assigned_admin_id, created_at, updated_at
    FROM support_tickets
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  return ticketsRes.rows.map((row) => ({
    id: row.id,
    publicTicketId: row.public_ticket_id,
    userId: row.user_id,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedAdminId: row.assigned_admin_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

/**
 * Get ticket details with all messages.
 */
export async function getSupportTicketDetails(ticketIdentifier: string, userId?: string): Promise<SupportTicket | null> {
  const db = await getDb();
  const ticketRes = await db.query<{
    id: string;
    public_ticket_id: string;
    user_id: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assigned_admin_id: string | null;
    created_at: Date;
    updated_at: Date;
    user_email?: string;
    user_full_name?: string;
  }>(
    `
    SELECT t.id, t.public_ticket_id, t.user_id, t.subject, t.category, t.priority, t.status, 
           t.assigned_admin_id, t.created_at, t.updated_at,
           u.email AS user_email, u.full_name AS user_full_name
    FROM support_tickets t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE (t.id::text = $1 OR t.public_ticket_id = $1)
    ${userId ? 'AND t.user_id = $2' : ''}
    LIMIT 1
    `,
    userId ? [ticketIdentifier, userId] : [ticketIdentifier]
  );

  if (ticketRes.rows.length === 0) return null;
  const t = ticketRes.rows[0];

  const messagesRes = await db.query<{
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_role: 'USER' | 'ADMIN';
    message: string;
    created_at: Date;
    sender_name?: string;
  }>(
    `
    SELECT m.id, m.ticket_id, m.sender_id, m.sender_role, m.message, m.created_at,
           COALESCE(u.full_name, u.email, 'Admin') AS sender_name
    FROM support_ticket_messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.ticket_id = $1
    ORDER BY m.created_at ASC
    `,
    [t.id]
  );

  return {
    id: t.id,
    publicTicketId: t.public_ticket_id,
    userId: t.user_id,
    userEmail: t.user_email,
    userFullName: t.user_full_name,
    subject: t.subject,
    category: t.category,
    priority: t.priority,
    status: t.status,
    assignedAdminId: t.assigned_admin_id,
    createdAt: new Date(t.created_at).toISOString(),
    updatedAt: new Date(t.updated_at).toISOString(),
    messages: messagesRes.rows.map((m) => ({
      id: m.id,
      ticketId: m.ticket_id,
      senderId: m.sender_id,
      senderRole: m.sender_role,
      senderName: m.sender_name,
      message: m.message,
      createdAt: new Date(m.created_at).toISOString(),
    })),
  };
}

/**
 * Add a reply message to an existing ticket.
 */
export async function addTicketMessage(params: {
  ticketIdentifier: string;
  senderId: string;
  senderRole: 'USER' | 'ADMIN';
  message: string;
}): Promise<SupportTicketMessage> {
  const { ticketIdentifier, senderId, senderRole, message } = params;
  const db = await getDb();

  const ticket = await getSupportTicketDetails(ticketIdentifier);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const messageId = uuidv4();
  const now = new Date();

  await db.query(
    `
    INSERT INTO support_ticket_messages (id, ticket_id, sender_id, sender_role, message, created_at)
    VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [messageId, ticket.id, senderId, senderRole, message.trim(), now]
  );

  // Update ticket updated_at and reopen if closed and replied by user
  const newStatus = senderRole === 'USER' && ticket.status === 'RESOLVED' ? 'OPEN' : ticket.status;
  await db.query(
    `
    UPDATE support_tickets 
    SET updated_at = $1, status = $2
    WHERE id = $3
    `,
    [now, newStatus, ticket.id]
  );

  if (senderRole === 'ADMIN') {
    // Notify the user about admin reply
    try {
      await notifySupportTicketUpdate({
        userId: ticket.userId,
        ticketId: ticket.id,
        ticketPublicId: ticket.publicTicketId,
        subject: ticket.subject,
        status: newStatus,
        message: `Support replied to your ticket "${ticket.subject}" (${ticket.publicTicketId}).`,
      });
    } catch (err) {
      console.warn('[SupportService] Failed to send ticket update notification:', err);
    }
  }

  return {
    id: messageId,
    ticketId: ticket.id,
    senderId,
    senderRole,
    message,
    createdAt: now.toISOString(),
  };
}

/**
 * Admin: Update ticket status (e.g. IN_PROGRESS, RESOLVED, CLOSED).
 */
export async function updateTicketStatus(params: {
  ticketIdentifier: string;
  status: TicketStatus;
  adminId?: string;
}): Promise<SupportTicket> {
  const { ticketIdentifier, status, adminId } = params;
  const db = await getDb();

  const ticket = await getSupportTicketDetails(ticketIdentifier);
  if (!ticket) {
    throw new Error('Ticket not found');
  }

  const now = new Date();
  await db.query(
    `
    UPDATE support_tickets
    SET status = $1, assigned_admin_id = COALESCE($2, assigned_admin_id), updated_at = $3
    WHERE id = $4
    `,
    [status, adminId || null, now, ticket.id]
  );

  try {
    await notifySupportTicketUpdate({
      userId: ticket.userId,
      ticketId: ticket.id,
      ticketPublicId: ticket.publicTicketId,
      subject: ticket.subject,
      status,
      message: `Your support ticket "${ticket.subject}" (${ticket.publicTicketId}) has been marked as ${status}.`,
    });
  } catch (err) {
    console.warn('[SupportService] Failed to notify status change:', err);
  }

  return (await getSupportTicketDetails(ticket.id))!;
}

/**
 * Admin: List all tickets across the platform.
 */
export async function getAllSupportTickets(filters?: {
  status?: TicketStatus;
  category?: TicketCategory;
}): Promise<SupportTicket[]> {
  const db = await getDb();
  let query = `
    SELECT t.id, t.public_ticket_id, t.user_id, t.subject, t.category, t.priority, t.status, 
           t.assigned_admin_id, t.created_at, t.updated_at,
           u.email AS user_email, u.full_name AS user_full_name
    FROM support_tickets t
    LEFT JOIN users u ON t.user_id = u.id
    WHERE 1=1
  `;
  const queryParams: any[] = [];

  if (filters?.status) {
    queryParams.push(filters.status);
    query += ` AND t.status = $${queryParams.length}`;
  }
  if (filters?.category) {
    queryParams.push(filters.category);
    query += ` AND t.category = $${queryParams.length}`;
  }

  query += ` ORDER BY t.updated_at DESC`;

  const res = await db.query<{
    id: string;
    public_ticket_id: string;
    user_id: string;
    subject: string;
    category: TicketCategory;
    priority: TicketPriority;
    status: TicketStatus;
    assigned_admin_id: string | null;
    created_at: Date;
    updated_at: Date;
    user_email?: string;
    user_full_name?: string;
  }>(query, queryParams);

  return res.rows.map((row) => ({
    id: row.id,
    publicTicketId: row.public_ticket_id,
    userId: row.user_id,
    userEmail: row.user_email,
    userFullName: row.user_full_name,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    assignedAdminId: row.assigned_admin_id,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}
