
import { DGAResult } from '../types';

const LINE_SLOT_WIDTH = 32;
const LINE_THICKNESS = 8;

const drawClueIndicator = (
    ctx: CanvasRenderingContext2D,
    textX: number,
    y: number,
    fontSize: number,
    clue: DGAResult['clues'][number]
) => {
    const middleY = y;
    const baselineOffset = fontSize * 0.12;
    const segmentGap = fontSize * 0.2;
    const slotWidth = LINE_SLOT_WIDTH;
    let cursorX = textX;

    const lineY = middleY + baselineOffset - (LINE_THICKNESS / 2);

    const drawBar = (width: number) => {
        ctx.fillRect(cursorX, lineY, width, LINE_THICKNESS);
        cursorX += width + segmentGap;
    };

    const drawShortSlots = (count: number) => {
        for (let i = 0; i < count; i++) {
            drawBar(slotWidth);
        }
    };

    const drawIndeterminate = () => {
        if (clue.infiniteSlotCount <= 0) {
            return;
        }

        if (clue.infiniteSlotCount === 1) {
            drawShortSlots(1);
            return;
        }

        const slotCount = Math.max(clue.infiniteSlotCount, 12);
        const length = slotCount * slotWidth;
        drawBar(length);
    };

    if (clue.infiniteSide === 'leading') {
        drawIndeterminate();
        drawShortSlots(clue.shortLeadingSlots);
        ctx.fillText(clue.anchorChar, cursorX, middleY);
        cursorX += ctx.measureText(clue.anchorChar).width + segmentGap;
        drawShortSlots(clue.shortTrailingSlots);
    } else {
        drawShortSlots(clue.shortLeadingSlots);
        ctx.fillText(clue.anchorChar, cursorX, middleY);
        cursorX += ctx.measureText(clue.anchorChar).width + segmentGap;
        drawShortSlots(clue.shortTrailingSlots);
        drawIndeterminate();
    }
};

// Internal generator for the DGA Canvas
const createDGACanvas = (
    data: DGAResult,
    title: string,
    showKey: boolean = false
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // A4 Landscape Dimensions (300 DPI)
    const WIDTH = 3508;
    const HEIGHT = 2480;
    const PADDING = 120;

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    // Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // --- Header ---
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    
    // Name/Date
    ctx.font = '60px sans-serif';
    ctx.fillText('Name: _______________________________________', PADDING, PADDING + 50);
    ctx.textAlign = 'right';
    ctx.fillText('Date: ____________________', WIDTH - PADDING, PADDING + 50);

    // Title
    const titleY = PADDING + 150;
    ctx.font = 'bold 100px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayTitle = showKey ? `${title} (Solution)` : title;
    ctx.fillText(displayTitle, WIDTH / 2, titleY);

    const contentTop = titleY + 180;
    const contentBottom = HEIGHT - PADDING;
    
    // --- Layout Columns ---
    const colGap = 150;
    const totalContentWidth = WIDTH - (PADDING * 2);
    const colWidth = (totalContentWidth - colGap) / 2;
    
    const leftColX = PADDING;
    const rightColX = PADDING + colWidth + colGap;

    // Column Headers
    ctx.font = 'bold 70px sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    
    ctx.fillText('CLUES', leftColX, contentTop);
    ctx.fillText('SCRATCHPAD', rightColX, contentTop);

    // --- Draw Clues & Scratchpad ---
    const listStartY = contentTop + 120;
    const footerHeight = 450; // Increased footer space for word bank
    const availableListHeight = (contentBottom - footerHeight) - listStartY;
    const maxLineHeight = 150;
    
    // Ensure text isn't too small if few words
    const calculatedLineHeight = Math.min(maxLineHeight, Math.max(80, availableListHeight / data.clues.length));
    const fontSize = Math.floor(calculatedLineHeight * 0.45);

    data.clues.forEach((clue, index) => {
        const y = listStartY + (index * calculatedLineHeight);

        // 1. Draw Clue (Left Column)
        ctx.fillStyle = '#000000';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        // Draw Number
        ctx.font = `bold ${fontSize}px sans-serif`;
        const numStr = `${clue.id}.`;
        ctx.fillText(numStr, leftColX, y);
        
        // Draw Visual Indicator
        const numWidth = ctx.measureText(numStr).width;
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.lineWidth = LINE_THICKNESS;
        ctx.strokeStyle = '#000000';
        drawClueIndicator(
            ctx,
            leftColX + numWidth + 40,
            y,
            fontSize,
            clue
        );

        // Note: We intentionally do NOT draw the solution on the Left Column
        // when showKey is true, per strict requirements to leave the puzzle "blank"
        // and show the work on the right.

        // 2. Draw Scratchpad (Right Column)
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillText(numStr, rightColX, y);

        if (!showKey) {
            // STANDARD MODE: Draw empty guide line for student to write on
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#CCCCCC';
            ctx.beginPath();
            const lineStartX = rightColX + numWidth + 40;
            const lineEndX = rightColX + colWidth;
            // Position line slightly below middle
            ctx.moveTo(lineStartX, y + (fontSize/3));
            ctx.lineTo(lineEndX, y + (fontSize/3));
            ctx.stroke();
        } else {
            // SOLUTION MODE: Draw The "Work" (Candidates + Strikethroughs)
            ctx.font = `bold ${Math.floor(fontSize * 0.85)}px sans-serif`; // Slightly smaller for list
            let curX = rightColX + numWidth + 40;
            
            clue.matchingWords.forEach((cand, i) => {
                const isCorrect = cand === clue.word;
                const isLast = i === clue.matchingWords.length - 1;
                
                // Color: Blue for all work
                ctx.fillStyle = '#2563EB'; 
                
                // Construct text with separator
                const separator = isLast ? "" : ", ";
                const candText = cand;
                
                // Measure to handle positioning
                const candMetrics = ctx.measureText(candText);
                const sepMetrics = ctx.measureText(separator);
                
                // Draw Word
                ctx.fillText(candText, curX, y);
                
                // Strikethrough Logic for Incorrect Candidates
                if (!isCorrect) {
                     ctx.lineWidth = 3;
                     ctx.strokeStyle = '#2563EB';
                     ctx.beginPath();
                     // Strike through the middle of the text height (approx)
                     ctx.moveTo(curX, y); 
                     ctx.lineTo(curX + candMetrics.width, y);
                     ctx.stroke();
                }

                // Move cursor
                curX += candMetrics.width;

                // Draw Separator (No strikethrough)
                ctx.fillText(separator, curX, y);
                curX += sepMetrics.width;
            });
        }
    });

    // --- Footer: Word Bank ---
    const bankY = contentBottom - 350;
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = 'bold 60px sans-serif';
    ctx.fillText('WORD BANK', PADDING, bankY);

    // Word Bank Box
    const bankBoxY = bankY + 80;
    const bankBoxHeight = 250;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeRect(PADDING, bankBoxY, totalContentWidth, bankBoxHeight);

    // Render Words inside box
    const bankPadding = 50;
    const bankContentWidth = totalContentWidth - (bankPadding * 2);
    let curX = PADDING + bankPadding;
    let curY = bankBoxY + bankPadding;
    const wordSpacing = 80;
    const bankLineHeight = 90;
    
    ctx.font = '50px sans-serif';
    ctx.textBaseline = 'top';

    data.wordBank.forEach(word => {
        const w = ctx.measureText(word).width;
        if (curX + w > PADDING + bankContentWidth) {
            curX = PADDING + bankPadding;
            curY += bankLineHeight;
        }
        ctx.fillText(word, curX, curY);
        curX += w + wordSpacing;
    });

    return canvas;
};

