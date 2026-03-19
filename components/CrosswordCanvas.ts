import { Grid, PlacedWord } from '../types';

export type CrosswordMode = 'standard' | 'deduction' | 'nonogram';

// Helper to find intersecting cells
const getIntersections = (placedWords: PlacedWord[]) => {
  const counts: Record<string, number> = {};
  
  placedWords.forEach(w => {
    for(let i=0; i<w.word.length; i++) {
      const r = w.direction === 'across' ? w.row : w.row + i;
      const c = w.direction === 'across' ? w.col + i : w.col;
      const key = `${r},${c}`;
      counts[key] = (counts[key] || 0) + 1;
    }
  });

  const intersections = new Set<string>();
  Object.entries(counts).forEach(([key, count]) => {
      if (count > 1) intersections.add(key);
  });
  return intersections;
};

// Helper to parse clue
const parseClue = (fullClue: string) => {
    const regex = /^([a-z]{1,5}\.)\s*:?\s*(.*)/i;
    const match = fullClue.match(regex);
    if (match) {
        return { pos: match[1].toLowerCase(), definition: match[2] };
    }
    return { pos: null, definition: fullClue };
};

export const drawCrossword = (
  canvas: HTMLCanvasElement,
  grid: Grid,
  size: number,
  placedWords: PlacedWord[],
  mode: CrosswordMode = 'standard',
  cellSize: number = 40
) => {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = size * cellSize;
  const height = size * cellSize;
  const intersections = getIntersections(placedWords);

  // Handle High DPI displays for crisp rendering
  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.scale(dpr, dpr);

  // Background (White)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;

  // Compute bounding rect for nonogram preview
  let minR = size, maxR = -1, minC = size, maxC = -1;
  if (mode === 'nonogram') {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c].isActive) {
          if (r < minR) minR = r;
          if (r > maxR) maxR = r;
          if (c < minC) minC = c;
          if (c > maxC) maxC = c;
        }
      }
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = grid[r][c];
      const x = c * cellSize;
      const y = r * cellSize;
      const key = `${r},${c}`;

      if (mode === 'nonogram') {
        // Show bounding rectangle: white for letter cells, gray for dead space
        const inBounds = r >= minR && r <= maxR && c >= minC && c <= maxC;
        if (inBounds) {
          ctx.fillStyle = cell.isActive ? '#FFFFFF' : '#333333';
          ctx.fillRect(x, y, cellSize, cellSize);
          ctx.strokeStyle = '#000000';
          ctx.strokeRect(x, y, cellSize, cellSize);
        }
      } else if (cell.isActive) {
        // Active cell is white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, cellSize, cellSize);

        // Border
        ctx.strokeStyle = '#000000';
        ctx.strokeRect(x, y, cellSize, cellSize);

        // Logic for Mode: Standard vs Deduction
        if (mode === 'standard') {
            // Standard: Show Numbers
            if (cell.number) {
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${Math.floor(cellSize * 0.35)}px sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                ctx.fillText(`${cell.number}`, x + 2, y + 2);
            }
        } else {
            // Deduction: Hide Numbers, Reveal Intersections
            if (intersections.has(key)) {
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${Math.floor(cellSize * 0.65)}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(cell.char, x + cellSize/2, y + cellSize/2 + 2);
            }
        }
      }
    }
  }
};

// Helper to draw rounded rectangle
const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.fill();
};

// Helper to split text into lines
const getWrappedLines = (
    ctx: CanvasRenderingContext2D, 
    text: string, 
    maxWidth: number,
    firstLineWidth?: number
): string[] => {
    const lines: string[] = [];
    let line = '';
    // If firstLineWidth is provided, use it for the first line, then switch to maxWidth
    let currentMaxWidth = firstLineWidth !== undefined ? firstLineWidth : maxWidth;

    // Split by words to respect word boundaries
    const words = text.split(' ');

    for (let n = 0; n < words.length; n++) {
        const word = words[n];
        // Add space if line isn't empty
        const testLine = line + (line === '' ? '' : ' ') + word;
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;

        if (testWidth > currentMaxWidth && line !== '') {
            lines.push(line);
            line = word; // Start new line with current word
            
            // IMPORTANT: Once we wrap, all subsequent lines use the full maxWidth
            currentMaxWidth = maxWidth; 
        } else {
            line = testLine;
        }
    }
    lines.push(line);
    return lines;
}

