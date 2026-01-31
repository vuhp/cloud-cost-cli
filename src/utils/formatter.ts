export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  
  return formatted;
}

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  // Don't use decimals for bytes
  if (i === 0) {
    return `${bytes} B`;
  }

  const value = bytes / Math.pow(k, i);
  const formatted = decimals === 0 
    ? Math.round(value).toString()
    : value.toFixed(decimals);

  return `${formatted} ${sizes[i]}`;
}

export function formatPercent(value: number, decimals: number = 1): string {
  const percent = value * 100;
  return `${percent.toFixed(decimals)}%`;
}

export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function daysSince(date: Date): number {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
