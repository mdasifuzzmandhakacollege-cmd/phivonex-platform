import { GoogleGenAI, Type } from '@google/genai';
import { SupportUserLiveData, createSupportTicket } from './supportService';

export interface SupportEngineResponse {
  responseText: string;
  shouldEscalate: boolean;
  suggestedCategory: string;
  suggestedSubject: string;
  automatedDiagnosis: string;
  createdTicketPublicId?: string;
}

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    return null;
  }
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    return aiClient;
  } catch (err) {
    console.error('[SupportEngine] Failed to initialize GoogleGenAI client:', err);
    return null;
  }
}

const PLATFORM_KNOWLEDGE_BASE = `
AUTHORITATIVE PHIVONEX PLATFORM RULES:
1. PUBLIC NAME & IDENTITY: "PHIVONEX Support" or "Support Center". Professional, concise, reassuring, official. Never claim to be a human agent, and never use terms like "bot", "AI assistant", or "AI support".
2. GENESIS NODES:
   - Node price: $1,000 USD / Node. Total hard cap: 10,000 Genesis Nodes across network.
   - Lifetime Allocation: 10,000 PHIVO per node over a 200 eligible daily reward term.
   - Initial daily emission rate: 10 PHIVO/day (protocol governed and dynamically adjustable by management).
   - Node Maturity: Nodes transition to MATURED once 100% (10,000 PHIVO) is distributed.
3. INTERNAL COIN (PHIVO):
   - Reference valuation rate: $0.10 USDT per 1 PHIVO.
   - Coin Swap: Users can swap earned PHIVO coins directly to USDT inside the User Dashboard when enabled.
4. WITHDRAWAL LIFECYCLE & STATES:
   - PENDING: Request submitted by user and currently awaiting administrator review or automatic engine dispatch.
   - APPROVED: Request approved and queued for on-chain payout.
   - PROCESSING: Blockchain transaction broadcasted to BNB Smart Chain; awaiting block confirmation.
   - COMPLETED: On-chain transaction confirmed. Genuine transaction hash (txHash) is available.
   - REJECTED / FAILED: Request cancelled or failed. Locked funds are automatically reversed (credited back) to the user's available wallet balance.
5. DEPOSIT RULES:
   - Automated BNB Smart Chain listener monitors native BNB and BEP-20 USDT deposits.
   - Requires 3 block confirmations before crediting user's available deposit balance.
6. REFERRAL & MATCHING RULES:
   - Direct Referral Commission: $100 USD per direct active Genesis Node referral.
   - Binary Matching Tiers: Milestone-based bonuses calculated automatically from left/right node volume.
7. ACCOUNT & SECURITY:
   - 2FA TOTP authentication supported. Session tokens hash-verified and time-bounded.
`;

