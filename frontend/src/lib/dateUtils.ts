import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(dateStr: string): string {
  const [datePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTime(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(' ');
  const [y, m, d] = datePart.split('-');
  const time = timePart ? timePart.slice(0, 5) : '00:00';
  return `${d}/${m}/${y} ${time}`;
}

export function formatPeriod(period: string): string {
  const [year, month] = period.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return format(date, 'MMMM/yyyy', { locale: ptBR });
}

export function getCurrentPeriod(): string {
  return format(new Date(), 'yyyy-MM');
}

export function getMonthOptions(count: number = 12): { value: string; label: string }[] {
  const options = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i);
    options.push({
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM/yyyy', { locale: ptBR }),
    });
  }
  return options;
}
