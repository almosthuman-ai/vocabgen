
export interface WordInput {
  word: string;
  clue: string;
}

export type Direction = 'across' | 'down';

export interface PlacedWord extends WordInput {
  row: number;
  col: number;
  direction: Direction;
  number: number; // The clue number displayed in the grid
}

export interface CellData {
  char: string;
  number?: number;
  isActive: boolean; // True if part of a word
}

export type Grid = CellData[][];

export interface GenerationResult {
  grid: Grid;
  placedWords: PlacedWord[];
  unusedWords: string[];
  gridSize: number;
}

export interface DGAClue {
  id: number;
  word: string; // The target answer
  displayText: string;
  anchorChar: string;
  shortLeadingSlots: number;
  shortTrailingSlots: number;
  infiniteSide: 'leading' | 'trailing';
  infiniteSlotCount: number;
  isAmbiguous: boolean; // True if this clue pattern initially matches >1 word
  matchingWords: string[]; // All words from the bank that fit this clue's constraint
}

export interface DGAResult {
  clues: DGAClue[];
  wordBank: string[];
  success: boolean;
  message?: string;
}

// --- Tic Tac Word Types ---

export type TicTacDifficulty = 'easy' | 'medium' | 'hard';

export interface TicTacCell {
  constraint: string; // The text shown to student (e.g. "n. + 5" or "e___")
  matchingWords: string[]; // Solution words
}

export interface TicTacGrid {
  id: number;
  cells: TicTacCell[]; // Flat array of 9 cells
}

export interface TicTacResult {
  grids: TicTacGrid[];
  success: boolean;
  difficulty: TicTacDifficulty;
}
