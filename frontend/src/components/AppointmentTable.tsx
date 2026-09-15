import React, {
  useCallback,
  useEffect,
  useState,
} from 'react';

export type Appointment = {
  id: string;
  patientId?: string;
  patientPhone?: string;
  patientName?: string | null;
  specialty: string;
  doctorName: string;
  slotTime: string;
  status: string;
  createdAt?: string;
  servicePrice?: string;
  consultationFee?: string;
};

type AppointmentTableProps = {
  appointments?: Appointment[];
  apiUrl?: string;
  refreshInterval?: number;
  onStatusChange?: (appointmentId: string, status: string) => void | Promise<void>;
};

type AppointmentApiResponse =
  | Appointment[]
  | {
      appointments?: Appointment[];
      data?: Appointment[];
    };

const DEFAULT_API_URL =
  import.meta.env.VITE_API_URL || 'http://localhost:5000';

const statusStyles: Record<
  string,
  {
    label: string;
    className: string;
  }
> = {
  CONFIRMED: {
    label: 'Confirmed',
    className: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  },
  PENDING: {
    label: 'Pending',
    className: 'bg-amber-100 text-amber-700 ring-amber-200',
  },
  CANCELLED: {
    label: 'Cancelled',
    className: 'bg-rose-100 text-rose-700 ring-rose-200',
  },
  COMPLETED: {
    label: 'Completed',
    className: 'bg-blue-100 text-blue-700 ring-blue-200',
  },
  RESCHEDULED: {
    label: 'Rescheduled',
    className: 'bg-violet-100 text-violet-700 ring-violet-200',
  },
};

