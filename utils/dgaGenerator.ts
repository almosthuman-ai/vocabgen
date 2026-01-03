
import { DGAResult, DGAClue } from '../types';

type ConstraintType = 'START_1' | 'START_2' | 'START_3' | 'END_1' | 'END_2' | 'END_3';

interface DGAConstraint {
  type: ConstraintType;
  char: string;
  visual: string;
  targetWord: string;
  overlapScore: number; // How many words in the TOTAL bank match this constraint
}

export class DGAGenerator {

  private getChar(word: string, type: ConstraintType): string | null {
    const len = word.length;
    switch (type) {
      case 'START_1': return len >= 1 ? word[0] : null;
      case 'START_2': return len >= 2 ? word[1] : null;
      case 'START_3': return len >= 3 ? word[2] : null;
      case 'END_1': return len >= 1 ? word[len - 1] : null;
      case 'END_2': return len >= 2 ? word[len - 2] : null;
      case 'END_3': return len >= 3 ? word[len - 3] : null;
    }
    return null;
  }

  // Generates the visual syntax requested: "L ____________" or "____________ L"
  // Using a fixed long line to ensure length ambiguity is maintained visually where appropriate,
  // focusing the student on the revealed letter position relative to start/end.
  private getVisual(type: ConstraintType, char: string): string {
    const LINE = "________________"; 
    switch (type) {
      case 'START_1': return `${char} ${LINE}`;
      case 'START_2': return `_ ${char} ${LINE}`;
      case 'START_3': return `_ _ ${char} ${LINE}`;
      case 'END_1': return `${LINE} ${char}`;
      case 'END_2': return `${LINE} ${char} _`;
      case 'END_3': return `${LINE} ${char} _ _`;
    }
    return "";
  }

  // Does the candidate word satisfy the constraint?
  private matches(constraint: DGAConstraint, candidateWord: string): boolean {
    const charAtPos = this.getChar(candidateWord, constraint.type);
    return charAtPos === constraint.char;
  }

  // Validator: Can this set of constraints be solved one by one without deadlock?
  private validateSolvability(constraints: DGAConstraint[], allWords: string[]): boolean {
    let remainingWords = [...allWords];
    let remainingConstraints = [...constraints];

    // Simulation Loop
    while (remainingWords.length > 0) {
      let foundStep = false;

      // Look for a constraint that maps to EXACTLY ONE word in the remaining set
      for (let i = 0; i < remainingConstraints.length; i++) {
        const c = remainingConstraints[i];
        
        // Find all candidates in the REMAINING list that match this visual clue
        const matches = remainingWords.filter(w => this.matches(c, w));

        if (matches.length === 1) {
          // Unique deduction found!
          // Ideally, matches[0] should be c.targetWord. 
          // If the puzzle is valid, it MUST be.
          const solvedWord = matches[0];
          
          // Execute Step
          remainingWords = remainingWords.filter(w => w !== solvedWord);
          remainingConstraints.splice(i, 1); // Remove this clue as "solved"
          foundStep = true;
          break; // Restart loop to see if this unlocks new deductions
        }
      }

      if (!foundStep) {
        // Deadlock: We have words left, but no clue uniquely identifies a single one.
        // This happens if e.g. "HOME" and "HOUSE" remain, and we only have "H_______" clues left.
        return false;
      }
    }

    return true;
  }

