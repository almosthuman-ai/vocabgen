
import { TicTacResult, TicTacGrid, TicTacCell, TicTacDifficulty, TicTacConstraintAttributes } from '../types';

interface ProcessedWord {
  word: string;
  len: number;
  start: string;
  end: string;
  pos: string | null;
}

type ConstraintKind =
  | 'length'
  | 'start'
  | 'end'
  | 'pos'
  | 'pos_start'
  | 'pos_end'
  | 'pos_length'
  | 'start_end'
  | 'length_start'
  | 'length_end';

type AmbiguityBand = 'high' | 'medium' | 'low';

interface ConstraintCandidate {
  key: string;
  label: string;
  attributes: TicTacConstraintAttributes;
  kind: ConstraintKind;
  matchingWords: string[];
  ambiguity: number;
  band: AmbiguityBand;
}

interface ConstraintAccumulator {
  key: string;
  label: string;
  attributes: TicTacConstraintAttributes;
  kind: ConstraintKind;
  words: Set<string>;
}

interface DifficultyProfile {
  allowedKinds: ConstraintKind[];
  defaultKindCap: number;
  perKindCap?: Partial<Record<ConstraintKind, number>>;
  bandWeights: Record<AmbiguityBand, number>;
}

const DIFFICULTY_PROFILES: Record<TicTacDifficulty, DifficultyProfile> = {
  easy: {
    allowedKinds: ['length', 'start', 'end'],
    defaultKindCap: 4,
    perKindCap: { length: 5 },
    bandWeights: { high: 4, medium: 2, low: 1 },
  },
  medium: {
    allowedKinds: ['length', 'start', 'end', 'pos', 'pos_start', 'pos_end', 'length_start', 'length_end'],
    defaultKindCap: 3,
    perKindCap: { pos: 4 },
    bandWeights: { high: 3, medium: 4, low: 2 },
  },
  hard: {
    allowedKinds: ['length', 'start', 'end', 'pos', 'pos_start', 'pos_end', 'pos_length', 'start_end', 'length_start', 'length_end'],
    defaultKindCap: 3,
    perKindCap: { pos: 4, start_end: 4 },
    bandWeights: { high: 1, medium: 3, low: 5 },
  },
};

const AMBIGUITY_THRESHOLDS: Record<AmbiguityBand, { min: number; max: number | null }> = {
  high: { min: 4, max: null },
  medium: { min: 2, max: 3 },
  low: { min: 1, max: 1 },
};

const VISUAL_PLACEHOLDER = '_____';

export class TicTacGenerator {

  private static readonly MAX_GRID_ATTEMPTS = 50;
  private static readonly MAX_SELECTION_ATTEMPTS = 120;

  // Helper to extract POS from clue (e.g. "n. A person..." -> "n.")
  private getPOS(clue: string): string | null {
    const match = clue.match(/^([a-z]{1,4}\.)/i);
    return match ? match[1].toLowerCase() : null;
  }

  // Pre-process word list into analysable objects
  private processInput(words: string[], clues: string[]): ProcessedWord[] {
    const seen = new Set<string>();
    const processed: ProcessedWord[] = [];

    words.forEach((rawWord, index) => {
      const cleanWord = rawWord.toUpperCase().trim();
      if (!cleanWord || seen.has(cleanWord)) return;
      seen.add(cleanWord);

      processed.push({
        word: cleanWord,
        len: cleanWord.length,
        start: cleanWord[0],
        end: cleanWord[cleanWord.length - 1],
        pos: clues[index] ? this.getPOS(clues[index]) : null,
      });
    });

    return processed;
  }

  private buildConstraintCandidates(words: ProcessedWord[]): ConstraintCandidate[] {
    const buckets = new Map<string, ConstraintAccumulator>();

    const ensureBucket = (kind: ConstraintKind, attributes: TicTacConstraintAttributes, word: string) => {
      const key = this.buildKey(kind, attributes);
      const label = this.buildLabel(kind, attributes);
      if (!key || !label) return;

      let bucket = buckets.get(key);
      if (!bucket) {
        bucket = {
          key,
          label,
          attributes: this.cloneAttributes(attributes),
          kind,
          words: new Set<string>(),
        };
        buckets.set(key, bucket);
      }
      bucket.words.add(word);
    };

    words.forEach(word => {
      ensureBucket('length', { length: word.len }, word.word);
      ensureBucket('start', { start: word.start }, word.word);
      ensureBucket('end', { end: word.end }, word.word);
      ensureBucket('length_start', { length: word.len, start: word.start }, word.word);
      ensureBucket('length_end', { length: word.len, end: word.end }, word.word);
      ensureBucket('start_end', { start: word.start, end: word.end }, word.word);

      if (word.pos) {
        ensureBucket('pos', { pos: word.pos }, word.word);
        ensureBucket('pos_start', { pos: word.pos, start: word.start }, word.word);
        ensureBucket('pos_end', { pos: word.pos, end: word.end }, word.word);
        ensureBucket('pos_length', { pos: word.pos, length: word.len }, word.word);
      }
    });

    return Array.from(buckets.values()).map(bucket => {
      const matchingWords = Array.from(bucket.words).sort();
      const ambiguity = matchingWords.length;
      const band = this.classifyAmbiguity(ambiguity);

      return {
        key: bucket.key,
        label: bucket.label,
        attributes: bucket.attributes,
        kind: bucket.kind,
        matchingWords,
        ambiguity,
        band,
      };
    });
  }

