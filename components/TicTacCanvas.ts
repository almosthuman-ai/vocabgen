
import { TicTacResult, TicTacGrid } from '../types';

const createTicTacCanvas = (
    data: TicTacResult,
    title: string,
    showKey: boolean
): HTMLCanvasElement => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    // A4 Portrait (300 DPI)
    const WIDTH = 2480;
    const HEIGHT = 3508;
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
    ctx.font = '50px sans-serif';
    ctx.fillText('Name: ______________________', PADDING, PADDING + 50);
    ctx.textAlign = 'right';
    ctx.fillText('Date: ___________', WIDTH - PADDING, PADDING + 50);

    // Title
    const titleY = PADDING + 130;
    ctx.font = 'bold 80px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const displayTitle = showKey ? `${title} (Solution)` : `${title}: Tic-Tac-Word`;
    ctx.fillText(displayTitle, WIDTH / 2, titleY);

    // --- Grid Layout (2x2) ---
    // Header uses approx ~450px from top.
    // Available height approx 3000px.
    // 2 Rows means plenty of space for vertical centering.
    
    const startY = titleY + 250; // Push down slightly for spacing
    const availWidth = WIDTH - (PADDING * 2);
    const colGap = 150;
    const gridWidth = (availWidth - colGap) / 2;
    const rowGap = 350; // Increased vertical gap for better separation
    const gridHeight = gridWidth; // Square grids

    // Helper to draw a single 3x3 grid
    const drawGrid = (grid: TicTacGrid, x: number, y: number) => {
        const cellSize = gridWidth / 3;
        
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 4;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw Outer Box
        ctx.strokeRect(x, y, gridWidth, gridHeight);

        // Draw Inner Lines
        ctx.beginPath();
        // Verticals
        ctx.moveTo(x + cellSize, y);
        ctx.lineTo(x + cellSize, y + gridHeight);
        ctx.moveTo(x + cellSize * 2, y);
        ctx.lineTo(x + cellSize * 2, y + gridHeight);
        // Horizontals
        ctx.moveTo(x, y + cellSize);
        ctx.lineTo(x + gridWidth, y + cellSize);
        ctx.moveTo(x, y + cellSize * 2);
        ctx.lineTo(x + gridWidth, y + cellSize * 2);
        ctx.stroke();

        // Draw Constraints
        grid.cells.forEach((cell, i) => {
            const r = Math.floor(i / 3);
            const c = i % 3;
            const cx = x + (c * cellSize) + (cellSize / 2);
            const cy = y + (r * cellSize) + (cellSize / 2);

            // Constraint Text
            ctx.fillStyle = '#000000';
            // Static font size as requested (middle of previous range 30-45)
            const fontSize = 40;
            ctx.font = `bold ${fontSize}px sans-serif`;
            
            // Draw constraint at top of cell to leave room for writing
            ctx.textBaseline = 'top';
            ctx.fillText(cell.label, cx, y + (r * cellSize) + 15);

            // Solution Text
            if (showKey) {
                ctx.fillStyle = '#2563EB';
                ctx.font = '24px sans-serif';
                ctx.textBaseline = 'bottom';
                
                // Show up to 2 examples
                const examples = cell.matchingWords.slice(0, 2).join(', ');
                const label = examples.length > 20 ? examples.substring(0, 18) + '...' : examples;
                
                ctx.fillText(label, cx, y + (r * cellSize) + cellSize - 10);
            }
        });
        
        // Round Label
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 40px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText(`Round ${grid.id + 1}`, x, y - 15);
    };

    // Draw 4 grids
    // 2 Columns, 2 Rows
    data.grids.forEach((grid, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        
        const x = PADDING + (col * (gridWidth + colGap));
        const y = startY + (row * (gridHeight + rowGap));
        
        drawGrid(grid, x, y);
    });

    return canvas;
};

export const drawTicTacCanvas = (
    canvas: HTMLCanvasElement,
    data: TicTacResult,
    title: string,
    showKey: boolean = false
) => {
    const highRes = createTicTacCanvas(data, title, showKey);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear potential inline styles from Crossword tab
    canvas.style.width = '';
    canvas.style.height = '';

    // Display Scaling
    canvas.width = highRes.width;
    canvas.height = highRes.height;
    ctx.drawImage(highRes, 0, 0);
};

export const downloadTicTacCanvas = (
    data: TicTacResult,
    title: string,
    filename: string,
    showKey: boolean = false
) => {
    const canvas = createTicTacCanvas(data, title, showKey);
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
};
