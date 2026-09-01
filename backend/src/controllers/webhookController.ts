// backend/src/controllers/webhookController.ts

import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

/* ==========================================================================
   WHATSAPP WEBHOOK TYPES
   ========================================================================== */

type WhatsAppTextMessage = {
  body?: string;
};

type WhatsAppButtonMessage = {
  text?: string;
  payload?: string;
};

type WhatsAppInteractiveMessage = {
  type?: string;
  button_reply?: {
    id?: string;
    title?: string;
  };
  list_reply?: {
    id?: string;
    title?: string;
    description?: string;
  };
};

type WhatsAppImageMessage = {
  id?: string;
  mime_type?: string;
  caption?: string;
};

type WhatsAppDocumentMessage = {
  id?: string;
  mime_type?: string;
  filename?: string;
  caption?: string;
};

type WhatsAppAudioMessage = {
  id?: string;
  mime_type?: string;
};

type WhatsAppVideoMessage = {
  id?: string;
  mime_type?: string;
  caption?: string;
};

type WhatsAppLocationMessage = {
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
};

type WhatsAppIncomingMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;

  text?: WhatsAppTextMessage;
  button?: WhatsAppButtonMessage;
  interactive?: WhatsAppInteractiveMessage;
  image?: WhatsAppImageMessage;
  document?: WhatsAppDocumentMessage;
  audio?: WhatsAppAudioMessage;
  video?: WhatsAppVideoMessage;
  location?: WhatsAppLocationMessage;
};

type WhatsAppContact = {
  wa_id?: string;
  profile?: {
    name?: string;
  };
};

type WhatsAppMessageStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;

  errors?: Array<{
    code?: number;
    title?: string;
    message?: string;
    error_data?: {
      details?: string;
    };
  }>;
};

type WhatsAppWebhookValue = {
  messaging_product?: string;

  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };

  contacts?: WhatsAppContact[];
  messages?: WhatsAppIncomingMessage[];
  statuses?: WhatsAppMessageStatus[];
};

type WhatsAppWebhookPayload = {
  object?: string;

  entry?: Array<{
    id?: string;

    changes?: Array<{
      field?: string;
      value?: WhatsAppWebhookValue;
    }>;
  }>;
};

/* ==========================================================================
   HELPERS
   ========================================================================== */

/**
 * Converts a phone number into digits only.
 *
 * Examples:
 * +254 712 345 678 -> 254712345678
 * 254712345678      -> 254712345678
 */
function normalizePhoneNumber(phoneNumber: string): string {
  return phoneNumber.replace(/\D/g, '');
}

/**
 * Converts the incoming Meta timestamp, which is in Unix seconds,
 * into a JavaScript Date object.
 */
function getWebhookMessageDate(timestamp?: string): Date {
  if (!timestamp) {
    return new Date();
  }

  const timestampSeconds = Number(timestamp);

  if (!Number.isFinite(timestampSeconds)) {
    return new Date();
  }

  return new Date(timestampSeconds * 1000);
}

/**
 * Gets a displayable body for text, buttons, interactive messages,
 * media, voice notes, documents, and location messages.
 */
function getMessageBody(message: WhatsAppIncomingMessage): string {
  if (message.type === 'text') {
    return message.text?.body?.trim() || '';
  }

  if (message.type === 'button') {
    return (
      message.button?.text?.trim() ||
      message.button?.payload?.trim() ||
      '[Button response]'
    );
  }

  if (message.type === 'interactive') {
    if (message.interactive?.type === 'button_reply') {
      return (
        message.interactive.button_reply?.title?.trim() ||
        message.interactive.button_reply?.id?.trim() ||
        '[Interactive button response]'
      );
    }

    if (message.interactive?.type === 'list_reply') {
      return (
        message.interactive.list_reply?.title?.trim() ||
        message.interactive.list_reply?.description?.trim() ||
        message.interactive.list_reply?.id?.trim() ||
        '[Interactive list response]'
      );
    }

    return '[Interactive WhatsApp response]';
  }

  if (message.type === 'image') {
    const caption = message.image?.caption?.trim();

    return caption
      ? `[Image] ${caption}`
      : '[Image received]';
  }

  if (message.type === 'document') {
    const filename = message.document?.filename?.trim();
    const caption = message.document?.caption?.trim();

    if (filename && caption) {
      return `[Document: ${filename}] ${caption}`;
    }

    if (filename) {
      return `[Document received: ${filename}]`;
    }

    if (caption) {
      return `[Document] ${caption}`;
    }

    return '[Document received]';
  }

  if (message.type === 'audio') {
    return '[Voice note received]';
  }

  if (message.type === 'video') {
    const caption = message.video?.caption?.trim();

    return caption
      ? `[Video] ${caption}`
      : '[Video received]';
  }

  if (message.type === 'location') {
    const name = message.location?.name?.trim();
    const address = message.location?.address?.trim();

    if (name && address) {
      return `[Location] ${name} — ${address}`;
    }

    if (name) {
      return `[Location] ${name}`;
    }

    if (address) {
      return `[Location] ${address}`;
    }

    return '[Location received]';
  }

  return `[Unsupported WhatsApp message type: ${message.type || 'unknown'}]`;
}