  private classifyAmbiguity(count: number): AmbiguityBand {
    if (count >= (AMBIGUITY_THRESHOLDS.high.min)) {
      return 'high';
    }
    if (count >= AMBIGUITY_THRESHOLDS.medium.min) {
      return 'medium';
    }
    return 'low';
  }

  private buildKey(kind: ConstraintKind, attributes: TicTacConstraintAttributes): string | null {
    const parts: string[] = [kind];
    if (attributes.pos) parts.push(`pos=${attributes.pos}`);
    if (attributes.length !== undefined) parts.push(`len=${attributes.length}`);
    if (attributes.start) parts.push(`start=${attributes.start}`);
    if (attributes.end) parts.push(`end=${attributes.end}`);
    return parts.join('|');
  }

  private buildLabel(kind: ConstraintKind, attributes: TicTacConstraintAttributes): string | null {
    const visualStart = (start?: string) => (start ? `${start}${VISUAL_PLACEHOLDER}` : null);
    const visualEnd = (end?: string) => (end ? `${VISUAL_PLACEHOLDER}${end}` : null);
    const visualStartEnd = (start?: string, end?: string) =>
      start && end ? `${start}${VISUAL_PLACEHOLDER}${end}` : null;
    const pos = attributes.pos ?? null;
    const lengthLabel = attributes.length !== undefined ? `${attributes.length}` : null;

    switch (kind) {
      case 'length':
        return lengthLabel;
      case 'start':
        return visualStart(attributes.start);
      case 'end':
        return visualEnd(attributes.end);
      case 'pos':
        return pos;
      case 'pos_start':
        return pos && visualStart(attributes.start) ? `${pos} | ${visualStart(attributes.start)}` : null;
      case 'pos_end':
        return pos && visualEnd(attributes.end) ? `${pos} | ${visualEnd(attributes.end)}` : null;
      case 'pos_length':
        return pos && lengthLabel ? `${pos} | ${lengthLabel}` : null;
      case 'start_end':
        return visualStartEnd(attributes.start, attributes.end);
      case 'length_start':
        return lengthLabel && visualStart(attributes.start)
          ? `${lengthLabel} | ${visualStart(attributes.start)}`
          : null;
      case 'length_end':
        return lengthLabel && visualEnd(attributes.end)
          ? `${lengthLabel} | ${visualEnd(attributes.end)}`
          : null;
      default:
        return null;
    }
  }

  private cloneAttributes(attributes: TicTacConstraintAttributes): TicTacConstraintAttributes {
    const clone: TicTacConstraintAttributes = {};
    if (attributes.length !== undefined) clone.length = attributes.length;
    if (attributes.start) clone.start = attributes.start;
    if (attributes.end) clone.end = attributes.end;
    if (attributes.pos) clone.pos = attributes.pos;
    return clone;
  }

