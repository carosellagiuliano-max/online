export type CustomerCancellationStatus =
  | 'reserved'
  | 'requested'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | string;

export type CancellationDisabledReason = 'deadline' | 'not_allowed' | 'status';

export interface CustomerCancellationDecision {
  canCancel: boolean;
  disabledReason?: CancellationDisabledReason;
  hoursUntilAppointment: number;
}

const CUSTOMER_CANCELABLE_STATUSES = new Set(['reserved', 'requested', 'confirmed']);

export function evaluateCustomerCancellation(input: {
  allowCustomerCancellation: boolean;
  cancellationDeadlineHours: number;
  startsAt: Date;
  now?: Date;
  status: CustomerCancellationStatus;
}): CustomerCancellationDecision {
  const now = input.now || new Date();
  const deadlineHours = Math.max(0, input.cancellationDeadlineHours);
  const hoursUntilAppointment = (input.startsAt.getTime() - now.getTime()) / (1000 * 60 * 60);
  const isCancelableStatus = CUSTOMER_CANCELABLE_STATUSES.has(input.status);

  if (!isCancelableStatus) {
    return {
      canCancel: false,
      disabledReason: 'status',
      hoursUntilAppointment,
    };
  }

  if (!input.allowCustomerCancellation) {
    return {
      canCancel: false,
      disabledReason: 'not_allowed',
      hoursUntilAppointment,
    };
  }

  if (hoursUntilAppointment < deadlineHours) {
    return {
      canCancel: false,
      disabledReason: 'deadline',
      hoursUntilAppointment,
    };
  }

  return {
    canCancel: true,
    hoursUntilAppointment,
  };
}

export function getCancellationDeadlineText(deadlineHours: number): string {
  if (deadlineHours === 0) {
    return 'Stornierung ist bis zum Terminbeginn möglich.';
  }

  if (deadlineHours % 24 === 0) {
    const days = deadlineHours / 24;
    return `Stornierung nur bis ${days} ${days === 1 ? 'Tag' : 'Tage'} vor dem Termin möglich.`;
  }

  return `Stornierung nur bis ${deadlineHours} Stunden vor dem Termin möglich.`;
}