/**
 * Finds a profile name from the Meta contacts array.
 */
function getContactProfileName(
  contacts: WhatsAppContact[],
  phoneNumber: string,
): string | null {
  const contact = contacts.find((item) => {
    const contactNumber = normalizePhoneNumber(item.wa_id || '');

    return contactNumber === phoneNumber;
  });

  return contact?.profile?.name?.trim() || null;
}

/* ==========================================================================
   WEBHOOK CONTROLLER
   ========================================================================== */

/**
 * POST /api/whatsapp/webhook
 *
 * Receives WhatsApp events sent by Meta.
 *
 * Main responsibilities:
 * 1. Read incoming patient WhatsApp messages.
 * 2. Find or create a Patient using the WhatsApp phone number.
 * 3. Save incoming message into MessageLog.
 * 4. Set chatStatus to PENDING_AGENT.
 * 5. Return HTTP 200 so Meta knows the webhook was accepted.
 */
export async function handleWhatsAppWebhook(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const payload = req.body as WhatsAppWebhookPayload;

    console.info('[WhatsApp Webhook Received]', {
      object: payload?.object,
      entryCount: Array.isArray(payload?.entry)
        ? payload.entry.length
        : 0,
    });

    /*
     * Ignore any event that is not a WhatsApp Business Account webhook.
     */
    if (payload?.object !== 'whatsapp_business_account') {
      console.warn(
        '[WhatsApp Webhook Ignored] Unexpected webhook object.',
        {
          object: payload?.object,
        },
      );

      res.sendStatus(200);
      return;
    }

    const entries = Array.isArray(payload.entry)
      ? payload.entry
      : [];

    for (const entry of entries) {
      const changes = Array.isArray(entry.changes)
        ? entry.changes
        : [];

      for (const change of changes) {
        /*
         * WhatsApp incoming messages and delivery/read statuses
         * normally arrive under field: "messages".
         */
        if (change.field !== 'messages') {
          console.info('[WhatsApp Webhook Ignored] Unsupported event field.', {
            field: change.field,
          });

          continue;
        }

        const value = change.value;

        if (!value) {
          continue;
        }

        const contacts = Array.isArray(value.contacts)
          ? value.contacts
          : [];

        const incomingMessages = Array.isArray(value.messages)
          ? value.messages
          : [];

        const statuses = Array.isArray(value.statuses)
          ? value.statuses
          : [];

        /*
         * These status events are generated for messages sent from
         * your system to a patient.
         *
         * They are not patient messages, so they are logged only.
         */
        for (const status of statuses) {
          console.info('[WhatsApp Message Status Update]', {
            whatsappMessageId: status.id,
            status: status.status,
            recipientPhone: status.recipient_id,
            error: status.errors?.[0]?.error_data?.details ||
              status.errors?.[0]?.message ||
              null,
          });
        }

        /*
         * These are messages sent from the patient's WhatsApp number
         * to your connected WhatsApp Business number.
         */
        for (const incomingMessage of incomingMessages) {
          const senderPhoneRaw = incomingMessage.from?.trim();
          const whatsappMessageId = incomingMessage.id?.trim();
          const messageType = incomingMessage.type || 'unknown';

          if (!senderPhoneRaw) {
            console.warn(
              '[WhatsApp Incoming Message Ignored] Missing sender phone number.',
              {
                whatsappMessageId,
                messageType,
              },
            );

            continue;
          }

          const senderPhone = normalizePhoneNumber(senderPhoneRaw);

          if (!senderPhone) {
            console.warn(
              '[WhatsApp Incoming Message Ignored] Invalid sender phone number.',
              {
                senderPhoneRaw,
                whatsappMessageId,
              },
            );

            continue;
          }

          const messageBody = getMessageBody(incomingMessage);

          if (!messageBody) {
            console.warn(
              '[WhatsApp Incoming Message Ignored] Empty message body.',
              {
                senderPhoneLast4: senderPhone.slice(-4),
                whatsappMessageId,
                messageType,
              },
            );

            continue;
          }

          const sentAt = getWebhookMessageDate(
            incomingMessage.timestamp,
          );

          const profileName = getContactProfileName(
            contacts,
            senderPhone,
          );

          console.info('[WhatsApp Incoming Message]', {
            senderPhoneLast4: senderPhone.slice(-4),
            whatsappMessageId,
            messageType,
            profileName,
          });

          /*
           * Find the existing patient/chat by WhatsApp number.
           *
           * Patient.phoneNumber should be stored consistently in
           * international digits-only format, for example:
           *
           * 254712345678
           */
          let patient = await prisma.patient.findFirst({
            where: {
              phoneNumber: senderPhone,
            },
            select: {
              id: true,
              phoneNumber: true,
              chatStatus: true,
              assignedTo: true,
            },
          });

          /*
           * A first-time WhatsApp sender gets a new patient/chat record.
           *
           * If your Patient Prisma model has other required fields,
           * add them in this `data` object.
           */
          if (!patient) {
            patient = await prisma.patient.create({
              data: {
                phoneNumber: senderPhone,
                chatStatus: 'PENDING_AGENT',
              },
              select: {
                id: true,
                phoneNumber: true,
                chatStatus: true,
                assignedTo: true,
              },
            });

            console.info('[WhatsApp New Patient Created]', {
              patientId: patient.id,
              phoneLast4: senderPhone.slice(-4),
              profileName,
            });
          }

          /*
           * Meta can retry webhook events if a request is delayed or fails.
           *
           * This fallback prevents most duplicate messages even if your
           * MessageLog model does not yet have whatsappMessageId.
           */
          const duplicateWindowStart = new Date(
            sentAt.getTime() - 60_000,
          );

          const duplicateWindowEnd = new Date(
            sentAt.getTime() + 60_000,
          );

          const duplicateMessage = await prisma.messageLog.findFirst({
            where: {
              patientId: patient.id,
              sender: 'PATIENT',
              body: messageBody,
              timestamp: {
                gte: duplicateWindowStart,
                lte: duplicateWindowEnd,
              },
            },
            select: {
              id: true,
            },
          });

          if (duplicateMessage) {
            console.info(
              '[WhatsApp Incoming Message Duplicate Ignored]',
              {
                patientId: patient.id,
                duplicateMessageLogId: duplicateMessage.id,
                whatsappMessageId,
              },
            );

            continue;
          }

          /*
           * Save incoming WhatsApp message to your MessageLog table.
           *
           * This is what makes the text available in:
           *
           * GET /api/agent/chats
           */
          const [savedMessage, updatedPatient] =
            await prisma.$transaction([
              prisma.messageLog.create({
                data: {
                  patientId: patient.id,
                  sender: 'PATIENT',
                  body: messageBody,
                  timestamp: sentAt,
                },
              }),

              prisma.patient.update({
                where: {
                  id: patient.id,
                },
                data: {
                  /*
                   * Keep an active agent assignment if a staff member
                   * already owns the conversation.
                   */
                  chatStatus:
                    patient.chatStatus === 'AGENT_ACTIVE'
                      ? 'AGENT_ACTIVE'
                      : 'PENDING_AGENT',
                },
                select: {
                  id: true,
                  phoneNumber: true,
                  chatStatus: true,
                  assignedTo: true,
                },
              }),
            ]);

          console.info('[WhatsApp Incoming Message Saved]', {
            patientId: updatedPatient.id,
            messageLogId: savedMessage.id,
            senderPhoneLast4: senderPhone.slice(-4),
            whatsappMessageId,
            messageType,
            chatStatus: updatedPatient.chatStatus,
            assignedTo: updatedPatient.assignedTo,
          });
        }
      }
    }

    /*
     * Meta needs a successful response.
     * A non-2xx status can cause Meta to retry the same event.
     */
    res.sendStatus(200);
  } catch (error) {
    console.error(
      '[WhatsApp Webhook Controller Error]',
      error instanceof Error ? error.stack || error.message : error,
    );

    /*
     * Returning 500 tells Meta delivery failed.
     * Meta may retry the event later.
     */
    res.status(500).json({
      success: false,
      error: 'Unable to process incoming WhatsApp webhook event.',
    });
  }
}