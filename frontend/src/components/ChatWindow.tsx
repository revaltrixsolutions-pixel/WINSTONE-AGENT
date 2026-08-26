import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type MessageSender = 'PATIENT' | 'BOT' | 'AGENT';

export interface Message {
  id?: string;
  sender: MessageSender | string;
  body: string;
  timestamp?: string;
}

interface ChatWindowProps {
  chatId: string | null;
  patientPhone?: string;
  patientName?: string | null;
  messages: Message[];
  onSendMessage: (text: string) => void | Promise<void>;
  isSending?: boolean;
}

const getInitials = (
  patientName?: string | null,
  patientPhone?: string,
) => {
  const name = patientName?.trim();

  if (name) {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  return patientPhone?.slice(-2) || 'P';
};

const getSenderLabel = (sender: string) => {
  switch (sender) {
    case 'PATIENT':
      return 'Patient';
    case 'BOT':
      return 'Assistant';
    case 'AGENT':
      return 'You';
    default:
      return sender || 'Message';
  }
};

const getMessageDate = (timestamp?: string) => {
  if (!timestamp) return null;

  const date = new Date(timestamp);

  return Number.isNaN(date.getTime()) ? null : date;
};

const formatTime = (timestamp?: string) => {
  const date = getMessageDate(timestamp);

  if (!date) return '';

  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDate = (timestamp?: string) => {
  const date = getMessageDate(timestamp);

  if (!date) return '';

  return date.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

const getSenderStyles = (sender: string) => {
  switch (sender) {
    case 'PATIENT':
      return {
        alignment: 'justify-start',
        contentAlignment: 'items-start',
        label: 'text-fuchsia-600',
        bubble:
          'rounded-tl-md border border-fuchsia-100 bg-white text-slate-800',
      };

    case 'BOT':
      return {
        alignment: 'justify-end',
        contentAlignment: 'items-end',
        label: 'text-cyan-600',
        bubble:
          'rounded-tr-md bg-gradient-to-br from-cyan-500 to-blue-600 text-white',
      };

    case 'AGENT':
      return {
        alignment: 'justify-end',
        contentAlignment: 'items-end',
        label: 'text-violet-600',
        bubble:
          'rounded-tr-md bg-gradient-to-br from-fuchsia-600 to-violet-600 text-white',
      };

    default:
      return {
        alignment: 'justify-start',
        contentAlignment: 'items-start',
        label: 'text-slate-500',
        bubble:
          'rounded-tl-md border border-slate-200 bg-white text-slate-800',
      };
  }
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  chatId,
  patientPhone = '',
  patientName,
  messages,
  onSendMessage,
  isSending = false,
}) => {
  const [inputText, setInputText] = useState('');
  const [isNearBottom, setIsNearBottom] = useState(true);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const displayName = useMemo(() => {
    return patientName?.trim() || patientPhone || 'Unknown patient';
  }, [patientName, patientPhone]);

  const initials = useMemo(() => {
    return getInitials(patientName, patientPhone);
  }, [patientName, patientPhone]);

  useEffect(() => {
    setInputText('');
    setIsNearBottom(true);
  }, [chatId]);

  useEffect(() => {
    if (!messagesEndRef.current) return;

    if (isNearBottom || messages.length <= 1) {
      messagesEndRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    }
  }, [messages, isNearBottom]);

  const handleMessagesScroll = () => {
    const container = messagesContainerRef.current;

    if (!container) return;

    const distanceFromBottom =
      container.scrollHeight -
      container.scrollTop -
      container.clientHeight;

    setIsNearBottom(distanceFromBottom < 120);
  };

  const resizeTextarea = (
    textarea: HTMLTextAreaElement,
  ) => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(
      textarea.scrollHeight,
      128,
    )}px`;
  };

  const handleInputChange = (
    event: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setInputText(event.target.value);
    resizeTextarea(event.currentTarget);
  };

  const handleSend = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const trimmedMessage = inputText.trim();

    if (!trimmedMessage || isSending) return;

    try {
      await onSendMessage(trimmedMessage);

      setInputText('');

      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.focus();
      }
    } catch (sendError) {
      console.error('Failed to send message:', sendError);
    }
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key !== 'Enter' || event.shiftKey) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  };

  if (!chatId) {
    return (
      <div className="flex min-h-full flex-1 items-center justify-center bg-gradient-to-br from-violet-50 via-white to-cyan-50 px-6 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-4xl shadow-xl shadow-violet-300/40">
            💬
          </div>

          <h2 className="text-xl font-black text-slate-800">
            Select a conversation
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-500">
            Choose a chat from the queue to start messaging the patient.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-violet-50 via-white to-cyan-50">
      {/* Header */}
      <header className="shrink-0 border-b border-white/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 to-violet-600 text-sm font-black text-white shadow-lg shadow-violet-500/20">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-black text-slate-800 sm:text-base">
              {displayName}
            </h2>

            {patientName && patientPhone && (
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {patientPhone}
              </p>
            )}

            <div className="mt-1 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />

              <span className="text-xs font-bold text-emerald-600">
                Conversation active
              </span>
            </div>
          </div>

          <div className="hidden rounded-full bg-violet-100 px-3 py-1.5 text-[11px] font-black text-violet-700 sm:block">
            Live chat
          </div>
        </div>
      </header>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 sm:px-6 sm:py-6"
        aria-live="polite"
        aria-label="Conversation messages"
      >
        {messages.length === 0 ? (
          <div className="flex h-full min-h-64 items-center justify-center text-center">
            <div>
              <div className="mx-auto mb-3 text-4xl">👋</div>

              <p className="text-sm font-bold text-slate-500">
                No messages yet
              </p>

              <p className="mt-1 text-xs text-slate-400">
                Send a reply to begin the conversation.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message, index) => {
              const styles = getSenderStyles(message.sender);
              const messageDate = formatDate(message.timestamp);
              const messageTime = formatTime(message.timestamp);

              return (
                <div
                  key={
                    message.id ||
                    `${message.timestamp || 'message'}-${index}`
                  }
                  className={`flex ${styles.alignment}`}
                >
                  <div
                    className={`flex w-fit max-w-[90%] flex-col ${styles.contentAlignment} sm:max-w-[75%]`}
                  >
                    <div
                      className={`mb-1 px-1 text-[10px] font-black uppercase tracking-wide ${styles.label}`}
                    >
                      {getSenderLabel(message.sender)}
                    </div>

                    <div
                      className={`rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${styles.bubble}`}
                    >
                      <p className="break-words whitespace-pre-wrap">
                        {message.body}
                      </p>
                    </div>

                    {(messageDate || messageTime) && (
                      <span className="mt-1 px-1 text-[10px] font-medium text-slate-400">
                        {messageDate && `${messageDate} · `}
                        {messageTime}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>
        )}

        {!isNearBottom && messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({
                behavior: 'smooth',
              });
              setIsNearBottom(true);
            }}
            className="fixed bottom-24 right-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 text-lg text-white shadow-xl shadow-violet-500/30 transition hover:scale-105 sm:absolute sm:bottom-5 sm:right-6"
            aria-label="Scroll to latest message"
          >
            ↓
          </button>
        )}
      </div>

      {/* Composer */}
      <form
        onSubmit={handleSend}
        className="shrink-0 border-t border-white/80 bg-white/95 p-3 shadow-[0_-8px_25px_rgba(15,23,42,0.06)] backdrop-blur sm:p-4"
      >
        <div className="flex items-end gap-2 sm:gap-3">
          <textarea
            ref={textareaRef}
            value={inputText}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your reply..."
            rows={1}
            maxLength={2000}
            disabled={isSending}
            aria-label="Message reply"
            className="max-h-32 min-h-12 flex-1 resize-none overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={isSending || !inputText.trim()}
            className="min-h-12 shrink-0 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-4 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition hover:scale-[1.02] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100 sm:px-5"
          >
            {isSending ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span className="hidden sm:inline">
                  Sending…
                </span>
              </span>
            ) : (
              'Send'
            )}
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="hidden text-[11px] text-slate-400 sm:block">
            Press Enter to send · Shift + Enter for a new line
          </p>

          <p className="ml-auto text-[10px] text-slate-400">
            {inputText.length}/2000
          </p>
        </div>
      </form>
    </div>
  );
};