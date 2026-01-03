import { Grid, PlacedWord, WordInput, Direction, GenerationResult } from '../types';

export class CrosswordGenerator {
  private gridSize: number;
  private grid: (string | null)[][];

  constructor(gridSize: number) {
    this.gridSize = gridSize;
    this.grid = Array(gridSize).fill(null).map(() => Array(gridSize).fill(null));
  }

  // Check if cell is within bounds
  private isValid(r: number, c: number): boolean {
    return r >= 0 && r < this.gridSize && c >= 0 && c < this.gridSize;
  }

  // Check if cell is empty
  private isEmpty(r: number, c: number): boolean {
    return this.isValid(r, c) && this.grid[r][c] === null;
  }

  // Can we place a word at (row, col) in direction?
  private canPlaceWord(word: string, row: number, col: number, direction: Direction): boolean {
    // 0. Basic Bounds check for start position
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return false;

    // 1. Full Bounds check
    if (direction === 'across') {
      if (col + word.length > this.gridSize) return false;
      // Check cell before word
      if (this.isValid(row, col - 1) && !this.isEmpty(row, col - 1)) return false;
      // Check cell after word
      if (this.isValid(row, col + word.length) && !this.isEmpty(row, col + word.length)) return false;
    } else {
      if (row + word.length > this.gridSize) return false;
      // Check cell before word
      if (this.isValid(row - 1, col) && !this.isEmpty(row - 1, col)) return false;
      // Check cell after word
      if (this.isValid(row + word.length, col) && !this.isEmpty(row + word.length, col)) return false;
    }

    // 2. Intersection and Collision check
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      
      // Safety check for r/c (though bounds check above covers most, this is for inside loop)
      if (!this.isValid(r, c)) return false;

      const cellChar = this.grid[r][c];

      if (cellChar === null) {
        // If cell is empty, we must ensure perpendicular neighbors are empty 
        // (unless we are crossing existing valid words, but simplified logic: 
        // prevent placing adjacent to other words unless strictly crossing)
        if (direction === 'across') {
          if ((this.isValid(r - 1, c) && !this.isEmpty(r - 1, c)) || 
              (this.isValid(r + 1, c) && !this.isEmpty(r + 1, c))) {
            return false;
          }
        } else {
          if ((this.isValid(r, c - 1) && !this.isEmpty(r, c - 1)) || 
              (this.isValid(r, c + 1) && !this.isEmpty(r, c + 1))) {
            return false;
          }
        }
      } else if (cellChar !== word[i]) {
        // Collision with mismatching character
        return false;
      }
    }

    return true;
  }

  private placeWord(word: string, row: number, col: number, direction: Direction) {
    for (let i = 0; i < word.length; i++) {
      const r = direction === 'across' ? row : row + i;
      const c = direction === 'across' ? col + i : col;
      this.grid[r][c] = word[i];
    }
  }

  public generate(inputs: WordInput[]): GenerationResult {
    // Reset grid
    this.grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));

    let sortedInputs: WordInput[] = [];
    const unusedWords: string[] = [];

    // Logic: Pick a RANDOM word to be the center anchor, then try to fit the rest (sorted by length for best packing)
    if (inputs.length > 0) {
        const randIndex = Math.floor(Math.random() * inputs.length);
        const anchor = inputs[randIndex];
        
        // The rest of the words are sorted by length (descending) to maximize fit chance
        const rest = inputs.filter((_, i) => i !== randIndex);
        rest.sort((a, b) => b.word.length - a.word.length);
        
        sortedInputs = [anchor, ...rest];
    } else {
        // Return empty grid
        const emptyGrid: Grid = Array(this.gridSize).fill(null).map(() => 
            Array(this.gridSize).fill(null).map(() => ({
                char: '',
                isActive: false
            }))
        );
        return { grid: emptyGrid, placedWords: [], unusedWords: [], gridSize: this.gridSize };
    }

    const placedWords: PlacedWord[] = [];

    // Place first word in the middle
    const first = sortedInputs[0];
    const startRow = Math.floor((this.gridSize - 1) / 2);
    const startCol = Math.floor((this.gridSize - first.word.length) / 2);
    
    // Check if first word even fits
    if (first.word.length > this.gridSize) {
        // Fallback: If random word is too long, we fail it.
         unusedWords.push(...sortedInputs.map(w => w.word));
          const emptyGrid: Grid = Array(this.gridSize).fill(null).map(() => 
            Array(this.gridSize).fill(null).map(() => ({
                char: '',
                isActive: false
            }))
        );
         return { grid: emptyGrid, placedWords: [], unusedWords, gridSize: this.gridSize };
    }

    // Validate start position for first word
    if (this.canPlaceWord(first.word, startRow, startCol, 'across')) {
        this.placeWord(first.word, startRow, startCol, 'across');
        placedWords.push({ ...first, row: startRow, col: startCol, direction: 'across', number: 0 });
    } else {
        unusedWords.push(first.word);
    }

    // Try to place remaining words
    for (let i = 1; i < sortedInputs.length; i++) {
      const current = sortedInputs[i];
      let placed = false;

      // Try to intersect with existing placed words
      outerLoop:
      for (const placedWord of placedWords) {
        // Iterate through characters of the placed word
        for (let j = 0; j < placedWord.word.length; j++) {
            const placedChar = placedWord.word[j];
            const intersectRow = placedWord.direction === 'across' ? placedWord.row : placedWord.row + j;
            const intersectCol = placedWord.direction === 'across' ? placedWord.col + j : placedWord.col;

            // Find this char in current word
            for (let k = 0; k < current.word.length; k++) {
                if (current.word[k] === placedChar) {
                    const tryDir: Direction = placedWord.direction === 'across' ? 'down' : 'across';
                    const tryRow = tryDir === 'down' ? intersectRow - k : intersectRow;
                    const tryCol = tryDir === 'across' ? intersectCol - k : intersectCol;

                    if (this.canPlaceWord(current.word, tryRow, tryCol, tryDir)) {
                        this.placeWord(current.word, tryRow, tryCol, tryDir);
                        placedWords.push({ ...current, row: tryRow, col: tryCol, direction: tryDir, number: 0 });
                        placed = true;
                        break outerLoop;
                    }
                }
            }
        }
      }

      if (!placed) {
        unusedWords.push(current.word);
      }
    }

    // Post-processing: Assign numbers
    const startPositions = new Map<string, number>();
    let counter = 1;

    const allStarts = placedWords.map(w => ({ r: w.row, c: w.col }));
    allStarts.sort((a, b) => (a.r === b.r ? a.c - b.c : a.r - b.r));
    
    for (const pos of allStarts) {
        const key = `${pos.r},${pos.c}`;
        if (!startPositions.has(key)) {
            startPositions.set(key, counter++);
        }
    }

    const finalPlacedWords = placedWords.map(w => ({
        ...w,
        number: startPositions.get(`${w.row},${w.col}`) || 0
    }));

    // Construct final grid for UI
    const finalGrid: Grid = Array(this.gridSize).fill(null).map((_, r) => 
        Array(this.gridSize).fill(null).map((_, c) => {
            const char = this.grid[r][c];
            const key = `${r},${c}`;
            return {
                char: char || '',
                isActive: char !== null,
                number: startPositions.get(key)
            };
        })
    );

    return {
        grid: finalGrid,
        placedWords: finalPlacedWords,
        unusedWords,
        gridSize: this.gridSize
    };
  }
}