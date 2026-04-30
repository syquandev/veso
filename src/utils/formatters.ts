/**
 * Formats a number for display with Vietnamese thousands separator
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('vi-VN');
}

/**
 * Format date for display in Vietnamese locale
 */
export function formatDateVN(dateString: string): string {
  return new Date(dateString).toLocaleDateString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Get short day name in Vietnamese
 */
export function getDayNameVN(dayOfWeek: number): string {
  const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  return names[dayOfWeek] || '';
}

/**
 * Pad a number string to 2 digits
 */
export function padNumber(num: string | number): string {
  return String(num).padStart(2, '0').slice(-2);
}
