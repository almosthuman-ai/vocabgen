
import { TicTacResult, TicTacGrid, TicTacCell, TicTacDifficulty } from '../types';

interface ProcessedWord {
  word: string;
  len: number;
  start: string;
  end: string;
  pos: string | null;
}

export class TicTacGenerator {

  // Helper to extract POS from clue (e.g. "n. A person..." -> "n.")
  private getPOS(clue: string): string | null {
    const match = clue.match(/^([a-z]{1,4}\.)/i);
    return match ? match[1].toLowerCase() : null;
  }

  // Pre-process word list into analysable objects
  private processInput(words: string[], clues: string[]): ProcessedWord[] {
    return words.map((w, i) => {
      const cleanWord = w.toUpperCase().trim();
      if (!cleanWord) return null;
      return {
        word: cleanWord,
        len: cleanWord.length,
        start: cleanWord[0],
        end: cleanWord[cleanWord.length - 1],
        pos: clues[i] ? this.getPOS(clues[i]) : null
      };
    }).filter((w): w is ProcessedWord => w !== null);
  }

  // Generate a single 3x3 grid
  private generateGrid(id: number, pool: ProcessedWord[], difficulty: TicTacDifficulty): TicTacGrid {
    const cells: TicTacCell[] = [];
    
    // We need 9 constraints. 
    // We define a "Constraint Generator" based on difficulty
    
    // 1. Identify valid constraints for this specific pool of words
    const validConstraints = this.getConstraintPool(pool, difficulty);
    
    // 2. Select 9 constraints (with logic for Center box in Easy mode)
    // We shuffle the valid constraints to ensure uniqueness between grids
    const shuffled = [...validConstraints].sort(() => Math.random() - 0.5);

    // Fill 9 cells
    for (let i = 0; i < 9; i++) {
        // Fallback: If we run out of unique constraints, wrap around or just pick random
        const constraintObj = shuffled[i % shuffled.length];
        cells.push(constraintObj);
    }

    // Special logic for Easy Mode Center Box (Index 4)
    if (difficulty === 'easy') {
        const maxLen = Math.max(...pool.map(w => w.len));
        // Find constraint for max len
        const maxLenConstraint = validConstraints.find(c => c.constraint === maxLen.toString());
        if (maxLenConstraint) {
            cells[4] = maxLenConstraint;
        }
    }

    return { id, cells };
  }

  private getConstraintPool(words: ProcessedWord[], difficulty: TicTacDifficulty): TicTacCell[] {
    const constraints: Map<string, string[]> = new Map();

    const add = (key: string, word: string) => {
        if (!constraints.has(key)) constraints.set(key, []);
        constraints.get(key)?.push(word);
    };

    words.forEach(w => {
        // --- EASY: Lengths ---
        if (difficulty === 'easy') {
            add(w.len.toString(), w.word);
        }

        // --- MEDIUM: POS & Single Letters ---
        if (difficulty === 'medium') {
            if (w.pos) add(w.pos, w.word);
            add(`${w.start}___`, w.word); // Start
            add(`___${w.end}`, w.word); // End
            // Fallback: also add lengths if pool is small
            add(w.len.toString(), w.word); 
        }

        // --- HARD: Combinations ---
        if (difficulty === 'hard') {
            // POS + Length (e.g. "n. + 5")
            if (w.pos) {
                add(`${w.pos} + ${w.len}`, w.word);
                // POS + Start
                add(`${w.pos} + ${w.start}___`, w.word);
            } else {
                // If no POS, use Length + Start
                add(`${w.len} + ${w.start}___`, w.word);
            }
            
            // Start + End (e.g. "A___E")
            add(`${w.start}___${w.end}`, w.word);

            // Also include Medium constraints to ensure we have enough volume
            add(`${w.start}___`, w.word);
            add(`___${w.end}`, w.word);
            if (w.pos) add(w.pos, w.word);
        }
    });

    // Convert Map to Array
    return Array.from(constraints.entries()).map(([text, matches]) => ({
        constraint: text,
        matchingWords: matches
    }));
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
        grids.push(this.generateGrid(i, processed, difficulty));
    }

    return {
        grids,
        success: true,
        difficulty
    };
  }
}
