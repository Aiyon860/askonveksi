import type { AppRole, AttendanceSource, AttendanceStatus } from "@prisma/client";

export type AttendanceSettings = {
  startDate: string;
  checkInTime: string;
  lateToleranceMinutes: number;
  workDays: number[];
  version: number;
};

export type AttendanceEmployeeOption = {
  id: string;
  name: string;
  role: AppRole;
  isActive: boolean;
};

export type ClockInState = {
  ok: boolean;
  message: string | null;
  status?: AttendanceStatus;
  time?: string;
  dateKey?: string;
};

export const INITIAL_CLOCK_IN_STATE: ClockInState = {
  ok: true,
  message: null,
};

export type AttendanceLocationInput = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
};

export type AttendanceTodayRecordView = {
  id: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  note: string | null;
  source: AttendanceSource;
  photoUrl: string | null;
  location: AttendanceLocationView | null;
  corrected: boolean;
};

export type AttendanceLocationView = {
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  recordedAt: string | null;
  mapUrl: string;
};

export type AttendanceCorrectionTarget = {
  id: string;
  employeeName: string;
  dateKey: string;
  dateLabel: string;
  status: AttendanceStatus;
  checkInTime: string | null;
  note: string | null;
  updatedAt: string;
  source: AttendanceSource;
};
