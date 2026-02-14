import { useEffect, useState } from 'react';
import { copyToClipboardWithToast } from '@/lib/noteHelpers';

interface UseClinicalNoteOptions {
  generateNote: () => string;
  dependencies: unknown[];
  autoGenerate?: boolean;
}

interface UseClinicalNoteReturn {
  generatedNote: string;
  setGeneratedNote: (note: string) => void;
  handleCopyNote: () => Promise<void>;
  regenerateNote: () => void;
}

export const useClinicalNote = ({
  generateNote,
  dependencies,
  autoGenerate = true,
}: UseClinicalNoteOptions): UseClinicalNoteReturn => {
  const [generatedNote, setGeneratedNote] = useState('');

  useEffect(() => {
    if (!autoGenerate) return;
    setGeneratedNote(generateNote());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate, ...dependencies]);

  const handleCopyNote = async () => {
    await copyToClipboardWithToast(
      generatedNote,
      'Progress note copied to clipboard!',
      'Paste into your EMR documentation.',
    );
  };

  const regenerateNote = () => {
    setGeneratedNote(generateNote());
  };

  return {
    generatedNote,
    setGeneratedNote,
    handleCopyNote,
    regenerateNote,
  };
};
