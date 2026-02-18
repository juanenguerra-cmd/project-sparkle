export function getInfluenzaSeasonForDate(input?: string | Date): string {
  const d = input ? new Date(input) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth() + 1;

  if (month >= 8) {
    return `${year}-${year + 1}`;
  }

  return `${year - 1}-${year}`;
}