// Internal function to create the high-res puzzle canvas (A4 Landscape)
const createHighResCanvas = (
    grid: Grid, 
    placedWords: PlacedWord[], 
    gridSize: number, 
    showSolution: boolean = false,
    title: string = 'Crossword Puzzle',
    mode: CrosswordMode = 'standard'
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // Fixed A4 Landscape at 300 DPI
    const WIDTH = 3508;
    const HEIGHT = 2480;
    
    // Increased base padding for better print margins (approx 0.4 inch)
    const PADDING = 120; 
    
    const intersections = getIntersections(placedWords);

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    // Fill White Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // --- Student Header (Name & Date) ---
    ctx.fillStyle = '#000000';
    ctx.font = '60px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('Name: _______________________________________', PADDING, PADDING + 50);
    ctx.textAlign = 'right';
    ctx.fillText('Date: ____________________', WIDTH - PADDING, PADDING + 50);

    // --- Title ---
    const titleY = PADDING + 120;
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayTitle = showSolution ? `${title} (Solution)` : title;
    ctx.fillText(displayTitle, WIDTH / 2, titleY);

    // --- Layout Calculations ---
    const contentTop = titleY + 160; 
    const contentBottom = HEIGHT - PADDING;
    const contentHeight = contentBottom - contentTop;
    const contentWidth = WIDTH - (PADDING * 2);
    
    // Split into Grid (Left) and Clues (Right)
    // Adjusted ratio to 50/50 to give Clues more room
    const gridAreaWidth = contentWidth * 0.50;
    
    // START OF CLUES COLUMN
    const cluesStartX = PADDING + gridAreaWidth + (contentWidth * 0.05); // 5% gap
    
    // --- STRICT RIGHT MARGIN CALCULATION ---
    // Increased buffer significantly to 200px (approx 0.66 inch)
    // Total margin from edge = PADDING (120) + EXTRA (200) = 320px (~1 inch)
    const EXTRA_RIGHT_BUFFER = 200; 
    const ABSOLUTE_CLUE_RIGHT_LIMIT = WIDTH - PADDING - EXTRA_RIGHT_BUFFER;

    // THIS IS THE CONSTANT WIDTH USED FOR ALL TEXT WRAPPING
    const MAX_CLUE_WIDTH = ABSOLUTE_CLUE_RIGHT_LIMIT - cluesStartX;

    // --- Draw Grid ---
    const maxCellWidth = gridAreaWidth / gridSize;
    const maxCellHeight = contentHeight / gridSize;
    const cellSize = Math.min(maxCellWidth, maxCellHeight);
    const gridTotalHeight = cellSize * gridSize;
    const gridStartY = contentTop + (contentHeight - gridTotalHeight) / 2;

    ctx.lineWidth = 4;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    if (mode !== 'nonogram') {
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                const cell = grid[r][c];
                const x = PADDING + c * cellSize;
                const y = gridStartY + r * cellSize;
                const key = `${r},${c}`;

                if (cell.isActive) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(x, y, cellSize, cellSize);
                    ctx.strokeStyle = '#000000';
                    ctx.strokeRect(x, y, cellSize, cellSize);

                    if (mode === 'standard') {
                        if (cell.number) {
                            ctx.fillStyle = '#000000';
                            ctx.font = `bold ${Math.floor(cellSize * 0.38)}px sans-serif`;
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'top';
                            ctx.fillText(`${cell.number}`, x + 5, y + 5);
                        }
                    } else {
                         if (!showSolution && intersections.has(key)) {
                            ctx.fillStyle = '#000000';
                            ctx.font = `bold ${Math.floor(cellSize * 0.65)}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'middle';
                            ctx.fillText(cell.char, x + cellSize/2, y + cellSize/2 + 5);
                         }
                    }

                    if (showSolution) {
                        ctx.fillStyle = '#2563EB';
                        ctx.font = `bold ${Math.floor(cellSize * 0.65)}px sans-serif`;
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(cell.char, x + cellSize/2, y + cellSize/2 + 5);
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'top';
                    }
                }
            }
        }
    }

    // --- NONOGRAM: Grid + Row/Column Clues ---
    if (mode === 'nonogram') {
        const VOWELS = new Set(['A', 'E', 'I', 'O', 'U', 'Y']);

        // Bounding rectangle of all placed words
        let minRow = gridSize, maxRow = -1, minCol = gridSize, maxCol = -1;
        for (let r = 0; r < gridSize; r++) {
            for (let c = 0; c < gridSize; c++) {
                if (grid[r][c].isActive) {
                    if (r < minRow) minRow = r;
                    if (r > maxRow) maxRow = r;
                    if (c < minCol) minCol = c;
                    if (c > maxCol) maxCol = c;
                }
            }
        }
        const boundRows = maxRow - minRow + 1;
        const boundCols = maxCol - minCol + 1;

        // Consonant / vowel counts per row
        const rowCounts: Array<{ c: number; v: number }> = [];
        for (let r = 0; r < boundRows; r++) {
            let vc = 0, vv = 0;
            for (let c2 = 0; c2 < boundCols; c2++) {
                const cell = grid[minRow + r][minCol + c2];
                if (cell.isActive) { VOWELS.has(cell.char) ? vv++ : vc++; }
            }
            rowCounts.push({ c: vc, v: vv });
        }

        // Consonant / vowel counts per column
        const colCounts: Array<{ c: number; v: number }> = [];
        for (let c2 = 0; c2 < boundCols; c2++) {
            let vc = 0, vv = 0;
            for (let r = 0; r < boundRows; r++) {
                const cell = grid[minRow + r][minCol + c2];
                if (cell.isActive) { VOWELS.has(cell.char) ? vv++ : vc++; }
            }
            colCounts.push({ c: vc, v: vv });
        }

        // Layout: reserve top of content area for the legend (3 lines: title, English note, Mandarin note)
        const LEGEND_H = 260;
        const LEGEND_GAP = 40;
        const nonoContentTop = contentTop + LEGEND_H + LEGEND_GAP;
        const nonoAvailH = contentBottom - nonoContentTop;

        // Cell size that fits bounding rect + clue margins
        // Row clue zone = 1.5 cell widths left of grid
        // Column clue zone = 1.9 cell heights above grid (2 rows × 0.95)
        const nonoCellSize = Math.min(
            gridAreaWidth / (boundCols + 1.5),
            nonoAvailH / (boundRows + 1.9)
        );

        const rowClueW   = nonoCellSize * 1.5;
        const colClueH   = nonoCellSize * 0.95;
        const DIVIDER_GAP = 20;

        const nonoGridLeft = PADDING + rowClueW;
        const nonoGridTop  = nonoContentTop + 2 * colClueH + DIVIDER_GAP;
        const halfRowClue  = rowClueW / 2;

        const clueNumSize   = Math.floor(nonoCellSize * 0.58);
        const clueLabelSize = Math.floor(nonoCellSize * 0.52);
        const legendSize    = Math.floor(nonoCellSize * 0.54);
        const noteSize      = Math.floor(nonoCellSize * 0.44);

        // --- Legend: line 1 ---
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${legendSize}px sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText('V = Vowel / 母音          C = Consonant / 子音', PADDING, contentTop);

        // --- Legend: line 2 + 3 — Y disclaimer (English then Mandarin) ---
        ctx.font = `italic ${noteSize}px sans-serif`;
        ctx.fillStyle = '#444444';
        ctx.fillText('Note: Y is always counted as a vowel in this puzzle.', PADDING, contentTop + legendSize * 1.4);
        ctx.fillText('注意：本題中 Y 視為母音。', PADDING, contentTop + legendSize * 1.4 + noteSize * 1.4);

        // --- Column clue rows (above the grid) ---
        const colC_Y = nonoContentTop + colClueH * 0.5;
        const colV_Y = nonoContentTop + colClueH * 1.5;

        // Row 1: "C:" only — labels the column-C clue row (reads right)
        // Row 2: "C" over the consonant row-clue column (reads down) +
        //        "V" at the right edge — labels both the column-V clue row (right) and the V row-clue column (down)
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${clueLabelSize}px sans-serif`;
        ctx.textBaseline = 'middle';

        ctx.textAlign = 'right';
        ctx.fillText('C:', nonoGridLeft - 18, colC_Y);

        ctx.textAlign = 'center';
        ctx.fillText('C', PADDING + halfRowClue * 0.5, colV_Y);

        ctx.textAlign = 'right';
        ctx.fillText('V', nonoGridLeft - 18, colV_Y);

        // Column count numbers
        ctx.font = `bold ${clueNumSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let c2 = 0; c2 < boundCols; c2++) {
            const cx = nonoGridLeft + c2 * nonoCellSize + nonoCellSize / 2;
            ctx.fillText(`${colCounts[c2].c}`, cx, colC_Y);
            ctx.fillText(`${colCounts[c2].v}`, cx, colV_Y);
        }

        // Divider line above the grid
        ctx.strokeStyle = '#AAAAAA';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(nonoGridLeft, nonoGridTop - DIVIDER_GAP / 2);
        ctx.lineTo(nonoGridLeft + boundCols * nonoCellSize, nonoGridTop - DIVIDER_GAP / 2);
        ctx.stroke();

        // --- Grid cells (bounding rectangle) ---
        ctx.lineWidth = 4;
        for (let r = 0; r < boundRows; r++) {
            for (let c2 = 0; c2 < boundCols; c2++) {
                const cell = grid[minRow + r][minCol + c2];
                const x = nonoGridLeft + c2 * nonoCellSize;
                const y = nonoGridTop  + r  * nonoCellSize;
                ctx.fillStyle = cell.isActive ? '#FFFFFF' : '#333333';
                ctx.fillRect(x, y, nonoCellSize, nonoCellSize);
                ctx.strokeStyle = '#000000';
                ctx.strokeRect(x, y, nonoCellSize, nonoCellSize);
            }
        }

        // --- Solution letters ---
        if (showSolution) {
            ctx.font = `bold ${Math.floor(nonoCellSize * 0.65)}px sans-serif`;
            ctx.fillStyle = '#2563EB';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            for (let r = 0; r < boundRows; r++) {
                for (let c2 = 0; c2 < boundCols; c2++) {
                    const cell = grid[minRow + r][minCol + c2];
                    if (cell.isActive) {
                        ctx.fillText(
                            cell.char,
                            nonoGridLeft + c2 * nonoCellSize + nonoCellSize / 2,
                            nonoGridTop  + r  * nonoCellSize + nonoCellSize / 2 + 5
                        );
                    }
                }
            }
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
        }

        // --- Row clue numbers (left of grid) ---
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${clueNumSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        for (let r = 0; r < boundRows; r++) {
            const cy = nonoGridTop + r * nonoCellSize + nonoCellSize / 2;
            ctx.fillText(`${rowCounts[r].c}`, PADDING + halfRowClue * 0.5, cy);
            ctx.fillText(`${rowCounts[r].v}`, PADDING + halfRowClue * 1.5, cy);
        }
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
    }

    // --- Right Column Content (Clues or Word Bank) ---
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const availableHeight = contentHeight;
    const MAX_FONT_SIZE = 70;
    const MIN_FONT_SIZE = 22;

    // --- MODE 1: STANDARD (Clues) ---
    if (mode === 'standard') {
        const across = placedWords.filter(w => w.direction === 'across').sort((a, b) => a.number - b.number);
        const down = placedWords.filter(w => w.direction === 'down').sort((a, b) => a.number - b.number);

        // Store optimal config
        let optimalConfig = {
            baseSize: MIN_FONT_SIZE,
            clueFont: `${MIN_FONT_SIZE}px sans-serif`,
            badgeFont: `${Math.floor(MIN_FONT_SIZE * 0.85)}px sans-serif`,
            headerFont: `bold ${Math.floor(MIN_FONT_SIZE * 1.3)}px sans-serif`,
            lineHeight: MIN_FONT_SIZE * 1.25,
            paragraphSpacing: MIN_FONT_SIZE * 0.5,
            sectionSpacing: MIN_FONT_SIZE * 1.5,
            headerHeight: MIN_FONT_SIZE * 2.0
        };

        // Iterative Sizing
        for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size--) {
            const lineHeight = size * 1.25;
            const paragraphSpacing = size * 0.5;
            const headerHeight = size * 2.0;
            const sectionSpacing = size * 1.5;
            const badgeFontSize = Math.floor(size * 0.85);
            
            ctx.font = `${size}px sans-serif`; 
            let currentH = 0;
            
            // Measure Function (Auto-Sizer)
            // MUST use MAX_CLUE_WIDTH exactly like the renderer
            const measureList = (list: PlacedWord[]) => {
                let h = 0;
                if (list.length > 0) {
                    h += headerHeight;
                    for (const w of list) {
                        const { pos, definition } = parseClue(w.clue);
                        
                        // Estimate prefix width for sizing check
                        const numberWidth = ctx.measureText(`${w.number}.`).width;
                        let prefixPixels = numberWidth + 15; 
                        
                        if (pos) {
                            ctx.save();
                            ctx.font = `500 ${badgeFontSize}px sans-serif`; 
                            const badgeWidth = ctx.measureText(pos).width + 20; 
                            prefixPixels += badgeWidth + 10; 
                            ctx.restore();
                        }
                        
                        // Strict First Line Available Width
                        // If prefix > max width, we have 0 space (edge case)
                        const firstLineAvailable = Math.max(0, MAX_CLUE_WIDTH - prefixPixels);

                        // Wrap
                        const lines = getWrappedLines(ctx, definition, MAX_CLUE_WIDTH, firstLineAvailable);
                        h += (lines.length * lineHeight) + paragraphSpacing;
                    }
                }
                return h;
            };

            currentH += measureList(across);
            if (across.length > 0 && down.length > 0) currentH += sectionSpacing;
            currentH += measureList(down);

            if (currentH <= availableHeight) {
                optimalConfig = {
                    baseSize: size,
                    clueFont: `${size}px sans-serif`,
                    badgeFont: `500 ${Math.floor(size * 0.85)}px sans-serif`,
                    headerFont: `bold ${Math.floor(size * 1.3)}px sans-serif`,
                    lineHeight,
                    paragraphSpacing,
                    sectionSpacing,
                    headerHeight
                };
                break;
            }
        }

        // DRAW FUNCTION FOR CLUES
        const drawClueSection = (list: PlacedWord[], startY: number) => {
            let y = startY;

            for (const w of list) {
                const { pos, definition } = parseClue(w.clue);

                // 2. Draw Number
                ctx.fillStyle = '#000000';
                ctx.font = `bold ${optimalConfig.clueFont}`; 
                
                const numberText = `${w.number}.`;
                ctx.fillText(numberText, cluesStartX, y);
                
                const numberWidth = ctx.measureText(numberText).width;
                let currentX = cluesStartX + numberWidth + 8; 

                // 3. Draw Badge (Strict Logic)
                if (pos) {
                    const badgeFontSize = Math.floor(optimalConfig.baseSize * 0.85);
                    ctx.font = `500 ${badgeFontSize}px sans-serif`;
                    
                    const badgePaddingX = 6;
                    const badgePaddingY = 4;
                    const metrics = ctx.measureText(pos);
                    const badgeWidth = metrics.width + (badgePaddingX * 2);
                    const badgeHeight = badgeFontSize + (badgePaddingY * 2); 
                    
                    ctx.fillStyle = '#E5E7EB'; // gray-200
                    drawRoundedRect(ctx, currentX, y - 2, badgeWidth, badgeHeight, 4);

                    ctx.fillStyle = '#374151'; // gray-700
                    ctx.fillText(pos, currentX + badgePaddingX, y);

                    currentX += badgeWidth + 10; 
                }

                // 4. Draw Definition (Strictly Black)
                ctx.fillStyle = '#000000'; 
                ctx.font = optimalConfig.clueFont;
                
                // --- STRICT RENDERER MATH ---
                // Calculate exactly how much space is left on the first line
                // relative to the MAX_CLUE_WIDTH
                // We know MAX_CLUE_WIDTH ends at ABSOLUTE_CLUE_RIGHT_LIMIT
                
                const usedPrefixWidth = currentX - cluesStartX;
                const spaceRemainingOnFirstLine = Math.max(0, MAX_CLUE_WIDTH - usedPrefixWidth);
                
                // Wrap text.
                // It is CRITICAL that we pass MAX_CLUE_WIDTH as the standard width
                // and spaceRemainingOnFirstLine as the first line width.
                const lines = getWrappedLines(ctx, definition, MAX_CLUE_WIDTH, spaceRemainingOnFirstLine);

                // Draw first line
                if (lines.length > 0) {
                    ctx.fillText(lines[0], currentX, y);
                }

                // Draw subsequent lines
                for (let i = 1; i < lines.length; i++) {
                    y += optimalConfig.lineHeight;
                    // Subsequent lines start at cluesStartX
                    ctx.fillText(lines[i], cluesStartX, y);
                }

                y += optimalConfig.lineHeight + optimalConfig.paragraphSpacing;
            }
            return y;
        };

        // Execute Drawing
        let currentY = contentTop;
        
        if (across.length > 0) {
            ctx.font = optimalConfig.headerFont;
            ctx.fillStyle = '#000000';
            ctx.fillText('ACROSS', cluesStartX, currentY);
            currentY += optimalConfig.headerHeight;
            
            currentY = drawClueSection(across, currentY);
        }

        if (across.length > 0 && down.length > 0) {
            currentY += optimalConfig.sectionSpacing;
        }

        if (down.length > 0) {
            ctx.font = optimalConfig.headerFont;
            ctx.fillStyle = '#000000';
            ctx.fillText('DOWN', cluesStartX, currentY);
            currentY += optimalConfig.headerHeight;

            currentY = drawClueSection(down, currentY);
        }
    } 
    
    // --- MODE 2: DEDUCTION / NONOGRAM (Word Bank) ---
    // Right-anchored: text is right-aligned to the right margin.
    // Column left edge is capped at page center (WIDTH / 2) so it never bleeds into the grid area.
    else {
        const wordBankX        = ABSOLUTE_CLUE_RIGHT_LIMIT;
        const wordBankMaxWidth = ABSOLUTE_CLUE_RIGHT_LIMIT - WIDTH / 2;

        // Group words by length
        const byLength: Record<number, string[]> = {};
        placedWords.forEach(w => {
            const len = w.word.length;
            if (!byLength[len]) byLength[len] = [];
            byLength[len].push(w.word);
        });

        const lengths = Object.keys(byLength).map(Number).sort((a, b) => a - b);

        let optimalConfig = {
            wordFont: `${MIN_FONT_SIZE}px sans-serif`,
            headerFont: `bold ${Math.floor(MIN_FONT_SIZE * 1.3)}px sans-serif`,
            lineHeight: MIN_FONT_SIZE * 1.5,
            sectionSpacing: MIN_FONT_SIZE * 2.0,
            headerHeight: MIN_FONT_SIZE * 2.0
        };

        for (let size = MAX_FONT_SIZE; size >= MIN_FONT_SIZE; size--) {
            const lineHeight = size * 1.5;
            const headerHeight = size * 2.0;
            const sectionSpacing = size * 1.5;

            ctx.font = `${size}px sans-serif`;
            let currentH = 0;

            for (const len of lengths) {
                currentH += headerHeight;
                const wordsText = byLength[len].join(', ');
                const lines = getWrappedLines(ctx, wordsText, wordBankMaxWidth);
                currentH += (lines.length * lineHeight);
                currentH += sectionSpacing;
            }

            if (currentH <= availableHeight) {
                optimalConfig = {
                    wordFont: `${size}px sans-serif`,
                    headerFont: `bold ${Math.floor(size * 1.3)}px sans-serif`,
                    lineHeight,
                    sectionSpacing,
                    headerHeight
                };
                break;
            }
        }

        ctx.textAlign = 'right';
        let currentY = contentTop;

        for (const len of lengths) {
            ctx.font = optimalConfig.headerFont;
            ctx.fillText(`${len} LETTERS`, wordBankX, currentY);
            currentY += optimalConfig.headerHeight;

            ctx.font = optimalConfig.wordFont;
            const wordsText = byLength[len].join(', ');
            const lines = getWrappedLines(ctx, wordsText, wordBankMaxWidth);

            for (const line of lines) {
                ctx.fillText(line, wordBankX, currentY);
                currentY += optimalConfig.lineHeight;
            }

            currentY += optimalConfig.sectionSpacing;
        }
        ctx.textAlign = 'left';
    }
    
    return canvas;
};

// Helper to trigger download from a canvas element
const triggerDownload = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

export const downloadSinglePage = (
    grid: Grid, 
    placedWords: PlacedWord[], 
    gridSize: number, 
    filename: string,
    showSolution: boolean,
    title: string,
    mode: CrosswordMode
) => {
    const canvas = createHighResCanvas(grid, placedWords, gridSize, showSolution, title, mode);
    triggerDownload(canvas, filename);
};

export const download2UpPage = (
    grid: Grid, 
    placedWords: PlacedWord[], 
    gridSize: number, 
    filename: string,
    showSolution: boolean,
    title: string,
    mode: CrosswordMode
) => {
    // 1. Generate the Source Canvas (A4 Landscape)
    const srcCanvas = createHighResCanvas(grid, placedWords, gridSize, showSolution, title, mode);

    // 2. Create Destination Canvas (A4 Portrait)
    const destCanvas = document.createElement('canvas');
    const ctx = destCanvas.getContext('2d');
    if (!ctx) return;

    // A4 Portrait Dimensions (300 DPI)
    // Width: 2480, Height: 3508
    const DEST_W = 2480;
    const DEST_H = 3508;
    const HALF_H = DEST_H / 2;

    destCanvas.width = DEST_W;
    destCanvas.height = DEST_H;

    // Fill White
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, DEST_W, DEST_H);

    // 3. Draw Top Half
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, DEST_W, HALF_H);

    // 4. Draw Bottom Half
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, HALF_H, DEST_W, HALF_H);

    // 5. Draw Cut Line
    ctx.beginPath();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]); // Dashed line
    ctx.moveTo(0, HALF_H);
    ctx.lineTo(DEST_W, HALF_H);
    ctx.stroke();

    // 6. Download
    triggerDownload(destCanvas, filename);
};

export const downloadCanvas = (canvas: HTMLCanvasElement, filename: string = 'crossword.png') => {
    triggerDownload(canvas, filename);
};