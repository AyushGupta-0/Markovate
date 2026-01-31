import { IncidentStatus, STATUS_TRANSITIONS } from '../types';
import { AppError } from '../middlewares/errorHandler';

export function validateStatusTransition(
  currentStatus: IncidentStatus,
  newStatus: IncidentStatus
): void {
  if (currentStatus === newStatus) {
    return; // Idempotent - same status is allowed
  }

  const allowedTransitions = STATUS_TRANSITIONS[currentStatus];

  if (!allowedTransitions.includes(newStatus)) {
    throw new AppError(
      400,
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from ${currentStatus} to ${newStatus}`,
      {
        current_status: currentStatus,
        attempted_status: newStatus,
        allowed_transitions: allowedTransitions,
      }
    );
  }
}
