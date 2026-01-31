import { Request } from 'express';

export interface RequestWithId extends Request {
  requestId?: string;
}

export interface ErrorResponse {
  code: string;
  message: string;
  request_id?: string;
  details?: any;
}

export enum Severity {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
}

export enum IncidentStatus {
  OPEN = 'OPEN',
  ACK = 'ACK',
  RESOLVED = 'RESOLVED',
}

export enum EventType {
  CREATED = 'CREATED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  COMMENTED = 'COMMENTED',
}

export const STATUS_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.OPEN]: [IncidentStatus.ACK, IncidentStatus.RESOLVED],
  [IncidentStatus.ACK]: [IncidentStatus.RESOLVED],
  [IncidentStatus.RESOLVED]: [],
};
