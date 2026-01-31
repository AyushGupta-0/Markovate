import { validateStatusTransition } from '../../utils/statusTransition';
import { IncidentStatus } from '../../types';
import { AppError } from '../../middlewares/errorHandler';

describe('Status Transition Rules', () => {
  test('should allow OPEN to ACK transition', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.OPEN, IncidentStatus.ACK);
    }).not.toThrow();
  });

  test('should allow OPEN to RESOLVED transition', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.OPEN, IncidentStatus.RESOLVED);
    }).not.toThrow();
  });

  test('should allow ACK to RESOLVED transition', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.ACK, IncidentStatus.RESOLVED);
    }).not.toThrow();
  });

  test('should reject ACK to OPEN transition', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.ACK, IncidentStatus.OPEN);
    }).toThrow(AppError);
  });

  test('should reject RESOLVED to any status', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.OPEN);
    }).toThrow(AppError);

    expect(() => {
      validateStatusTransition(IncidentStatus.RESOLVED, IncidentStatus.ACK);
    }).toThrow(AppError);
  });

  test('should allow same status (idempotent)', () => {
    expect(() => {
      validateStatusTransition(IncidentStatus.OPEN, IncidentStatus.OPEN);
    }).not.toThrow();

    expect(() => {
      validateStatusTransition(IncidentStatus.ACK, IncidentStatus.ACK);
    }).not.toThrow();
  });
});
