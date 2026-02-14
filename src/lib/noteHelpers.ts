import { toast as sonnerToast } from 'sonner';

export const calculateAge = (dob: string): string => {
  if (!dob) return '[age]';
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return '[age]';
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return Number.isFinite(age) ? age.toString() : '[age]';
};

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

export const generateResidentInfoBlock = (
  name: string,
  age: string,
  gender: string,
  unit: string,
  room: string,
): string => `${name} is ${age !== '[age]' ? `a ${age} year old` : 'a'} ${gender} residing in ${unit || '[unit]'}, Room ${room || '[room]'}.`;

export const copyToClipboardWithToast = async (
  text: string,
  successTitle?: string,
  successDescription?: string,
): Promise<void> => {
  try {
    await navigator.clipboard.writeText(text);
    sonnerToast.success(successTitle || 'Copied to clipboard!', {
      description: successDescription || 'Paste into your EMR documentation.',
    });
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    sonnerToast.error('Copy failed', {
      description: 'Please try copying manually.',
    });
  }
};