  public generate(wordList: string[], limit: number = 10): DGAResult {
    // 1. Sanitize
    const words = wordList.map(w => w.toUpperCase().trim()).filter(w => w.length > 0);
    let uniqueWords = Array.from(new Set(words));

    // Limit to subset if requested
    if (uniqueWords.length > limit) {
        uniqueWords = uniqueWords.sort(() => Math.random() - 0.5).slice(0, limit);
    }

    if (uniqueWords.length < 3) {
      return { clues: [], wordBank: uniqueWords, success: false, message: "Please provide at least 3 words." };
    }

    // 2. Map All Possible Constraints
    const allConstraints: DGAConstraint[] = [];
    const types: ConstraintType[] = ['START_1', 'START_2', 'START_3', 'END_1', 'END_2', 'END_3'];

    // Pre-calculate every possible valid constraint for every word
    uniqueWords.forEach(word => {
      types.forEach(type => {
        const char = this.getChar(word, type);
        if (char) {
          // Calculate Overlap Score (Step 2)
          // How many words in the FULL list share this feature?
          let score = 0;
          uniqueWords.forEach(w => {
            if (this.getChar(w, type) === char) score++;
          });

          allConstraints.push({
            type,
            char,
            visual: this.getVisual(type, char),
            targetWord: word,
            overlapScore: score
          });
        }
      });
    });

    // Calculate maximum possible ambiguity for this specific list
    // (If the user provides words with NO overlap, we can't force 3 ambiguous clues)
    const ambiguousConstraints = allConstraints.filter(c => c.overlapScore >= 2);
    const maxAmbiguousAvailable = ambiguousConstraints.length;
    const TARGET_AMBIGUOUS_COUNT = Math.min(3, maxAmbiguousAvailable);

    if (TARGET_AMBIGUOUS_COUNT < 3) {
      // Just a warning in the console, but we proceed with best effort
      console.warn("Word list has low overlap; cannot generate 3 ambiguous clues.");
    }

    // 3. Generator Loop (Quota System)
    const MAX_ATTEMPTS = 500;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const selectedConstraints: DGAConstraint[] = [];
      const usedWords = new Set<string>();
      
      // Shuffle words to randomize which word gets which clue type
      const shuffledWords = [...uniqueWords].sort(() => Math.random() - 0.5);

      // To track our ambiguity quota
      let currentAmbiguousCount = 0;

      // Selection Pass
      for (const word of shuffledWords) {
        // Get all valid constraints for this specific word
        const options = allConstraints.filter(c => c.targetWord === word);
        
        if (options.length === 0) continue; // Should not happen for valid words

        let chosen: DGAConstraint | null = null;

        // Phase A: Force Ambiguity
        // We prioritize high-score clues if we haven't met the quota
        if (currentAmbiguousCount < TARGET_AMBIGUOUS_COUNT) {
          const highOverlap = options.filter(c => c.overlapScore >= 2);
          if (highOverlap.length > 0) {
            chosen = highOverlap[Math.floor(Math.random() * highOverlap.length)];
          }
        }

        // Phase B: Fill Remainder (Solvability)
        // If we have met quota (or couldn't find high overlap), prefer Unique Constraints (Score 1)
        // to act as anchors.
        if (!chosen) {
          const uniqueOptions = options.filter(c => c.overlapScore === 1);
          if (uniqueOptions.length > 0) {
            chosen = uniqueOptions[Math.floor(Math.random() * uniqueOptions.length)];
          } else {
            // Fallback: Pick any if no unique ones exist (rare, but happens in dense lists)
            chosen = options[Math.floor(Math.random() * options.length)];
          }
        }

        if (chosen) {
          selectedConstraints.push(chosen);
          if (chosen.overlapScore >= 2) currentAmbiguousCount++;
          usedWords.add(word);
        }
      }

      // Check if we missed any words (rare safety check)
      if (usedWords.size !== uniqueWords.length) continue;

      // Check Quota Final
      if (currentAmbiguousCount < TARGET_AMBIGUOUS_COUNT) continue;

      // 4. Validator (Deadlock Prevention)
      if (this.validateSolvability(selectedConstraints, uniqueWords)) {
        
        // Success! Format Output
        // Shuffle clues so ID doesn't reveal order
        const shuffledClues = selectedConstraints.map((c, i) => {
           // Find all matching words for this constraint to enable "Work" visualization
           const matches = uniqueWords.filter(w => this.matches(c, w)).sort();
           
           return {
               id: 0,
               word: c.targetWord,
               displayText: c.visual,
               isAmbiguous: c.overlapScore > 1,
               matchingWords: matches
           };
        });

        // Fisher-Yates Shuffle
        for (let i = shuffledClues.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledClues[i], shuffledClues[j]] = [shuffledClues[j], shuffledClues[i]];
        }
        
        // Assign IDs
        shuffledClues.forEach((c, i) => c.id = i + 1);

        return {
          clues: shuffledClues,
          wordBank: [...uniqueWords].sort(),
          success: true
        };
      }
    }

    return {
      clues: [],
      wordBank: uniqueWords,
      success: false,
      message: `Could not generate a deductive path for the selected subset. Try regenerating to pick a different set of words.`
    };
  }
}
