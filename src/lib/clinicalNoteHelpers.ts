import { addAudit, loadDB, saveDB } from '@/lib/database';
import { nowISO } from '@/lib/parsers';
import { ClinicalNote } from '@/lib/types';

export const generateNoteId = (): string => `note_${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const saveClinicalNote = (
  type: ClinicalNote['type'] | string,
  mrn: string,
  residentName: string,
  noteText: string,
  noteDate: string,
  author: string,
  relatedRecordId?: string,
): string => {
  const currentDb = loadDB();
  const now = nowISO();

  const noteRecord: ClinicalNote = {
    id: generateNoteId(),
    type: type as ClinicalNote['type'],
    mrn,
    residentName,
    related_record_id: relatedRecordId,
    note_text: noteText,
    note_date: noteDate,
    author,
    createdAt: now,
    updated_at: now,
  };

  currentDb.records.notes.unshift(noteRecord);
  saveDB(currentDb);

  return noteRecord.id;
};

export const createAuditEntry = (
  action: string,
  description: string,
  entityType: 'census' | 'abt' | 'ip' | 'vax' | 'notes' | 'settings' | 'export' | 'import' | 'abx',
): void => {
  const currentDb = loadDB();
  addAudit(currentDb, action, description, entityType);
  saveDB(currentDb);
};

export const saveClinicalNoteWithAudit = (
  type: ClinicalNote['type'] | string,
  mrn: string,
  residentName: string,
  noteText: string,
  noteDate: string,
  author: string,
  auditAction: string,
  auditDescription: string,
  entityType: 'census' | 'abt' | 'ip' | 'vax' | 'notes' | 'settings' | 'export' | 'import' | 'abx',
  relatedRecordId?: string,
): string => {
  const noteId = saveClinicalNote(type, mrn, residentName, noteText, noteDate, author, relatedRecordId);
  createAuditEntry(auditAction, auditDescription, entityType);
  return noteId;
};
