import Papa from 'papaparse';

export interface CurriculumWeekData {
  words: string[];
  clues: string[];
}

export type CurriculumData = Record<string, Record<string, CurriculumWeekData>>;

interface CsvRow {
  week?: string;
  word?: string;
  pos?: string;
  clue?: string;
}

const csvModules = import.meta.glob('/src/assets/curricula/*.csv', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const normalize = (value?: string): string => value?.trim() ?? '';

const inferBookName = (path: string): string | null => {
  const match = /\/([^/]+)\.csv$/i.exec(path);
  if (!match) return null;
  const stem = match[1];
  return stem
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const joinClue = (pos: string, clue: string): string => {
  if (pos && clue) return `${pos} : ${clue}`;
  if (pos) return pos;
  return clue;
};

const buildCurriculum = (): CurriculumData => {
  const accumulator: CurriculumData = {};

  for (const [path, raw] of Object.entries(csvModules)) {
    const bookName = inferBookName(path);
    if (!bookName) continue;

    const { data } = Papa.parse<CsvRow>(raw, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => value?.trim?.() ?? value,
    });

    const bookEntry = (accumulator[bookName] ??= {});

    for (const row of data) {
      const week = normalize(row.week);
      const word = normalize(row.word);
      if (!week || !word) continue;

      const weekEntry = (bookEntry[week] ??= { words: [], clues: [] });
      weekEntry.words.push(word);

      const clue = joinClue(normalize(row.pos), normalize(row.clue));
      weekEntry.clues.push(clue);
    }
  }

  return accumulator;
};

export const CURRICULUM: CurriculumData = buildCurriculum();

export const getCurriculumBooks = (): string[] => Object.keys(CURRICULUM);

export const getCurriculum = (): CurriculumData => CURRICULUM;
