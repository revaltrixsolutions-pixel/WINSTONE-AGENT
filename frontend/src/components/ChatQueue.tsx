import React, { useMemo, useState } from 'react';
import type { Chat } from '../types/dashboard';

interface ChatQueueProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chat: Chat) => void;
  onAssignChat: (
    patientId: string,
    doctorName: string
  ) => void | Promise<void>;
  isLoading?: boolean;
  staffMembers?: string[];
}

type QueueFilter = 'ALL' | 'PENDING_AGENT' | 'AGENT_ACTIVE';

const getStatusLabel = (status?: string): string => {
  if (!status) return 'Unknown';

  switch (status) {
    case 'AGENT_ACTIVE':
      return 'Assigned';
    case 'PENDING_AGENT':
      return 'Waiting';
    case 'BOT':
      return 'Bot';
    default:
      return status.replaceAll('_', ' ');
  }
};

const getStatusClasses = (status?: string): string => {
  switch (status) {
    case 'AGENT_ACTIVE':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'PENDING_AGENT':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'BOT':
      return 'bg-slate-100 text-slate-600 ring-slate-200';
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200';
  }
};

const getLatestMessage = (chat: Chat) => {
  if (!chat.messages?.length) return null;
  return chat.messages[chat.messages.length - 1];
};

