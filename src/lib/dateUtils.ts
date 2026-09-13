/**
 * Formats any ISO string or Date object into Indian Standard Time (IST)
 * Example output: "09 Sep 2026, 10:19 PM IST"
 */
export function formatIST(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  if (isNaN(date.getTime())) return 'Invalid Date';

  const formattedDate = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);

  return `${formattedDate} IST`;
}

/**
 * Returns a short IST time format
 * Example output: "10:19 PM IST"
 */
export function formatISTTimeOnly(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'N/A';

  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;

  if (isNaN(date.getTime())) return 'Invalid Date';

  return (
    new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date) + ' IST'
  );
}
