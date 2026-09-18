// src/types/dashboard.ts

export type DashboardTab = 'inbox' | 'appointments' | 'patients' | 'adminAppointments' | 'admin';

// Alias 'Tab' to 'DashboardTab' for backwards compatibility across dashboard components
export type Tab = DashboardTab;

export type MessageSender = 'PATIENT' | 'BOT' | 'AGENT' | string;

export type Message = {
  id?: string;
  sender: MessageSender;
  body: string;
  timestamp?: string;
};

export type Chat = {
  id: string;
  phoneNumber?: string;
  fullName?: string | null;
  chats?: string;
  chatStatus?: string;
  assignedTo?: string | null;
  messages?: Message[];
};