  private shuffle<T>(arr: T[]): T[] {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  private pickConstraintSet(
    candidates: ConstraintCandidate[],
    profile: DifficultyProfile,
    selectionAttempt: number
  ): ConstraintCandidate[] | null {
    if (candidates.length < 9) return null;

    const boost = Math.min(3, Math.floor(selectionAttempt / 25));
    const pick: ConstraintCandidate[] = [];
    const kindCounts = new Map<ConstraintKind, number>();
    const coverage = new Set<string>();
    const attemptFactor = selectionAttempt / TicTacGenerator.MAX_SELECTION_ATTEMPTS;

    const weighted = candidates.map(candidate => ({
      candidate,
      weight:
        candidate.ambiguity * 100 +
        (profile.bandWeights[candidate.band] ?? 1) * 60 * Math.max(0.1, 1 - attemptFactor) +
        Math.random(),
    }));

    weighted.sort((a, b) => b.weight - a.weight);

    const ordered = weighted.map(entry => entry.candidate);

    const ensureCap = (kind: ConstraintKind) => {
      const baseCap = profile.perKindCap?.[kind] ?? profile.defaultKindCap;
      return baseCap + boost;
    };

    for (const candidate of ordered) {
      if (pick.length >= 9) break;
      if (pick.some(sel => sel.key === candidate.key)) continue;

      const cap = ensureCap(candidate.kind);
      const currentCount = kindCounts.get(candidate.kind) ?? 0;
      if (currentCount >= cap && pick.length < 9) continue;

      const introducesCoverage = candidate.matchingWords.some(word => !coverage.has(word));
      if (!introducesCoverage && pick.length < 6 && selectionAttempt < 40) continue;

      pick.push(candidate);
      kindCounts.set(candidate.kind, currentCount + 1);
      candidate.matchingWords.forEach(word => coverage.add(word));
    }

    if (pick.length < 9) {
      for (const candidate of ordered) {
        if (pick.length >= 9) break;
        if (pick.some(sel => sel.key === candidate.key)) continue;
        pick.push(candidate);
      }
    }

    return pick.length >= 9 ? pick.slice(0, 9) : null;
  }

  private findDistinctAssignment(
    candidates: ConstraintCandidate[],
    availableWords: Set<string>
  ): Map<string, string> | null {
    const ordered = candidates
      .map(candidate => ({
        candidate,
        options: candidate.matchingWords.filter(word => availableWords.has(word)),
      }))
      .sort((a, b) => a.options.length - b.options.length);

    if (ordered.some(entry => entry.options.length === 0)) return null;

    const used = new Set<string>();
    const assignment = new Map<string, string>();

    const backtrack = (index: number): boolean => {
      if (index >= ordered.length) return true;

      const { candidate, options } = ordered[index];

      const orderedOptions = this.shuffle(options);
      for (const word of orderedOptions) {
        if (used.has(word)) continue;
        used.add(word);
        assignment.set(candidate.key, word);

        if (backtrack(index + 1)) return true;

        used.delete(word);
        assignment.delete(candidate.key);
      }

      return false;
    };

    return backtrack(0) ? assignment : null;
  }

  private materializeCells(
    candidates: ConstraintCandidate[],
    assignment: Map<string, string>
  ): TicTacCell[] {
    return candidates.map(candidate => {
      const sortedMatches = candidate.matchingWords.slice().sort();
      const assigned = assignment.get(candidate.key);
      let matchingWords = sortedMatches;
      if (assigned) {
        matchingWords = [assigned, ...sortedMatches.filter(word => word !== assigned)];
      }

      return {
        key: candidate.key,
        label: candidate.label,
        attributes: this.cloneAttributes(candidate.attributes),
        kind: candidate.kind,
        ambiguity: candidate.ambiguity,
        matchingWords,
      };
    });
  }

  private enforceEasyCenter(cells: TicTacCell[], pool: ProcessedWord[]): void {
    if (cells.length < 9) return;
    const maxLen = Math.max(...pool.map(word => word.len));
    const index = cells.findIndex(cell => cell.attributes.length === maxLen);
    if (index <= -1 || index === 4) return;
    const temp = cells[4];
    cells[4] = cells[index];
    cells[index] = temp;
  }

  private generateGrid(id: number, pool: ProcessedWord[], difficulty: TicTacDifficulty): TicTacGrid | null {
    const profile = DIFFICULTY_PROFILES[difficulty];
    const candidates = this.buildConstraintCandidates(pool).filter(candidate =>
      profile.allowedKinds.includes(candidate.kind)
    );

    if (candidates.length < 9) return null;

    const availableWords = new Set(pool.map(word => word.word));

    for (let attempt = 0; attempt < TicTacGenerator.MAX_GRID_ATTEMPTS; attempt++) {
      const selection = this.pickConstraintSet(
        candidates,
        profile,
        attempt % TicTacGenerator.MAX_SELECTION_ATTEMPTS
      );
      if (!selection || selection.length < 9) continue;

      const assignment = this.findDistinctAssignment(selection, availableWords);
      if (!assignment) continue;

      let cells = this.materializeCells(selection, assignment);
      cells = this.shuffle(cells);

      if (difficulty === 'easy') this.enforceEasyCenter(cells, pool);

      return { id, cells };
    }

    return null;
  }

  public generate(wordList: string[], clueList: string[], difficulty: TicTacDifficulty): TicTacResult {
    const processed = this.processInput(wordList, clueList);

    if (processed.length < 9) {
        return { 
            grids: [], 
            success: false, 
            difficulty 
        };
    }

    const grids: TicTacGrid[] = [];

    // Generate 4 independent grids (reduced from 6 to fit A4)
    for (let i = 0; i < 4; i++) {
        const grid = this.generateGrid(i, processed, difficulty);
        if (!grid) {
          console.warn(
            `[TicTacGenerator] Failed to assemble grid ${i + 1} with difficulty=${difficulty}. ` +
            `Word bank size=${processed.length}. Consider adding more overlapping POS/letter combinations.`
          );
          return {
            grids: [],
            success: false,
            difficulty,
          };
        }
        grids.push(grid);
    }

    return {
        grids,
        success: true,
        difficulty
    };
  }
}
