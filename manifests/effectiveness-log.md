# Effectiveness Log

## 2026-04-27
- Updated standard crossword print layout so the grid stays in the left half of the sheet while the right half holds side-by-side Across/Down clue columns above a larger word bank. Raised standard print font floors and ceilings so Mandarin clues and word-bank entries remain readable after 2-up scaling.
- Moved the standard crossword word bank to a full-width bottom band and raised its autosize range again so individual words print larger in the 2-up workflow.
- Fixed the curriculum Level / Book dropdown to use the existing natural-sorted curriculum book list instead of raw object-key order, so numbered grades display in human order.
- Added a default Random curriculum load mode with a 10-30 word-count control. Each Load click samples fresh word/clue pairs from across all weeks in the selected book.
- Prevented standard crossword word-bank length labels from being orphaned at the end of a line by wrapping before the label unless at least one matching word can share that line.