// Preview function updates the React Ref canvas
export const drawDGACanvas = (
    canvas: HTMLCanvasElement,
    data: DGAResult,
    title: string,
    showKey: boolean = false
) => {
    // Generate high-res
    const highRes = createDGACanvas(data, title, showKey);
    
    // Draw to display canvas (scaled)
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear potential inline styles from Crossword tab
    canvas.style.width = '';
    canvas.style.height = '';
    
    const dpr = window.devicePixelRatio || 1;
    // Set actual resolution
    canvas.width = highRes.width; 
    canvas.height = highRes.height;

    // Copy
    ctx.drawImage(highRes, 0, 0);
};

// Helper for download
const triggerDownload = (canvas: HTMLCanvasElement, filename: string) => {
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

export const downloadDGACanvas = (
    data: DGAResult,
    title: string,
    filename: string,
    showKey: boolean = false
) => {
    const canvas = createDGACanvas(data, title, showKey);
    triggerDownload(canvas, filename);
};

export const downloadDGA2Up = (
    data: DGAResult,
    title: string,
    filename: string,
    showKey: boolean = false
) => {
    // 1. Generate Source (A4 Landscape)
    const srcCanvas = createDGACanvas(data, title, showKey);

    // 2. Create Dest (A4 Portrait)
    const destCanvas = document.createElement('canvas');
    const ctx = destCanvas.getContext('2d');
    if (!ctx) return;

    const DEST_W = 2480;
    const DEST_H = 3508;
    const HALF_H = DEST_H / 2;

    destCanvas.width = DEST_W;
    destCanvas.height = DEST_H;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, DEST_W, DEST_H);

    // 3. Draw Top & Bottom
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, 0, DEST_W, HALF_H);
    ctx.drawImage(srcCanvas, 0, 0, srcCanvas.width, srcCanvas.height, 0, HALF_H, DEST_W, HALF_H);

    // 4. Cut Line
    ctx.beginPath();
    ctx.strokeStyle = '#999999';
    ctx.lineWidth = 4;
    ctx.setLineDash([20, 20]);
    ctx.moveTo(0, HALF_H);
    ctx.lineTo(DEST_W, HALF_H);
    ctx.stroke();

    triggerDownload(destCanvas, filename);
};