function getStatusStyle(status: string) {
  const normalizedStatus = status.toUpperCase();

  return (
    statusStyles[normalizedStatus] || {
      label: status || 'Unknown',
      className: 'bg-slate-100 text-slate-600 ring-slate-200',
    }
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return {
      date: 'Invalid date',
      time: '',
    };
  }

  return {
    date: date.toLocaleDateString('en-KE', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

function getAppointmentsFromResponse(
  response: AppointmentApiResponse,
): Appointment[] {
  if (Array.isArray(response)) {
    return response;
  }

  if (Array.isArray(response.appointments)) {
    return response.appointments;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  return [];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message.includes('Failed to fetch')) {
      return 'The appointment server is unavailable. Please check that the backend is running.';
    }

    return error.message;
  }

  return 'Unable to load appointments.';
}

export const AppointmentTable: React.FC<
  AppointmentTableProps
> = ({
  appointments: initialAppointments,
  apiUrl = DEFAULT_API_URL,
  refreshInterval = 30_000,
  onStatusChange,
}) => {
  const [appointments, setAppointments] = useState<Appointment[]>(
    initialAppointments || [],
  );

  const [isLoading, setIsLoading] = useState(
    initialAppointments === undefined,
  );

  const [error, setError] = useState<string | null>(null);

  const loadAppointments = useCallback(
    async (signal?: AbortSignal) => {
      try {
        setError(null);

        const response = await fetch(
          `${apiUrl}/api/dashboard/appointments`,
          {
            method: 'GET',
            headers: {
              Accept: 'application/json',
            },
            signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            `Appointments request failed with status ${response.status}`,
          );
        }

        const data =
          (await response.json()) as AppointmentApiResponse;

        const nextAppointments =
          getAppointmentsFromResponse(data);

        setAppointments(nextAppointments);
      } catch (requestError) {
        if (
          requestError instanceof DOMException &&
          requestError.name === 'AbortError'
        ) {
          return;
        }

        console.error(
          'Failed to load appointments:',
          requestError,
        );

        setError(getErrorMessage(requestError));
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [apiUrl],
  );

  useEffect(() => {
    if (initialAppointments !== undefined) {
      setAppointments(initialAppointments);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    void loadAppointments(controller.signal);

    const intervalId = window.setInterval(() => {
      void loadAppointments();
    }, refreshInterval);

    return () => {
      controller.abort();
      window.clearInterval(intervalId);
    };
  }, [
    initialAppointments,
    loadAppointments,
    refreshInterval,
  ]);

  const handleRetry = () => {
    setIsLoading(true);
    void loadAppointments();
  };

  return (
    <section className="min-h-0 flex-1 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-blue-700">
              Schedule
            </div>

            <h2 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
              Scheduled appointments
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              Live appointments retrieved from the hospital system.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start rounded-2xl border border-emerald-100 bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm sm:self-auto">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
            Live data
          </div>
        </div>

        {error && (
          <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">
                Could not load appointments
              </p>
              <p className="mt-1 text-xs text-rose-600">
                {error}
              </p>
            </div>

            <button
              type="button"
              onClick={handleRetry}
              className="min-h-11 rounded-xl bg-rose-600 px-4 text-xs font-black text-white transition hover:bg-rose-700"
            >
              Try again
            </button>
          </div>
        )}

        {isLoading ? (
          <LoadingState />
        ) : appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <SummaryCard
                label="Total"
                value={appointments.length}
                icon="📅"
                color="from-violet-500 to-fuchsia-500"
              />

              <SummaryCard
                label="Confirmed"
                value={
                  appointments.filter(
                    (appointment) =>
                      appointment.status.toUpperCase() ===
                      'CONFIRMED',
                  ).length
                }
                icon="✅"
                color="from-emerald-500 to-teal-500"
              />

              <SummaryCard
                label="Pending"
                value={
                  appointments.filter(
                    (appointment) =>
                      appointment.status.toUpperCase() ===
                      'PENDING',
                  ).length
                }
                icon="⏳"
                color="from-amber-400 to-orange-500"
              />
            </div>

            {/* Mobile cards */}
            <div className="space-y-3 md:hidden">
              {appointments.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                />
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-hidden rounded-3xl border border-white/80 bg-white shadow-xl md:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="bg-gradient-to-r from-violet-600 via-fuchsia-600 to-blue-600 text-xs uppercase tracking-wider text-white">
                    <tr>
                      <th className="px-5 py-4 font-black">
                        Patient
                      </th>
                      <th className="px-5 py-4 font-black">
                        Specialty
                      </th>
                      <th className="px-5 py-4 font-black">
                        Doctor
                      </th>
                      <th className="px-5 py-4 font-black">
                        Appointment
                      </th>
                      <th className="px-5 py-4 font-black">
                        Status
                      </th>
                      <th className="px-5 py-4 font-black">
                        Fees
                      </th>
                      <th className="px-5 py-4 font-black">Action</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {appointments.map((appointment) => (
                      <AppointmentRow
                        key={appointment.id}
                        appointment={appointment}
                        onStatusChange={onStatusChange}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
};

type SummaryCardProps = {
  label: string;
  value: number;
  icon: string;
  color: string;
};

const SummaryCard: React.FC<SummaryCardProps> = ({
  label,
  value,
  icon,
  color,
}) => {
  return (
    <div
      className={`rounded-2xl bg-gradient-to-br ${color} p-4 text-white shadow-lg`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
        <span className="text-2xl font-black">{value}</span>
      </div>

      <p className="mt-2 text-xs font-bold text-white/80">
        {label}
      </p>
    </div>
  );
};

type AppointmentRowProps = {
  appointment: Appointment;
  onStatusChange?: (appointmentId: string, status: string) => void | Promise<void>;
};

const AppointmentRow: React.FC<AppointmentRowProps> = ({
  appointment,
  onStatusChange,
}) => {
  const dateTime = formatDateTime(appointment.slotTime);

  return (
    <tr className="transition hover:bg-violet-50/50">
      <td className="px-5 py-4">
        <div>
          <p className="font-black text-slate-800">
            {appointment.patientName ||
              appointment.patientPhone ||
              'Unknown patient'}
          </p>

          {appointment.patientName &&
            appointment.patientPhone && (
              <p className="mt-1 text-xs text-slate-400">
                {appointment.patientPhone}
              </p>
            )}
        </div>
      </td>

      <td className="px-5 py-4 font-medium text-slate-600">
        {appointment.specialty || 'General consultation'}
      </td>

      <td className="px-5 py-4 text-slate-600">
        {appointment.doctorName || 'Not assigned'}
      </td>

      <td className="px-5 py-4">
        <p className="font-bold text-slate-700">
          {dateTime.date}
        </p>
        <p className="mt-1 text-xs text-violet-600">
          {dateTime.time}
        </p>
      </td>

      <td className="px-5 py-4">
        <StatusBadge
          status={appointment.status}
        />
      </td>

      <td className="px-5 py-4 text-xs text-slate-600">
        <p>{appointment.servicePrice || 'KSh 0'}</p>
        <p className="mt-1">Consultation: {appointment.consultationFee || 'KSh 1,000'}</p>
      </td>
      <td className="px-5 py-4">
        {appointment.status.toUpperCase() === 'PENDING' && onStatusChange ? (
          <button
            type="button"
            onClick={() => void onStatusChange(appointment.id, 'CONFIRMED')}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700"
          >
            Confirm
          </button>
        ) : (
          <span className="text-xs text-slate-400">No action</span>
        )}
      </td>
    </tr>
  );
};

type AppointmentCardProps = {
  appointment: Appointment;
};

const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
}) => {
  const dateTime = formatDateTime(appointment.slotTime);

  return (
    <article className="rounded-3xl border border-white/80 bg-white p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-black text-slate-800">
            {appointment.patientName ||
              appointment.patientPhone ||
              'Unknown patient'}
          </p>

          {appointment.patientName &&
            appointment.patientPhone && (
              <p className="mt-1 text-xs text-slate-400">
                {appointment.patientPhone}
              </p>
            )}
        </div>

        <StatusBadge status={appointment.status} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <InfoItem
          label="Specialty"
          value={
            appointment.specialty || 'General consultation'
          }
          icon="🩺"
        />

        <InfoItem
          label="Doctor"
          value={appointment.doctorName || 'Not assigned'}
          icon="👨‍⚕️"
        />

        <InfoItem
          label="Date"
          value={dateTime.date}
          icon="📅"
        />

        <InfoItem
          label="Time"
          value={dateTime.time || 'Not available'}
          icon="⏰"
        />
      </div>
    </article>
  );
};

type InfoItemProps = {
  label: string;
  value: string;
  icon: string;
};

const InfoItem: React.FC<InfoItemProps> = ({
  label,
  value,
  icon,
}) => {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
        {icon} {label}
      </p>

      <p className="mt-1 truncate text-xs font-bold text-slate-700">
        {value}
      </p>
    </div>
  );
};

type StatusBadgeProps = {
  status: string;
};

const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
}) => {
  const style = getStatusStyle(status);

  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${style.className}`}
    >
      {style.label}
    </span>
  );
};

const LoadingState: React.FC = () => {
  return (
    <div className="rounded-3xl border border-white/80 bg-white p-4 shadow-xl sm:p-6">
      <div className="hidden space-y-4 md:block">
        <div className="h-12 animate-pulse rounded-2xl bg-slate-100" />

        {[1, 2, 3, 4, 5].map((item) => (
          <div
            key={item}
            className="h-16 animate-pulse rounded-2xl bg-slate-100"
          />
        ))}
      </div>

      <div className="space-y-3 md:hidden">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="h-40 animate-pulse rounded-3xl bg-slate-100"
          />
        ))}
      </div>
    </div>
  );
};

const EmptyState: React.FC = () => {
  return (
    <div className="rounded-3xl border-2 border-dashed border-slate-200 bg-white/80 px-6 py-14 text-center shadow-lg">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 text-3xl">
        📅
      </div>

      <h3 className="text-lg font-black text-slate-800">
        No appointments found
      </h3>

      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        There are no appointments available in the hospital system
        at the moment.
      </p>
    </div>
  );
};