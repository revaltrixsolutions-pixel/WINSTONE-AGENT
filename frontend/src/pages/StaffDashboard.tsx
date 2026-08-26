import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { Chat, Tab } from '../types/dashboard';
import { Sidebar } from '../components/Sidebar';
import { ChatQueue } from '../components/ChatQueue';
import { ChatWindow } from '../components/ChatWindow';
import { AppointmentTable } from '../components/AppointmentTable';

import {
  assignChatToAgent,
  fetchAgentChats,
  sendAgentReply,
} from '../services/api';

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

export const StaffDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('inbox');
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [mobileQueueOpen, setMobileQueueOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previousChatIds = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const isLoadingChatsRef = useRef(false);

  const playNotificationSound = useCallback(() => {
    try {
      const audioWindow = window as AudioContextWindow;
      const AudioContextClass =
        window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext =
        audioContextRef.current || new AudioContextClass();

      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        void audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(
        587.33,
        audioContext.currentTime,
      );

      gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.0001,
        audioContext.currentTime + 0.45,
      );

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.45);
    } catch (soundError) {
      console.warn('Notification sound unavailable:', soundError);
    }
  }, []);

  const loadChats = useCallback(async () => {
    if (isLoadingChatsRef.current) return;

    isLoadingChatsRef.current = true;

    try {
      const data = await fetchAgentChats();
      const nextChats: Chat[] = Array.isArray(data) ? data : [];

      const nextChatIds = new Set(
        nextChats
          .map((chat) => chat.id)
          .filter((id): id is string => Boolean(id)),
      );

      const previousIds = previousChatIds.current;

      const hasNewChats =
        previousIds.size > 0 &&
        [...nextChatIds].some((id) => !previousIds.has(id));

      if (
        hasNewChats &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'visible'
      ) {
        playNotificationSound();
      }

      previousChatIds.current = nextChatIds;
      setChats(nextChats);

      setSelectedChat((currentChat) => {
        if (!currentChat) return null;

        return (
          nextChats.find((chat) => chat.id === currentChat.id) ?? null
        );
      });

      setError(null);
    } catch (loadError) {
      console.error('Failed to load agent chats:', loadError);
      setError('Unable to refresh chats. Please try again.');
    } finally {
      isLoadingChatsRef.current = false;
      setIsLoading(false);
    }
  }, [playNotificationSound]);

  useEffect(() => {
    void loadChats();

    const intervalId = window.setInterval(() => {
      void loadChats();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadChats]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    setMobileQueueOpen(false);
  };

  const handleAssignChat = async (
    patientId: string,
    doctorName: string,
  ) => {
    try {
      setError(null);

      const response = await assignChatToAgent(patientId, doctorName);

      if (!response?.success) {
        throw new Error('Chat assignment failed');
      }

      await loadChats();

      setSelectedChat((currentChat) => {
        if (currentChat?.id === patientId) {
          return {
            ...currentChat,
            assignedTo: doctorName,
          };
        }

        return currentChat;
      });
    } catch (assignError) {
      console.error('Error assigning chat:', assignError);
      setError('Unable to assign this chat.');
    }
  };

  const handleSendMessage = async (text: string) => {
    const trimmedText = text.trim();

    if (!selectedChat || !trimmedText || isSending) return;

    try {
      setIsSending(true);
      setError(null);

      const response = await sendAgentReply(
        selectedChat.id,
        trimmedText,
        selectedChat.assignedTo || 'Staff Doctor',
      );

      if (!response?.success) {
        throw new Error('Message sending failed');
      }

      await loadChats();
    } catch (sendError) {
      console.error('Error sending agent reply:', sendError);
      setError('Unable to send your message.');
    } finally {
      setIsSending(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    setMobileQueueOpen(false);
  };

  const renderMobileHeader = () => {
    if (activeTab === 'inbox' && selectedChat) {
      return (
        <header className="flex min-h-[72px] items-center justify-between gap-3 border-b border-white/20 bg-slate-950 px-4 py-3 text-white shadow-lg md:hidden">
          <button
            type="button"
            onClick={() => setMobileQueueOpen(true)}
            className="flex min-h-11 items-center gap-2 rounded-2xl bg-white/10 px-3 text-sm font-bold transition hover:bg-white/20"
          >
            <span className="text-xl">←</span>
            <span>Queue</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-black">
              {selectedChat.phoneNumber || 'Unknown patient'}
            </p>
            <p className="text-[11px] text-emerald-300">
              Conversation active
            </p>
          </div>

          <span className="h-3 w-3 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.9)]" />
        </header>
      );
    }

    return (
      <header className="flex min-h-[72px] items-center justify-between border-b border-white/20 bg-slate-950 px-4 py-3 text-white shadow-lg md:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-lg font-black shadow-lg">
            P
          </div>

          <div>
            <h1 className="text-base font-black tracking-tight">
              Phadam Portal
            </h1>
            <p className="text-[11px] font-medium text-slate-400">
              Staff workspace
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
          Online
        </div>
      </header>
    );
  };

  const renderMobileBottomNavigation = () => (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(15,23,42,0.25)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => handleTabChange('inbox')}
          className={`relative flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition ${
            activeTab === 'inbox'
              ? 'bg-gradient-to-br from-fuchsia-500 to-violet-600 text-white shadow-lg shadow-violet-500/30'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <span className="text-lg">💬</span>
          <span>Inbox</span>

          {chats.length > 0 && (
            <span className="absolute right-3 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-400 px-1 text-[10px] font-black text-slate-950">
              {chats.length > 99 ? '99+' : chats.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('appointments')}
          className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition ${
            activeTab === 'appointments'
              ? 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg shadow-blue-500/30'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <span className="text-lg">📅</span>
          <span>Visits</span>
        </button>

        <button
          type="button"
          onClick={() => handleTabChange('patients')}
          className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition ${
            activeTab === 'patients'
              ? 'bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-lg shadow-teal-500/30'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <span className="text-lg">👥</span>
          <span>Patients</span>
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,_#fce7f3_0,_transparent_32%),radial-gradient(circle_at_bottom_right,_#cffafe_0,_transparent_35%),#f8fafc] font-sans text-slate-900">
      <div className="flex h-screen min-h-[600px] w-full overflow-hidden">
        <aside className="hidden shrink-0 md:flex">
          <Sidebar
            activeTab={activeTab}
            setActiveTab={handleTabChange}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {renderMobileHeader()}

          {error && (
            <div className="mx-3 mt-3 flex items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm md:mx-6">
              <span>{error}</span>

              <button
                type="button"
                onClick={() => void loadChats()}
                className="shrink-0 rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white transition hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          )}

          {activeTab === 'inbox' && (
            <section className="relative flex min-h-0 flex-1 overflow-hidden p-0 md:gap-5 md:p-5">
              {mobileQueueOpen && (
                <button
                  type="button"
                  aria-label="Close chat queue"
                  onClick={() => setMobileQueueOpen(false)}
                  className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm md:hidden"
                />
              )}

              <div
                className={`fixed inset-y-0 left-0 z-50 flex w-[88%] max-w-[380px] transform bg-white shadow-2xl transition-transform duration-300 md:static md:z-auto md:w-[330px] md:max-w-none md:translate-x-0 md:rounded-3xl md:border md:border-white/80 md:shadow-xl ${
                  mobileQueueOpen
                    ? 'translate-x-0'
                    : '-translate-x-full'
                }`}
              >
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-fuchsia-600 via-violet-600 to-blue-600 px-4 py-4 text-white md:rounded-t-3xl">
                    <div>
                      <p className="text-lg font-black">Live queue</p>
                      <p className="text-xs text-white/75">
                        {chats.length} conversation
                        {chats.length === 1 ? '' : 's'} waiting
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMobileQueueOpen(false)}
                      className="rounded-xl bg-white/15 px-3 py-2 text-xl leading-none md:hidden"
                    >
                      ×
                    </button>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {isLoading ? (
                      <div className="space-y-3 p-4">
                        {[1, 2, 3, 4].map((item) => (
                          <div
                            key={item}
                            className="h-20 animate-pulse rounded-2xl bg-slate-100"
                          />
                        ))}
                      </div>
                    ) : (
                      <ChatQueue
                        chats={chats}
                        selectedChatId={selectedChat?.id || null}
                        onSelectChat={handleSelectChat}
                        onAssignChat={handleAssignChat}
                      />
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white md:rounded-3xl md:border md:border-white/80 md:shadow-xl">
                {selectedChat ? (
                  <ChatWindow
                    chatId={selectedChat.id}
                    patientPhone={selectedChat.phoneNumber || ''}
                    messages={selectedChat.messages || []}
                    onSendMessage={handleSendMessage}
                    isSending={isSending}
                  />
                ) : (
                  <div className="flex flex-1 items-center justify-center bg-gradient-to-br from-violet-50 via-white to-cyan-50 px-6 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[2rem] bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-4xl shadow-xl shadow-violet-300/40">
                        💬
                      </div>

                      <h2 className="text-xl font-black text-slate-800 md:text-2xl">
                        Select a conversation
                      </h2>

                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Choose a patient chat from the queue to start helping.
                      </p>

                      <button
                        type="button"
                        onClick={() => setMobileQueueOpen(true)}
                        className="mt-5 min-h-12 rounded-2xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-6 text-sm font-black text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.02] md:hidden"
                      >
                        Open chat queue
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {activeTab === 'appointments' && (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-8">
              <div className="mb-6">
                <div className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-black uppercase tracking-wider text-blue-700">
                  Schedule
                </div>

                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                  Appointments
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Manage upcoming patient visits from one responsive workspace.
                </p>
              </div>

              <div className="overflow-x-auto rounded-3xl border border-white/80 bg-white shadow-xl">
                <AppointmentTable appointments={[]} />
              </div>
            </section>
          )}

          {activeTab === 'patients' && (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-8">
              <div className="mx-auto max-w-5xl">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-600 p-6 text-white shadow-2xl shadow-teal-500/20 md:p-10">
                  <div className="absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/15 blur-2xl" />
                  <div className="absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-fuchsia-400/20 blur-3xl" />

                  <div className="relative">
                    <div className="mb-4 text-4xl">👥</div>

                    <h2 className="text-2xl font-black md:text-4xl">
                      Patient records directory
                    </h2>

                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/80 md:text-base">
                      Access verified patient profiles, registry information,
                      and connected healthcare records.
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-3xl border-2 border-dashed border-slate-200 bg-white/80 p-8 text-center shadow-lg backdrop-blur md:p-14">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 text-3xl">
                    📂
                  </div>

                  <h3 className="text-lg font-black text-slate-800">
                    No records loaded
                  </h3>

                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    External records are not currently available, or registry
                    synchronization is still pending.
                  </p>
                </div>
              </div>
            </section>
          )}

          {renderMobileBottomNavigation()}
        </main>
      </div>
    </div>
  );
};