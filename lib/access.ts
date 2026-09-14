/** 之後要收費的章。現在 canAccess 一律放行，接登入時只改這裡。 */
export const PAID_CHAPTERS = ["HCIE 數通"] as const;

export function isPaidChapter(chapter: string): boolean {
  return (PAID_CHAPTERS as readonly string[]).includes(chapter);
}

export function canAccessChapter(_chapter: string): boolean {
  return true;
}

export function canAccessQuestion(chapter: string): boolean {
  return canAccessChapter(chapter);
}