const formatTime = (timestamp?: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-KE', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

const getPatientDisplayName = (chat: Chat) => {
  return chat.fullName?.trim() || chat.phoneNumber || 'Unknown patient';
};

export const ChatQueue: React.FC<ChatQueueProps> = ({
  chats,
  selectedChatId,
  onSelectChat,
  onAssignChat,
  isLoading = false,
  staffMembers = [],
}) => {
  const [selectedStaff, setSelectedStaff] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<QueueFilter>('ALL');
  const [assigningChatId, setAssigningChatId] = useState<string | null>(null);

  const filteredChats = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return chats.filter((chat) => {
      const matchesFilter =
        filter === 'ALL' || chat.chatStatus === filter;

      const searchableText = [
        chat.phoneNumber,
        chat.fullName,
        chat.assignedTo,
        chat.chatStatus,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      const matchesSearch =
        !normalizedSearch || searchableText.includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });
  }, [chats, filter, searchTerm]);

  const handleAssign = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation(); // Prevents triggering onSelectChat when clicking assign
    const staffMember = selectedStaff[chatId];
    if (!staffMember || assigningChatId) return;

    try {
      setAssigningChatId(chatId);
      await onAssignChat(chatId, staffMember);

      setSelectedStaff((current) => {
        const next = { ...current };
        delete next[chatId];
        return next;
      });
    } catch (error) {
      console.error('Failed to assign chat:', error);
    } finally {
      setAssigningChatId(null);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col bg-white md:w-[330px] md:rounded-3xl">
      {/* Header */}
      <div className="shrink-0 border-b border-white/20 bg-gradient-to-br from-fuchsia-600 via-violet-600 to-blue-600 p-4 text-white md:rounded-t-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black">Live patient queue</h2>
            <p className="mt-1 text-xs text-white/75">
              Assign incoming conversations to staff.
            </p>
          </div>
          <div className="flex h-10 min-w-10 items-center justify-center rounded-2xl bg-white/15 px-2 text-sm font-black">
            {chats.length}
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4">
          <label htmlFor="chat-queue-search" className="sr-only">
            Search patient conversations
          </label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm">
            🔎
          </span>
          <input
            id="chat-queue-search"
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search phone or patient..."
            className="min-h-11 w-full rounded-2xl border border-white/20 bg-white/15 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/60 focus:border-white/60 focus:bg-white/25 focus:ring-4 focus:ring-white/10"
          />
        </div>

        {/* Filters */}
        <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-black/10 p-1">
          <FilterButton
            label="All"
            active={filter === 'ALL'}
            onClick={() => setFilter('ALL')}
          />
          <FilterButton
            label="Waiting"
            active={filter === 'PENDING_AGENT'}
            onClick={() => setFilter('PENDING_AGENT')}
          />
          <FilterButton
            label="Assigned"
            active={filter === 'AGENT_ACTIVE'}
            onClick={() => setFilter('AGENT_ACTIVE')}
          />
        </div>
      </div>

      {/* Queue content */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {isLoading ? (
          <LoadingQueue />
        ) : filteredChats.length === 0 ? (
          <EmptyQueue
            hasSearch={Boolean(searchTerm.trim())}
            hasChats={chats.length > 0}
          />
        ) : (
          <div className="space-y-3 p-3">
            {filteredChats.map((chat) => {
              const isSelected = selectedChatId === chat.id;
              const latestMessage = getLatestMessage(chat);
              const isAssigning = assigningChatId === chat.id;
              const selectedStaffMember = selectedStaff[chat.id] || '';

              return (
                <article
                  key={chat.id}
                  onClick={() => onSelectChat(chat)}
                  className={`cursor-pointer rounded-3xl border p-3 transition ${
                    isSelected
                      ? 'border-violet-300 bg-violet-50 shadow-lg shadow-violet-500/10'
                      : 'border-slate-100 bg-white shadow-sm hover:border-violet-200 hover:shadow-md'
                  }`}
                >
                  {/* Card Main Info */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-black ${
                        isSelected
                          ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white'
                          : 'bg-gradient-to-br from-cyan-100 to-violet-100 text-violet-700'
                      }`}
                    >
                      {chat.fullName?.charAt(0).toUpperCase() || 'P'}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-800">
                            {getPatientDisplayName(chat)}
                          </p>
                          {chat.fullName && chat.phoneNumber && (
                            <p className="mt-0.5 truncate text-[11px] text-slate-400">
                              {chat.phoneNumber}
                            </p>
                          )}
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ring-1 ${getStatusClasses(
                            chat.chatStatus
                          )}`}
                        >
                          {getStatusLabel(chat.chatStatus)}
                        </span>
                      </div>

                      {latestMessage && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                            {latestMessage.body}
                          </p>
                          <span className="shrink-0 text-[10px] text-slate-400">
                            {formatTime(latestMessage.timestamp)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Assignment Control Section */}
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {chat.assignedTo ? (
                      <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                          ✓
                        </span>
                        <span className="truncate">
                          Assigned to {chat.assignedTo}
                        </span>
                      </div>
                    ) : (
                      <div
                        className="flex items-center gap-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="min-w-0 flex-1">
                          <label
                            htmlFor={`staff-${chat.id}`}
                            className="sr-only"
                          >
                            Assign conversation to staff member
                          </label>
                          <select
                            id={`staff-${chat.id}`}
                            value={selectedStaffMember}
                            onChange={(e) =>
                              setSelectedStaff((current) => ({
                                ...current,
                                [chat.id]: e.target.value,
                              }))
                            }
                            className="min-h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100"
                          >
                            <option value="">Select staff member</option>
                            {staffMembers.map((member) => (
                              <option key={member} value={member}>
                                {member}
                              </option>
                            ))}
                          </select>
                        </div>

                        <button
                          type="button"
                          disabled={!selectedStaffMember || isAssigning}
                          onClick={(e) => handleAssign(e, chat.id)}
                          className="min-h-10 shrink-0 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-3 text-xs font-black text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isAssigning ? 'Assigning…' : 'Assign'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-4 py-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-medium text-slate-400">
            Showing {filteredChats.length} of {chats.length}
          </span>
          <span className="flex items-center gap-1.5 font-bold text-emerald-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live
          </span>
        </div>
      </div>
    </aside>
  );
};

type FilterButtonProps = {
  label: string;
  active: boolean;
  onClick: () => void;
};

const FilterButton: React.FC<FilterButtonProps> = ({
  label,
  active,
  onClick,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`min-h-9 rounded-xl px-2 text-[10px] font-black transition ${
      active
        ? 'bg-white text-violet-700 shadow-sm'
        : 'text-white/70 hover:bg-white/10 hover:text-white'
    }`}
    aria-pressed={active}
  >
    {label}
  </button>
);

const LoadingQueue: React.FC = () => (
  <div className="space-y-3 p-3">
    {[1, 2, 3, 4].map((item) => (
      <div
        key={item}
        className="h-36 animate-pulse rounded-3xl bg-slate-100"
      />
    ))}
  </div>
);

type EmptyQueueProps = {
  hasSearch: boolean;
  hasChats: boolean;
};

const EmptyQueue: React.FC<EmptyQueueProps> = ({ hasSearch, hasChats }) => (
  <div className="flex min-h-64 items-center justify-center px-6 text-center">
    <div>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl">
        {hasSearch || hasChats ? '🔎' : '💬'}
      </div>
      <h3 className="text-sm font-black text-slate-700">
        {hasSearch
          ? 'No matching conversations'
          : hasChats
            ? 'No conversations in this filter'
            : 'No active chats'}
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">
        {hasSearch
          ? 'Try searching with another phone number or patient name.'
          : hasChats
            ? 'Try selecting another queue filter.'
            : 'New patient conversations will appear here.'}
      </p>
    </div>
  </div>
);