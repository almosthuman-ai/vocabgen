
import { DGAResult, DGAClue } from '../types';

type ConstraintType = 'START_1' | 'START_2' | 'START_3' | 'END_1' | 'END_2' | 'END_3';

interface DGAConstraint {
  type: ConstraintType;
  char: string;
  visual: {
    display: string;
    anchorChar: string;
    shortLeadingSlots: number;
    shortTrailingSlots: number;
    infiniteSide: 'leading' | 'trailing';
    infiniteSlotCount: number;
  };
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
  private getVisual(word: string, type: ConstraintType): DGAConstraint['visual'] {
    const len = word.length;

    const buildIndeterminate = (gap: number) => {
      if (gap >= 2) {
        return { display: '________________', slotCount: 12 };
      }
      if (gap === 1) {
        return { display: '_', slotCount: 1 };
      }
      return { display: '', slotCount: 0 };
    };

    const common = (anchorChar: string, shortLeadingSlots: number, shortTrailingSlots: number, infiniteSide: 'leading' | 'trailing', indeterminateGap: number) => {
      const indeterminate = buildIndeterminate(indeterminateGap);
      const pieces: string[] = [];

      if (infiniteSide === 'leading' && indeterminate.display) pieces.push(indeterminate.display);
      if (shortLeadingSlots > 0) pieces.push(Array(shortLeadingSlots).fill('_').join(' '));
      pieces.push(anchorChar);
      if (shortTrailingSlots > 0) pieces.push(Array(shortTrailingSlots).fill('_').join(' '));
      if (infiniteSide === 'trailing' && indeterminate.display) pieces.push(indeterminate.display);

      const display = pieces.join(' ');

      return {
        display,
        anchorChar,
        shortLeadingSlots,
        shortTrailingSlots,
        infiniteSide,
        infiniteSlotCount: indeterminate.slotCount
      };
    };

    switch (type) {
      case 'START_1':
        return common(word[0], 0, 0, 'trailing', Math.max(0, len - 1));
      case 'START_2':
        return common(word[1], 1, 0, 'trailing', Math.max(0, len - 2));
      case 'START_3':
        return common(word[2], 2, 0, 'trailing', Math.max(0, len - 3));
      case 'END_1':
        return common(word[len - 1], 0, 0, 'leading', Math.max(0, len - 1));
      case 'END_2':
        return common(word[len - 2], 0, 1, 'leading', Math.max(0, len - 2));
      case 'END_3':
        return common(word[len - 3], 0, 2, 'leading', Math.max(0, len - 3));
    }
    return {
      display: word,
      anchorChar: '',
      shortLeadingSlots: 0,
      shortTrailingSlots: 0,
      infiniteSide: 'trailing',
      infiniteSlotCount: 0
    };
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

    if (uniqueWords.length < 6) {
      return { clues: [], wordBank: uniqueWords, success: false, message: "Please provide at least 6 words." };
    }

    // 2. Map All Possible Constraints
    const allConstraints: DGAConstraint[] = [];
    const types: ConstraintType[] = ['START_1', 'START_2', 'START_3', 'END_1', 'END_2', 'END_3'];

    const constraintsByWord = new Map<string, {
      ambiguous: DGAConstraint[];
      unique: DGAConstraint[];
      all: DGAConstraint[];
    }>();

    uniqueWords.forEach(word => {
      constraintsByWord.set(word, { ambiguous: [], unique: [], all: [] });
    });

    const ambiguousBuckets = new Map<string, DGAConstraint[]>();
    const bucketWordMembers = new Map<string, Set<string>>();
    const adjacency = new Map<string, Set<string>>();

    uniqueWords.forEach(word => adjacency.set(word, new Set()));

    const passesLengthRequirement = (type: ConstraintType, length: number): boolean => {
      switch (type) {
        case 'START_3':
        case 'END_3':
          return length >= 5;
        case 'START_2':
        case 'END_2':
          return length >= 4;
        default:
          return true;
      }
    };

    // Pre-calculate every possible valid constraint for every word
    uniqueWords.forEach(word => {
      types.forEach(type => {
        const char = this.getChar(word, type);
        if (char && passesLengthRequirement(type, word.length)) {
          // Calculate Overlap Score (Step 2)
          // How many words in the FULL list share this feature?
          let score = 0;
          uniqueWords.forEach(w => {
            if (this.getChar(w, type) === char) score++;
          });

          allConstraints.push({
            type,
            char,
            visual: this.getVisual(word, type),
            targetWord: word,
            overlapScore: score
          });

          const bucket = constraintsByWord.get(word);
          if (bucket) {
            const constraintRef = allConstraints[allConstraints.length - 1];
            if (score >= 2) {
              bucket.ambiguous.push(constraintRef);
              const bucketKey = `${constraintRef.type}:${constraintRef.char}`;
              if (!ambiguousBuckets.has(bucketKey)) {
                ambiguousBuckets.set(bucketKey, []);
              }
              ambiguousBuckets.get(bucketKey)!.push(constraintRef);
            }
            if (score === 1) bucket.unique.push(constraintRef);
            bucket.all.push(constraintRef);
          }
        }
      });
    });

    ambiguousBuckets.forEach((constraints, key) => {
      const members = new Set<string>(constraints.map(c => c.targetWord));
      bucketWordMembers.set(key, members);
    });

    bucketWordMembers.forEach(members => {
      const wordsInBucket = Array.from(members);
      for (let i = 0; i < wordsInBucket.length; i++) {
        for (let j = i + 1; j < wordsInBucket.length; j++) {
          const first = wordsInBucket[i];
          const second = wordsInBucket[j];
          adjacency.get(first)?.add(second);
          adjacency.get(second)?.add(first);
        }
      }
    });

    const components: string[][] = [];
    const visited = new Set<string>();

    uniqueWords.forEach(word => {
      if (visited.has(word)) return;
      const stack = [word];
      const component: string[] = [];

      while (stack.length > 0) {
        const current = stack.pop()!;
        if (visited.has(current)) continue;
        visited.add(current);
        component.push(current);

        adjacency.get(current)?.forEach(neighbor => {
          if (!visited.has(neighbor)) stack.push(neighbor);
        });
      }

      components.push(component);
    });

    const ambiguousComponents = components
      .filter(component => component.length > 1 && component.some(word => (constraintsByWord.get(word)?.ambiguous.length ?? 0) > 0));

    const componentPotentials = ambiguousComponents.map(component => Math.max(0, component.length - 1));
    const totalAmbiguousPotential = componentPotentials.reduce((sum, val) => sum + val, 0);
    const TARGET_AMBIGUOUS_COUNT = Math.min(3, totalAmbiguousPotential);

    if (totalAmbiguousPotential < 3) {
      console.warn("Word list has low overlap; cannot generate 3 ambiguous clues.");
    }

    const pickRandom = <T>(arr: T[]): T | undefined => {
      if (arr.length === 0) return undefined;
      const idx = Math.floor(Math.random() * arr.length);
      return arr[idx];
    };

    const shuffle = <T>(arr: T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    };

    const chooseFrom = <T>(arr: T[], randomize: boolean): T | undefined => {
      if (arr.length === 0) return undefined;
      if (!randomize) return arr[0];
      return arr[Math.floor(Math.random() * arr.length)];
    };

    const computeForcedAmbiguousSet = (desiredCount: number, randomize: boolean): Set<string> => {
      const forced = new Set<string>();
      if (desiredCount <= 0) return forced;

      const perComponentUsage = new Map<number, number>();
      const candidates: { word: string; componentIndex: number }[] = [];

      ambiguousComponents.forEach((words, index) => {
        if (words.length <= 1) return;
        const wordsCopy = randomize ? shuffle([...words]) : [...words];
        const anchor = wordsCopy.pop();
        if (anchor === undefined) return;
        perComponentUsage.set(index, 0);
        const candidateWords = randomize ? shuffle(wordsCopy) : wordsCopy;
        candidateWords.forEach(word => {
          candidates.push({ word, componentIndex: index });
        });
      });

      const orderedCandidates = randomize ? shuffle(candidates) : candidates;

      for (const entry of orderedCandidates) {
        if (forced.size >= desiredCount) break;
        const limit = (ambiguousComponents[entry.componentIndex]?.length ?? 0) - 1;
        if (limit <= 0) continue;
        const usage = perComponentUsage.get(entry.componentIndex) ?? 0;
        if (usage >= limit) continue;
        forced.add(entry.word);
        perComponentUsage.set(entry.componentIndex, usage + 1);
      }

      return forced;
    };

    const attemptBuild = (forcedSet: Set<string>, requiredAmbiguous: number, randomize: boolean): DGAConstraint[] | null => {
      const selection = new Map<string, DGAConstraint>();

      const pickAmbiguousFor = (word: string): boolean => {
        const bucketInfo = constraintsByWord.get(word);
        if (!bucketInfo || bucketInfo.ambiguous.length === 0) return false;

        const preferred = bucketInfo.ambiguous.filter(constraint => {
          const members = bucketWordMembers.get(`${constraint.type}:${constraint.char}`) ?? new Set<string>();
          for (const member of members) {
            if (member === word) continue;
            if (!forcedSet.has(member)) return true;
          }
          return false;
        });

        const options = preferred.length > 0 ? preferred : bucketInfo.ambiguous;
        const choice = chooseFrom(options, randomize);
        if (!choice) return false;
        selection.set(word, choice);
        return true;
      };

      for (const word of forcedSet) {
        if (!pickAmbiguousFor(word)) return null;
      }

      const orderedWords = randomize ? shuffle([...uniqueWords]) : [...uniqueWords];
      for (const word of orderedWords) {
        if (selection.has(word)) continue;
        const bucketInfo = constraintsByWord.get(word);
        if (!bucketInfo) return null;

        let choice: DGAConstraint | undefined;
        if (bucketInfo.unique.length > 0) {
          choice = chooseFrom(bucketInfo.unique, randomize);
        } else {
          const preferred = bucketInfo.ambiguous.filter(constraint => {
            const members = bucketWordMembers.get(`${constraint.type}:${constraint.char}`) ?? new Set<string>();
            for (const member of members) {
              if (member === word) continue;
              if (!forcedSet.has(member)) return true;
            }
            return false;
          });

          if (preferred.length > 0) {
            choice = chooseFrom(preferred, randomize);
          } else if (bucketInfo.ambiguous.length > 0) {
            choice = chooseFrom(bucketInfo.ambiguous, randomize);
          } else {
            choice = chooseFrom(bucketInfo.all, randomize);
          }
        }

        if (!choice) return null;
        selection.set(word, choice);
      }

      if (selection.size !== uniqueWords.length) return null;

      const selectedConstraints = Array.from(selection.values());
      const ambiguousCount = selectedConstraints.filter(c => c.overlapScore >= 2).length;
      const minimumRequired = Math.min(requiredAmbiguous, forcedSet.size);
      if (ambiguousCount < minimumRequired) return null;

      if (!this.validateSolvability(selectedConstraints, uniqueWords)) {
        return null;
      }

      return selectedConstraints;
    };

    // 3. Generator Loop (Quota System)
    const MAX_ATTEMPTS = 500;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const forcedSet = computeForcedAmbiguousSet(TARGET_AMBIGUOUS_COUNT, true);
      const selectedConstraints = attemptBuild(forcedSet, TARGET_AMBIGUOUS_COUNT, true);

      if (selectedConstraints) {

        // Success! Format Output
        // Shuffle clues so ID doesn't reveal order
        const shuffledClues = selectedConstraints.map((c, i) => {
           // Find all matching words for this constraint to enable "Work" visualization
           const matches = uniqueWords.filter(w => this.matches(c, w)).sort();
           
            return {
               id: 0,
               word: c.targetWord,
               displayText: c.visual.display,
               anchorChar: c.visual.anchorChar,
               shortLeadingSlots: c.visual.shortLeadingSlots,
               shortTrailingSlots: c.visual.shortTrailingSlots,
               infiniteSide: c.visual.infiniteSide,
               infiniteSlotCount: c.visual.infiniteSlotCount,
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

    // Fallback safety mode: degrade overlap requirement until solvable configuration found
    for (let required = TARGET_AMBIGUOUS_COUNT; required >= 0; required--) {
      const forcedSet = computeForcedAmbiguousSet(required, false);
      const fallbackSelection = attemptBuild(forcedSet, required, false);

      if (!fallbackSelection) continue;

      const shuffledClues = fallbackSelection.map((c, i) => {
        const matches = uniqueWords.filter(w => this.matches(c, w)).sort();

        return {
          id: 0,
          word: c.targetWord,
          displayText: c.visual.display,
          anchorChar: c.visual.anchorChar,
          shortLeadingSlots: c.visual.shortLeadingSlots,
          shortTrailingSlots: c.visual.shortTrailingSlots,
          infiniteSide: c.visual.infiniteSide,
          infiniteSlotCount: c.visual.infiniteSlotCount,
          isAmbiguous: c.overlapScore > 1,
          matchingWords: matches
        };
      });

      for (let i = shuffledClues.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledClues[i], shuffledClues[j]] = [shuffledClues[j], shuffledClues[i]];
      }

      shuffledClues.forEach((c, i) => c.id = i + 1);

      return {
        clues: shuffledClues,
        wordBank: [...uniqueWords].sort(),
        success: true
      };
    }

    return {
      clues: [],
      wordBank: uniqueWords,
      success: false,
      message: `Could not generate a deductive path for the selected subset. Try regenerating to pick a different set of words.`
    };
  }
}
