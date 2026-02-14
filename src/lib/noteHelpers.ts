import { toast as sonnerToast } from 'sonner';

export const formatDate = (dateStr: string): string => {
  if (!dateStr) return '[date]';
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

export const formatDateTime = (date: Date): string => date.toLocaleString('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const copyToClipboardWithToast = async (
  text: string,
  title: string,
  description: string,
) => {
  await navigator.clipboard.writeText(text);
  sonnerToast.success(title, { description });
};