export async function processSupportInquiry(params: {
  userId: string;
  prompt: string;
  conversationHistory?: Array<{ sender: 'USER' | 'SUPPORT'; text: string }>;
  liveData: SupportUserLiveData;
}): Promise<SupportEngineResponse> {
  const promptLower = params.prompt.toLowerCase();

  // Explicit user escalation request check
  const explicitEscalation =
    promptLower.includes('human') ||
    promptLower.includes('specialist') ||
    promptLower.includes('agent') ||
    promptLower.includes('ticket') ||
    promptLower.includes('escalate') ||
    promptLower.includes('didn\'t work') ||
    promptLower.includes('did not work') ||
    promptLower.includes('not working') ||
    promptLower.includes('speak to someone');

  // Format live user status summary for system instruction
  const userContextFormatted = `
AUTHENTICATED USER LIVE DATA (READ-ONLY):
- Public ID: ${params.liveData.user.publicId}
- Email: ${params.liveData.user.email}
- Account Status: ${params.liveData.user.status}
- Available Deposit Balance: $${params.liveData.balances.availableDepositBalanceUsd.toFixed(2)} USD
- PHIVO Coin Balance: ${params.liveData.balances.phivoCoinBalance.toFixed(2)} PHIVO
- Pending Withdrawal Total: $${params.liveData.balances.pendingWithdrawalTotalUsd.toFixed(2)} USD
- Active Genesis Nodes: ${params.liveData.nodes.activeNodeCount} (Distributed: ${params.liveData.nodes.distributedPhivo} PHIVO)
- Recent Withdrawals:
${params.liveData.withdrawals.length === 0 ? '  (None)' : params.liveData.withdrawals.map(w => `  * ID: ${w.publicWithdrawalId} | Amount: $${w.amount} USDT | Status: ${w.status} | Requested: ${w.requestedAt} | TxHash: ${w.txHash || 'N/A'}`).join('\n')}
- Recent Deposits:
${params.liveData.deposits.length === 0 ? '  (None)' : params.liveData.deposits.map(d => `  * ID: ${d.publicDepositId} | Amount: $${d.amount} USDT | Status: ${d.status} | Requested: ${d.requestedAt}`).join('\n')}
- Existing Open Support Requests: ${params.liveData.openTickets.length > 0 ? params.liveData.openTickets.map(t => t.publicTicketId).join(', ') : 'None'}
`;

  const ai = getAiClient();

  if (!ai) {
    // Fallback mode if Gemini API key or SDK client is unavailable
    console.warn('[SupportEngine] Gemini AI client unavailable. Triggering fallback support ticket creation.');
    const ticket = await createSupportTicket({
      userId: params.userId,
      category: determineCategory(params.prompt),
      subject: `Support Request: ${params.prompt.slice(0, 50)}...`,
      userMessage: params.prompt,
      automatedDiagnosisSummary: 'Automated response service fallback. Support ticket dispatched to PHIVONEX Specialist team.',
    });

    return {
      responseText: `I couldn’t verify enough information to resolve this safely. I’ve created Support Request #${ticket.publicTicketId} for review by a PHIVONEX support specialist.`,
      shouldEscalate: true,
      suggestedCategory: ticket.category,
      suggestedSubject: ticket.subject,
      automatedDiagnosis: 'Automated fallback dispatch',
      createdTicketPublicId: ticket.publicTicketId,
    };
  }

  try {
    const systemInstruction = `
You are the official PHIVONEX Support Engine ("PHIVONEX Support").
${PLATFORM_KNOWLEDGE_BASE}

${userContextFormatted}

GUIDELINES FOR RESPONDING:
1. Always greet warmly and professionally.
2. If the user asks about a specific withdrawal, deposit, node, or balance:
   - Check the AUTHENTICATED USER LIVE DATA provided above.
   - State the EXACT current status based on official data.
   - PENDING: Explain that the request is awaiting administrator review/processing.
   - APPROVED: Explain that it is approved and queued for payout.
   - PROCESSING: Explain that blockchain block confirmation is pending on BNB Smart Chain.
   - COMPLETED: Share the exact transaction hash if available.
   - REJECTED/FAILED: Explain that the funds were automatically reversed back to their available wallet ledger.
3. If the answer is verified in the knowledge base or user live data, provide a clear, helpful answer immediately.
4. If the question cannot be answered with absolute certainty, or if the user reports funds missing/errors, or asks to speak to a specialist/ticket, set shouldEscalate to TRUE.
5. NEVER invent transaction hashes, balances, or platform rules.
6. Support is strictly READ-ONLY. You CANNOT perform financial changes, approve withdrawals, or modify balances.
7. Return JSON adhering strictly to the response schema.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        ...(params.conversationHistory || []).map(h => ({
          role: h.sender === 'USER' ? 'user' : 'model',
          parts: [{ text: h.text }],
        })),
        {
          role: 'user',
          parts: [{ text: params.prompt }],
        },
      ],
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            responseText: {
              type: Type.STRING,
              description: 'Clear, helpful, and professional response to display to the user.',
            },
            shouldEscalate: {
              type: Type.BOOLEAN,
              description: 'Set to TRUE if the case needs human review, user asked for ticket/agent, or issue cannot be verified.',
            },
            suggestedCategory: {
              type: Type.STRING,
              description: 'Category such as Withdrawal, Deposit, Genesis Node, Wallet, Account, Swap, Referral, or Technical Issue.',
            },
            suggestedSubject: {
              type: Type.STRING,
              description: 'A brief 4-8 word title for the case if escalated.',
            },
            automatedDiagnosis: {
              type: Type.STRING,
              description: 'A concise 1-2 sentence diagnosis summary of what was checked.',
            },
          },
          required: ['responseText', 'shouldEscalate', 'suggestedCategory', 'suggestedSubject', 'automatedDiagnosis'],
        },
      },
    });

    const text = response.text?.trim() || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        responseText: 'Hello! Welcome to PHIVONEX Support. How can we assist you today?',
        shouldEscalate: false,
        suggestedCategory: 'Other',
        suggestedSubject: 'General Inquiry',
        automatedDiagnosis: 'Standard platform inquiry',
      };
    }

    let shouldEscalate = parsed.shouldEscalate || explicitEscalation;
    let createdTicketPublicId: string | undefined = undefined;

    if (shouldEscalate) {
      const category = parsed.suggestedCategory || determineCategory(params.prompt);
      const subject = parsed.suggestedSubject || `Support Inquiry: ${params.prompt.slice(0, 40)}`;
      const diagnosis = parsed.automatedDiagnosis || 'Automated verification incomplete. Escalated for support specialist review.';

      const ticket = await createSupportTicket({
        userId: params.userId,
        category,
        subject,
        userMessage: params.prompt,
        automatedDiagnosisSummary: diagnosis,
      });

      createdTicketPublicId = ticket.publicTicketId;

      // Ensure escalation message format is strictly adhered to
      if (!parsed.responseText.includes('PHX-SUP-') && !parsed.responseText.includes('specialist')) {
        parsed.responseText += `\n\nI couldn’t verify enough information to resolve this safely. I’ve created Support Request #${ticket.publicTicketId} for review by a PHIVONEX support specialist.`;
      } else if (!parsed.responseText.includes(ticket.publicTicketId)) {
        parsed.responseText = parsed.responseText.replace(/Support Request #\w+/g, `Support Request #${ticket.publicTicketId}`);
      }
    }

    return {
      responseText: parsed.responseText,
      shouldEscalate,
      suggestedCategory: parsed.suggestedCategory || 'Other',
      suggestedSubject: parsed.suggestedSubject || 'General Inquiry',
      automatedDiagnosis: parsed.automatedDiagnosis || 'Platform check complete',
      createdTicketPublicId,
    };
  } catch (err) {
    console.error('[SupportEngine] Exception during processSupportInquiry:', err);

    // Fallback ticket creation on model error
    const ticket = await createSupportTicket({
      userId: params.userId,
      category: determineCategory(params.prompt),
      subject: `Support Request: ${params.prompt.slice(0, 50)}...`,
      userMessage: params.prompt,
      automatedDiagnosisSummary: 'Error processing automated inquiry. Dispatched directly to support specialist queue.',
    });

    return {
      responseText: `I couldn’t verify enough information to resolve this safely. I’ve created Support Request #${ticket.publicTicketId} for review by a PHIVONEX support specialist.`,
      shouldEscalate: true,
      suggestedCategory: ticket.category,
      suggestedSubject: ticket.subject,
      automatedDiagnosis: 'Automated service fallback on error',
      createdTicketPublicId: ticket.publicTicketId,
    };
  }
}

function determineCategory(prompt: string): string {
  const p = prompt.toLowerCase();
  if (p.includes('withdraw') || p.includes('payout') || p.includes('usdt') || p.includes('tx')) return 'Withdrawal';
  if (p.includes('deposit') || p.includes('bnb') || p.includes('fund')) return 'Deposit';
  if (p.includes('node') || p.includes('genesis') || p.includes('mint')) return 'Genesis Node';
  if (p.includes('reward') || p.includes('phivo') || p.includes('epoch')) return 'PHIVO Reward';
  if (p.includes('swap') || p.includes('exchange')) return 'Swap';
  if (p.includes('referral') || p.includes('commission') || p.includes('sponsor')) return 'Referral';
  if (p.includes('matching') || p.includes('binary') || p.includes('tree')) return 'Matching';
  if (p.includes('login') || p.includes('password') || p.includes('2fa') || p.includes('account')) return 'Account';
  return 'Technical Issue';
}
