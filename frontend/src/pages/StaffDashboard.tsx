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
import { AdminAppointmentsPage } from '../components/AdminAppointmentsPage';
import {
  createUserAccount,
  deleteUserAccount,
  fetchCurrentUser,
  fetchUsers,
  loginToDashboard,
  logoutDashboard,
  updateUserStatus,
  updateAppointmentStatus,
} from '../services/api';
import type { AdminReminder, Appointment, PatientRecord } from '../services/api';

import {
  assignChatToAgent,
  fetchAgentChats,
  sendAgentReply,
  fetchAppointments,
  fetchPatients,
  fetchAppointmentReminders,
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
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';
  } | null>(null);
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [adminUsers, setAdminUsers] = useState<Array<{
    id: string;
    name: string;
    email: string;
    role: 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';
    isActive: boolean;
  }>>([]);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'STAFF' as 'SUPER_ADMIN' | 'ADMIN' | 'STAFF',
  });
  const [adminBusy, setAdminBusy] = useState(false);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [adminReminders, setAdminReminders] = useState<AdminReminder[]>([]);

  const previousChatIds = useRef<Set<string>>(new Set());
  const previousLatestMessages = useRef<Record<string, string>>({});
  const previousAssignments = useRef<Record<string, string | null>>({});
  const previousAppointmentIds = useRef<Set<string>>(new Set());
  const previousReminderIds = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const isLoadingChatsRef = useRef(false);

  const notifyBrowser = useCallback((newChatCount: number) => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      const body = `${newChatCount} new hospital update${newChatCount > 1 ? 's are' : ' is'} waiting in the queue.`;
      void navigator.serviceWorker?.ready.then((registration) => {
        void registration.showNotification('Phadam Hospital update', {
          body,
          tag: 'phadam-hospital-admin-update',
          icon: '/pwa-192.png',
        });
      }).catch(() => {
        new Notification('Phadam Hospital update', { body, tag: 'phadam-hospital-admin-update' });
      });
    }
  }, []);

  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) return;

    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const audioWindow = window as AudioContextWindow;
      const AudioContextClass =
        window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext =
        audioContextRef.current || new AudioContextClass();

      audioContextRef.current = audioContext;

      const play = () => {
        const startTime = audioContext.currentTime;
        const notes = [
          { frequency: 587.33, start: 0, duration: 0.8 },
          { frequency: 783.99, start: 0.9, duration: 0.8 },
          { frequency: 987.77, start: 1.8, duration: 0.8 },
          { frequency: 783.99, start: 2.7, duration: 0.8 },
          { frequency: 587.33, start: 3.6, duration: 1.2 },
        ];

        for (const note of notes) {
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          const noteStart = startTime + note.start;
          const noteEnd = noteStart + note.duration;

          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(note.frequency, noteStart);
          gainNode.gain.setValueAtTime(0.0001, noteStart);
          gainNode.gain.exponentialRampToValueAtTime(0.12, noteStart + 0.06);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, noteEnd);
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          oscillator.start(noteStart);
          oscillator.stop(noteEnd);
        }
      };

      if (audioContext.state === 'suspended') {
        void audioContext.resume().then(play);
      } else {
        play();
      }
    } catch (soundError) {
      console.warn('Notification sound unavailable:', soundError);
    }
  }, []);

  const unlockNotificationAudio = useCallback(async () => {
    try {
      const audioWindow = window as AudioContextWindow;
      const AudioContextClass =
        window.AudioContext || audioWindow.webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext =
        audioContextRef.current || new AudioContextClass();

      audioContextRef.current = audioContext;

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
    } catch (soundError) {
      console.warn('Notification audio could not be enabled:', soundError);
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
      const latestMessages = Object.fromEntries(
        nextChats.map((chat) => {
          const latestMessage = chat.messages?.[chat.messages.length - 1];
          return [
            chat.id,
            latestMessage?.id || latestMessage?.timestamp || '',
          ];
        }),
      );

      const hasNewChats =
        previousIds.size > 0 &&
        [...nextChatIds].some((id) => !previousIds.has(id));

      const hasNewMessages =
        Object.keys(previousLatestMessages.current).length > 0 &&
        nextChats.some((chat) => {
          const latestMessage = latestMessages[chat.id];
          return Boolean(
            latestMessage &&
            latestMessage !== previousLatestMessages.current[chat.id] &&
            chat.messages?.[chat.messages.length - 1]?.sender === 'PATIENT',
          );
        });

      if (hasNewChats || hasNewMessages) {
        playNotificationSound();
        notifyBrowser(
          hasNewChats
            ? nextChats.length - previousIds.size || 1
            : 1,
        );
      }

      if (currentUser) {
        const newlyAssigned = nextChats.filter((chat) =>
          chat.assignedTo === currentUser.name &&
          previousAssignments.current[chat.id] !== currentUser.name,
        );

        if (newlyAssigned.length > 0) {
          playNotificationSound();
          notifyBrowser(newlyAssigned.length);
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Patient needs your help', {
              body: 'A patient has been assigned to you. Open the chat and introduce yourself.',
              tag: `phadam-assignment-${newlyAssigned[0].id}`,
            });
          }
        }
      }

      previousAssignments.current = Object.fromEntries(
        nextChats.map((chat) => [chat.id, chat.assignedTo ?? null]),
      );
      previousLatestMessages.current = latestMessages;

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
  }, [currentUser, notifyBrowser, playNotificationSound]);

  const loadDashboardRecords = useCallback(async () => {
    try {
      const [nextAppointments, nextPatients] = await Promise.all([
        fetchAppointments(),
        fetchPatients(),
      ]);
      const reminders = await fetchAppointmentReminders();

      const previousAppointmentIdsValue = previousAppointmentIds.current;
      const hasNewAppointment = previousAppointmentIdsValue.size > 0 &&
        nextAppointments.some((appointment) => !previousAppointmentIdsValue.has(appointment.id));

      if (hasNewAppointment) {
        playNotificationSound();
        notifyBrowser(1);
      }

      const newAdminReminders = reminders.filter((reminder) => !previousReminderIds.current.has(reminder.id));
      if (previousReminderIds.current.size > 0 && newAdminReminders.length > 0) {
        playNotificationSound();
        notifyBrowser(newAdminReminders.length);
      }
      previousReminderIds.current = new Set(reminders.map((reminder) => reminder.id));
      setAdminReminders(reminders);

      previousAppointmentIds.current = new Set(nextAppointments.map((appointment) => appointment.id));
      setAppointments(nextAppointments);
      setPatients(nextPatients);
    } catch (recordError) {
      console.error('Failed to load dashboard records:', recordError);
    }
  }, [notifyBrowser, playNotificationSound]);

  const handleLogin = useCallback(async () => {
    try {
      void unlockNotificationAudio();
      setAuthError(null);
      const response = await loginToDashboard(loginForm.email, loginForm.password);

      if (!response.success || !response.user) {
        throw new Error(response.error || 'Login failed.');
      }

      setCurrentUser(response.user);
      setActiveTab(response.user.role === 'SUPER_ADMIN' ? 'admin' : 'inbox');
      await requestNotificationPermission();
      void loadChats();
    } catch (loginError) {
      const message = loginError instanceof Error ? loginError.message : 'Login failed.';
      setAuthError(message);
    }
  }, [loadChats, loginForm.email, loginForm.password, requestNotificationPermission, unlockNotificationAudio]);

  const handleLogout = useCallback(() => {
    logoutDashboard();
    setCurrentUser(null);
    setAuthError(null);
    setActiveTab('inbox');
    setChatListEmpty();
  }, []);

  const setChatListEmpty = useCallback(() => {
    setChats([]);
    setSelectedChat(null);
    previousChatIds.current = new Set();
  }, []);

  const loadCurrentUser = useCallback(async () => {
    try {
      const user = await fetchCurrentUser();
      setCurrentUser(user);

      if (user) {
        await requestNotificationPermission();
      }
    } catch {
      setCurrentUser(null);
    } finally {
      setIsAuthLoading(false);
    }
  }, [requestNotificationPermission]);

  const loadAdminUsers = useCallback(async () => {
    if (!currentUser) {
      return;
    }

    try {
      const users = await fetchUsers();
      setAdminUsers(users);
    } catch (loadUsersError) {
      console.error('Unable to load admin users:', loadUsersError);
    }
  }, [currentUser]);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadAdminUsers();
  }, [currentUser, loadAdminUsers]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

    void loadChats();
    void loadDashboardRecords();

    const intervalId = window.setInterval(() => {
      void loadChats();
      void loadDashboardRecords();
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [currentUser, loadChats, loadDashboardRecords]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    void navigator.serviceWorker.register('/sw.js').catch((registrationError) => {
      console.warn('Web notification worker unavailable:', registrationError);
    });
  }, []);

  const handleCreateUser = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
      setAuthError('Only the super admin can create users.');
      return;
    }

    try {
      setAdminBusy(true);
      const payload = {
        name: adminForm.name.trim(),
        email: adminForm.email.trim(),
        password: adminForm.password,
        role: adminForm.role,
      };

      const response = await createUserAccount(payload);

      if (!response.success) {
        throw new Error(response.error || 'Unable to create user.');
      }

      setAdminForm({ name: '', email: '', password: '', role: 'STAFF' });
      await loadAdminUsers();
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : 'Unable to create user.';
      setError(message);
    } finally {
      setAdminBusy(false);
    }
  }, [adminForm, currentUser, loadAdminUsers]);

  const handleAppointmentStatusChange = useCallback(async (appointmentId: string, status: string) => {
    try {
      const response = await updateAppointmentStatus(appointmentId, status);
      if (!response.success) throw new Error(response.error || 'Unable to update appointment.');
      await loadDashboardRecords();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update appointment.');
    }
  }, [loadDashboardRecords]);

  const handleToggleUser = useCallback(async (userId: string, isActive: boolean) => {
    try {
      setAdminBusy(true);
      const response = await updateUserStatus(userId, isActive);
      if (!response.success) throw new Error(response.error || 'Unable to update user.');
      await loadAdminUsers();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Unable to update user.');
    } finally {
      setAdminBusy(false);
    }
  }, [loadAdminUsers]);

  const handleDeleteUser = useCallback(async (userId: string) => {
    if (!window.confirm('Delete this user permanently?')) return;

    try {
      setAdminBusy(true);
      await deleteUserAccount(userId);
      await loadAdminUsers();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete user.');
    } finally {
      setAdminBusy(false);
    }
  }, [loadAdminUsers]);

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

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center shadow-2xl">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-fuchsia-500 border-t-transparent" />
          <p className="text-lg font-black">Loading Phadam WhatsApp</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#3b0764_0%,_#111827_35%,_#020617_100%)] px-4 py-8 text-white">
        <div className="w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/80 p-7 shadow-2xl backdrop-blur-xl">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-fuchsia-500 via-violet-500 to-cyan-400 text-3xl font-black shadow-lg">
              P
            </div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">Phadam WhatsApp</p>
            <h1 className="mt-3 text-3xl font-black tracking-tight">You are not logged in.</h1>
            <p className="mt-2 text-sm text-slate-300">Please log in to access the hospital dashboard.</p>
          </div>

          <label className="mb-4 block text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              value={loginForm.email}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none ring-0 placeholder:text-slate-500 focus:border-violet-400"
              placeholder="name@phadam.com"
            />
          </label>

          <label className="mb-5 block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={loginForm.password}
              onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-white outline-none placeholder:text-slate-500 focus:border-violet-400"
              placeholder="••••••••"
            />
          </label>

          {authError && (
            <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void handleLogin()}
            className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-600 via-violet-600 to-cyan-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/30 transition hover:scale-[1.01]"
          >
            Log in to dashboard
          </button>

        </div>
      </div>
    );
  }

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
              {currentUser.name}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-2 text-[11px] font-bold text-emerald-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Online
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-bold text-slate-100 hover:bg-white/10"
          >
            Log out
          </button>
        </div>
      </header>
    );
  };

  const renderMobileBottomNavigation = () => (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-slate-950/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-10px_35px_rgba(15,23,42,0.25)] backdrop-blur-xl md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-4 gap-2">
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
          onClick={() => handleTabChange('adminAppointments')}
          className={`flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-bold transition ${
            activeTab === 'adminAppointments'
              ? 'bg-gradient-to-br from-slate-700 to-cyan-700 text-white shadow-lg shadow-cyan-500/30'
              : 'text-slate-400 hover:bg-white/10'
          }`}
        >
          <span className="text-lg">🗂️</span>
          <span>Follow-ups</span>
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
            isSuperAdmin={currentUser?.role === 'SUPER_ADMIN'}
          />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {renderMobileHeader()}

          <div className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur md:px-6">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-violet-500">Operations</p>
              <h2 className="text-base font-black text-slate-800">{currentUser.name}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void unlockNotificationAudio();
                  void requestNotificationPermission();
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                Enable alerts
              </button>

              <button
                type="button"
                onClick={handleLogout}
                className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white hover:bg-slate-700"
              >
                Log out
              </button>
            </div>
          </div>

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
                        staffMembers={adminUsers
                          .filter((user) => user.role !== 'SUPER_ADMIN' && user.isActive)
                          .map((user) => user.name)}
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
                <AppointmentTable appointments={appointments} onStatusChange={handleAppointmentStatusChange} />
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

                <div className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-900 text-xs uppercase tracking-wider text-white">
                        <tr>
                          <th className="px-5 py-4">Patient</th>
                          <th className="px-5 py-4">Phone</th>
                          <th className="px-5 py-4">Chat</th>
                          <th className="px-5 py-4">Appointments</th>
                          <th className="px-5 py-4">Assigned staff</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {patients.map((patient) => (
                          <tr key={patient.id} className="hover:bg-slate-50">
                            <td className="px-5 py-4 font-black text-slate-800">{patient.fullName || 'Name not provided'}</td>
                            <td className="px-5 py-4 text-slate-600">{patient.phoneNumber}</td>
                            <td className="px-5 py-4 text-slate-600">{patient.chatStatus.replaceAll('_', ' ')}</td>
                            <td className="px-5 py-4 text-slate-600">{patient.appointmentCount}</td>
                            <td className="px-5 py-4 text-slate-600">{patient.assignedTo || 'Awaiting staff'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {patients.length === 0 && (
                    <p className="p-8 text-center text-sm text-slate-500">No patient records yet. New WhatsApp patients will appear here automatically.</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {activeTab === 'adminAppointments' && (
            <AdminAppointmentsPage
              appointments={appointments}
              reminders={adminReminders}
              onChanged={loadDashboardRecords}
            />
          )}

          {activeTab === 'admin' && currentUser?.role === 'SUPER_ADMIN' && (
            <section className="min-h-0 flex-1 overflow-y-auto p-4 pb-28 md:p-8">
              <div className="mx-auto max-w-5xl space-y-6">
                <div className="rounded-[2rem] bg-gradient-to-br from-slate-900 via-violet-900 to-fuchsia-800 p-6 text-white shadow-2xl">
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-200">Super admin</p>
                  <h2 className="mt-3 text-3xl font-black">User management</h2>
                  <p className="mt-2 max-w-xl text-sm text-violet-100">
                    Create staff, admin, or super admin accounts so the hospital team can access the WhatsApp workspace.
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                    <h3 className="text-xl font-black text-slate-800">Add a user</h3>

                    <div className="mt-5 space-y-4">
                      <label className="block text-sm font-medium text-slate-700">
                        Full name
                        <input
                          value={adminForm.name}
                          onChange={(event) => setAdminForm((prev) => ({ ...prev, name: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-400"
                          placeholder="Jane Doe"
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Email
                        <input
                          type="email"
                          value={adminForm.email}
                          onChange={(event) => setAdminForm((prev) => ({ ...prev, email: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-400"
                          placeholder="user@phadam.com"
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Password
                        <input
                          type="password"
                          value={adminForm.password}
                          onChange={(event) => setAdminForm((prev) => ({ ...prev, password: event.target.value }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-400"
                          placeholder="Set password"
                        />
                      </label>

                      <label className="block text-sm font-medium text-slate-700">
                        Role
                        <select
                          value={adminForm.role}
                          onChange={(event) => setAdminForm((prev) => ({ ...prev, role: event.target.value as 'SUPER_ADMIN' | 'ADMIN' | 'STAFF' }))}
                          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-violet-400"
                        >
                          <option value="STAFF">Staff</option>
                          <option value="ADMIN">Admin</option>
                          <option value="SUPER_ADMIN">Super admin</option>
                        </select>
                      </label>

                      <button
                        type="button"
                        onClick={() => void handleCreateUser()}
                        disabled={adminBusy}
                        className="w-full rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {adminBusy ? 'Creating user...' : 'Create user'}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
                    <h3 className="text-xl font-black text-slate-800">Existing users</h3>
                    <div className="mt-5 space-y-3">
                      {adminUsers.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                          No users have been added yet.
                        </div>
                      ) : (
                        adminUsers.map((user) => (
                          <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="font-black text-slate-800">{user.name}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                              <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-violet-700">
                                {user.role}
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className={`text-xs font-bold ${user.isActive ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {user.isActive ? 'Active access' : 'Access deactivated'}
                              </span>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={adminBusy || user.id === currentUser.id}
                                  onClick={() => void handleToggleUser(user.id, !user.isActive)}
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {user.isActive ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  disabled={adminBusy || user.id === currentUser.id}
                                  onClick={() => void handleDeleteUser(user.id)}
                                  className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
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