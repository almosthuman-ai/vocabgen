
import React, { useState, useEffect, useRef } from 'react';
import { CrosswordGenerator } from './utils/crosswordGenerator';
import { drawCrossword, downloadSinglePage, download2UpPage, CrosswordMode } from './components/CrosswordCanvas';
import { DGAGenerator } from './utils/dgaGenerator';
import { drawDGACanvas, downloadDGACanvas, downloadDGA2Up } from './components/DGACanvas';
import { TicTacGenerator } from './utils/tictacGenerator';
import { drawTicTacCanvas, downloadTicTacCanvas } from './components/TicTacCanvas';
import CluesList from './components/CluesList';
import { GenerationResult, WordInput, DGAResult, TicTacResult, TicTacDifficulty } from './types';
import { RefreshCw, AlertCircle, FileCheck, FileText, Scissors, LayoutGrid, BrainCircuit, Gamepad2, RefreshCcw, BookOpen, Layers, Plus, Trash2, ArrowDownToLine, Library } from 'lucide-react';
import { CURRICULUM } from './curriculumData';

type Tab = 'crossword' | 'dga' | 'tictac';
type BookKey = keyof typeof CURRICULUM;

const App: React.FC = () => {
  const [inputWords, setInputWords] = useState('');
  const [inputClues, setInputClues] = useState('');
  const [gridSize, setGridSize] = useState(15);
  const [puzzleTitle, setPuzzleTitle] = useState('Crossword Puzzle');
  
  // Curriculum Selector State
  const [selectedBook, setSelectedBook] = useState<BookKey>(Object.keys(CURRICULUM)[0] as BookKey);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['']);

  // Crossword State
  const [result, setResult] = useState<GenerationResult | null>(null);
  
  // DGA State
  const [dgaResult, setDgaResult] = useState<DGAResult | null>(null);
  const [dgaWordCount, setDgaWordCount] = useState<number>(10);

  // Tic Tac State
  const [ticTacResult, setTicTacResult] = useState<TicTacResult | null>(null);
  const [ticTacDifficulty, setTicTacDifficulty] = useState<TicTacDifficulty>('medium');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [mode, setMode] = useState<CrosswordMode>('standard');
  const [activeTab, setActiveTab] = useState<Tab>('crossword');

  const isWordListEmpty = inputWords.trim().length === 0;

  // Specific Generator Functions
  const generateCrossword = () => {
    const wordLines = inputWords.split('\n').map(s => s.trim()).filter(s => s.length > 0);
    const clueLines = inputClues.split('\n').map(s => s.trim());
    const wordInputs: WordInput[] = [];

    wordLines.forEach((wordRaw, index) => {
        const word = wordRaw.toUpperCase().replace(/[^A-Z]/g, '');
        if (word.length > 0) {
            let clue = clueLines[index] || `Clue for ${word}`;
            if (clue.length === 0) clue = `Clue for ${word}`;
            wordInputs.push({ word, clue });
        }
    });

    if (wordInputs.length === 0) return;

    const longestWordLength = wordInputs.reduce((max, w) => Math.max(max, w.word.length), 0);
    const calculatedGridSize = Math.max(15, longestWordLength + 5);
    setGridSize(calculatedGridSize);

    const generator = new CrosswordGenerator(calculatedGridSize);
    const genResult = generator.generate(wordInputs);
    setResult(genResult);
  };

  const generateDGA = () => {
      const wordLines = inputWords.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const dgaGen = new DGAGenerator();
      const dgaRes = dgaGen.generate(wordLines, dgaWordCount);
      setDgaResult(dgaRes);
  };

  const generateTicTac = () => {
      const wordLines = inputWords.split('\n').map(s => s.trim()).filter(s => s.length > 0);
      const clueLines = inputClues.split('\n').map(s => s.trim());
      const generator = new TicTacGenerator();
      const res = generator.generate(wordLines, clueLines, ticTacDifficulty);
      setTicTacResult(res);
  };

  const handleGenerate = () => {
    if (activeTab === 'crossword') {
        generateCrossword();
    } else if (activeTab === 'dga') {
        generateDGA();
    } else if (activeTab === 'tictac') {
        generateTicTac();
    }
  };

  useEffect(() => {
    if (inputWords.trim().length === 0) {
        setResult(null);
        setDgaResult(null);
        setTicTacResult(null);
    }
  }, [inputWords]);

  // --- Curriculum Logic ---

  const handleBookChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedBook(e.target.value as BookKey);
      setSelectedWeeks(['']); // Reset selection on book change
  };

  const handleWeekChange = (index: number, value: string) => {
      const newWeeks = [...selectedWeeks];
      newWeeks[index] = value;
      setSelectedWeeks(newWeeks);
  };

  const addWeekRow = () => {
      setSelectedWeeks([...selectedWeeks, '']);
  };

  const removeWeekRow = (index: number) => {
      const newWeeks = selectedWeeks.filter((_, i) => i !== index);
      setSelectedWeeks(newWeeks);
  };

  const handleLoadCurriculum = () => {
      const bookData = CURRICULUM[selectedBook];
      let allWords: string[] = [];
      let allClues: string[] = [];
      let loadedCount = 0;
      const validWeeks = selectedWeeks.filter(w => w !== '');

      validWeeks.forEach(weekKey => {
          // @ts-ignore
          const weekData = bookData[weekKey];
          if (weekData) {
              allWords = [...allWords, ...weekData.words];
              allClues = [...allClues, ...weekData.clues];
              loadedCount++;
          }
      });

      if (loadedCount === 0) {
          alert("Please select at least one valid week.");
          return;
      }

      setInputWords(allWords.join('\n'));
      setInputClues(allClues.join('\n'));
      
      // Auto-set title based on selection
      // e.g. "Explore Our World 6 - Week 15, 16, 17"
      const allStartWithWeek = validWeeks.every(w => w.startsWith('Week '));
      let titleSuffix = '';
      
      if (allStartWithWeek && validWeeks.length > 0) {
          const numbers = validWeeks.map(w => w.replace('Week ', ''));
          titleSuffix = `Week ${numbers.join(', ')}`;
      } else {
          titleSuffix = validWeeks.join(', ');
      }
      
      setPuzzleTitle(`${selectedBook} - ${titleSuffix}`);
  };

  // --- Effect to draw canvas ---
  useEffect(() => {
    const render = () => {
        if (!canvasRef.current || !containerRef.current) return;

        const containerWidth = containerRef.current.clientWidth;
        
        if (activeTab === 'crossword' && result) {
            const padding = 32; 
            const availableWidth = containerWidth - padding;
            const calculatedCellSize = Math.floor(availableWidth / result.gridSize);
            const cellSize = Math.max(10, calculatedCellSize);

            drawCrossword(canvasRef.current, result.grid, result.gridSize, result.placedWords, mode, cellSize);
            
            // Draw Solution Overlay if checked
            if (showSolution) {
                const ctx = canvasRef.current.getContext('2d');
                if (ctx) {
                    ctx.font = `bold ${Math.floor(cellSize * 0.6)}px sans-serif`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#2563EB';

                    for(let r=0; r<result.gridSize; r++) {
                        for(let c=0; c<result.gridSize; c++) {
                            const cell = result.grid[r][c];
                            if (cell.isActive) {
                                const x = c * cellSize + cellSize/2;
                                const y = r * cellSize + cellSize/2 + 2;
                                ctx.fillText(cell.char, x, y);
                            }
                        }
                    }
                }
            }
        } 
        else if (activeTab === 'dga' && dgaResult && dgaResult.success) {
            drawDGACanvas(canvasRef.current, dgaResult, puzzleTitle, showSolution);
        }
        else if (activeTab === 'tictac' && ticTacResult && ticTacResult.success) {
            drawTicTacCanvas(canvasRef.current, ticTacResult, puzzleTitle, showSolution);
        }
        else if (
            (activeTab === 'dga' && dgaResult && !dgaResult.success) || 
            (activeTab === 'tictac' && ticTacResult && !ticTacResult.success)
        ) {
            const ctx = canvasRef.current.getContext('2d');
            if(ctx) ctx.clearRect(0,0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [result, dgaResult, ticTacResult, showSolution, mode, activeTab, puzzleTitle]);

  const getCleanFilename = (suffix: string) => {
      const cleanTitle = puzzleTitle.replace(/[^a-z0-9-_]/gi, '_').replace(/_+/g, '_');
      return `${cleanTitle || 'Puzzle'}${suffix}.png`;
  };

  const handleDownloadSingle = (isKey: boolean) => {
    if (activeTab === 'crossword' && result) {
      const suffix = isKey ? '-Solution' : `-${mode === 'deduction' ? 'Deduction' : 'Standard'}`;
       const filename = getCleanFilename(suffix);
      downloadSinglePage(result.grid, result.placedWords, result.gridSize, filename, isKey, puzzleTitle, mode);
    } else if (activeTab === 'dga' && dgaResult && dgaResult.success) {
        const suffix = isKey ? '-DGA-Solution' : '-DGA-Logic';
         const filename = getCleanFilename(suffix);
        downloadDGACanvas(dgaResult, puzzleTitle, filename, isKey);
    } else if (activeTab === 'tictac' && ticTacResult && ticTacResult.success) {
        const suffix = isKey ? '-TicTac-Solution' : '-TicTac-Sheet';
         const filename = getCleanFilename(suffix);
        downloadTicTacCanvas(ticTacResult, puzzleTitle, filename, isKey);
    }
  };

  const handleDownload2Up = (isKey: boolean) => {
      if (activeTab === 'crossword' && result) {
          const suffix = isKey ? '-Solution-A4Sheet' : `-${mode === 'deduction' ? 'Deduction' : 'Standard'}-A4Sheet`;
           const filename = getCleanFilename(suffix);
          download2UpPage(result.grid, result.placedWords, result.gridSize, filename, isKey, puzzleTitle, mode);
      } else if (activeTab === 'dga' && dgaResult && dgaResult.success) {
          const suffix = isKey ? '-DGA-Solution-A4Sheet' : '-DGA-Logic-A4Sheet';
           const filename = getCleanFilename(suffix);
          downloadDGA2Up(dgaResult, puzzleTitle, filename, isKey);
      } else if (activeTab === 'tictac') {
          // Tic Tac is already 6-up on a sheet, so 2-up doesn't really apply or is redundant, 
          // but we can just download the single sheet again or disable it.
          // For simplicity, we'll just download the single sheet as it's already "multi-up"
          handleDownloadSingle(isKey);
      }
  };

  const isDownloadDisabled = () => {
    if (isWordListEmpty) return true;
    if (activeTab === 'dga' && dgaResult && !dgaResult.success) return true;
    if (activeTab === 'tictac' && ticTacResult && !ticTacResult.success) return true;
    return false;
  };

  // Get available weeks for current book
  const availableWeeks = CURRICULUM[selectedBook] ? Object.keys(CURRICULUM[selectedBook]) : [];

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-8 border-b pb-4 border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">VocabGen</h1>
            <div className="mt-1 text-gray-500 space-y-0.5">
                <p>Create high-density educational puzzles for Taiwanese ESL teachers & students.</p>
                <p>專為台灣 ESL 師生設計的高密度教學拼字遊戲生成器。</p>
            </div>
        </div>
        <div className="flex gap-2">
            <button
                onClick={() => setActiveTab('crossword')}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${activeTab === 'crossword' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
            >
                <LayoutGrid size={18} />
                Crossword
            </button>
            <button
                onClick={() => setActiveTab('dga')}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${activeTab === 'dga' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
            >
                <BrainCircuit size={18} />
                DGA Logic
            </button>
            <button
                onClick={() => setActiveTab('tictac')}
                className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors ${activeTab === 'tictac' ? 'bg-purple-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'}`}
            >
                <Gamepad2 size={18} />
                Tic-Tac-Word
            </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: Inputs */}
        <div className="lg:col-span-4 space-y-6">
            
            {/* Title Input */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <label className="block text-sm font-semibold text-gray-700 mb-2">Puzzle Title</label>
                <input 
                    type="text" 
                    value={puzzleTitle}
                    onChange={(e) => setPuzzleTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
            </div>

            {/* CURRICULUM SELECTOR */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
                    <BookOpen size={20} className="text-purple-600"/>
                    Select Curriculum / 選擇課程
                </h2>
                
                {/* Book Selector */}
                <div className="mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        Level / Book
                    </label>
                    <select 
                        value={selectedBook} 
                        onChange={handleBookChange}
                        className="w-full bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block px-3 py-2.5 outline-none"
                    >
                        {Object.keys(CURRICULUM).map(book => (
                            <option key={book} value={book}>{book}</option>
                        ))}
                    </select>
                </div>

                {/* Stackable Week Selectors */}
                <div className="space-y-3 mb-4">
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Select Weeks (Combine)
                    </label>
                    
                    {selectedWeeks.map((week, index) => (
                        <div key={index} className="flex gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="grow relative">
                                <Layers size={16} className="absolute left-3 top-3 text-gray-400" />
                                <select 
                                    value={week}
                                    onChange={(e) => handleWeekChange(index, e.target.value)}
                                    className="w-full pl-9 bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block px-3 py-2.5 outline-none appearance-none"
                                >
                                    <option value="" disabled>Select Week...</option>
                                    {availableWeeks.map(w => (
                                        <option key={w} value={w}>{w}</option>
                                    ))}
                                </select>
                            </div>
                            
                            {index > 0 && (
                                <button 
                                    onClick={() => removeWeekRow(index)}
                                    className="p-2.5 text-red-500 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-200 transition-colors"
                                    title="Remove this week"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    ))}

                    <button 
                        onClick={addWeekRow}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 font-medium text-sm hover:border-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
                    >
                        <Plus size={16} />
                        Add Another Week
                    </button>
                </div>

                {/* Load Button */}
                <button 
                    onClick={handleLoadCurriculum}
                    className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold shadow-md shadow-purple-100 flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                >
                    <ArrowDownToLine size={18} />
                    Load / 載入
                </button>
            </div>

            {/* Content Inputs */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <FileText size={20} className="text-blue-600"/>
                        Input Data
                    </h2>
                </div>

                <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        List A: Words (One per line)
                    </label>
                    <textarea
                        value={inputWords}
                        onChange={(e) => setInputWords(e.target.value)}
                        className="w-full h-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm resize-none"
                        placeholder="WORD1&#10;WORD2&#10;WORD3"
                    />
                </div>

                {(activeTab === 'crossword' || activeTab === 'tictac') && (
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            {activeTab === 'tictac' ? "List B: Clues (For POS Detection)" : "List B: Clues (Matches List A)"}
                        </label>
                        <textarea
                            value={inputClues}
                            onChange={(e) => setInputClues(e.target.value)}
                            className="w-full h-48 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none font-sans text-sm resize-none"
                            placeholder="n. A noun definition...&#10;v. A verb definition..."
                        />
                    </div>
                )}

                <button 
                    onClick={handleGenerate}
                    className="w-full py-3 bg-gray-900 hover:bg-black text-white rounded-lg font-bold shadow-lg shadow-gray-200 flex justify-center items-center gap-2 transition-all active:scale-[0.98]"
                >
                    <RefreshCw size={18} />
                    Generate Puzzle
                </button>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm flex gap-3">
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>
                    {activeTab === 'crossword' && "Tip: Use more words for a denser crossword."}
                    {activeTab === 'dga' && "Tip: DGA Logic requires words with shared letters."}
                    {activeTab === 'tictac' && "Tip: Use 30+ words for best variety. Include POS (n., v.) in clues for Medium/Hard modes."}
                </p>
            </div>
        </div>

        {/* RIGHT COLUMN: Preview & Actions */}
        <div className="lg:col-span-8 space-y-6">
            
            {/* CROSSWORD INFO */}
            {activeTab === 'crossword' && result && (
                <div className={`p-4 rounded-lg border ${result.unusedWords.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className={`font-bold flex items-center gap-2 ${result.unusedWords.length > 0 ? 'text-amber-800' : 'text-green-800'}`}>
                                {result.unusedWords.length > 0 ? <AlertCircle size={18} /> : <FileCheck size={18} />}
                                {result.unusedWords.length > 0 ? 'Some words could not be placed' : 'All words placed successfully!'}
                            </h3>
                            <p className={`text-sm mt-1 ${result.unusedWords.length > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                                Grid Usage: {result.placedWords.length} of {result.placedWords.length + result.unusedWords.length} words.
                            </p>
                        </div>
                        <button 
                            onClick={generateCrossword}
                            className="px-3 py-1.5 bg-white border border-gray-300 shadow-sm rounded hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2"
                        >
                            <RefreshCcw size={14} />
                            Regenerate
                        </button>
                    </div>
                </div>
            )}

            {/* DGA INFO */}
            {activeTab === 'dga' && dgaResult && (
                 <div className={`p-4 rounded-lg border ${dgaResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-center">
                        <div>
                             <h3 className={`font-bold flex items-center gap-2 ${!dgaResult.success ? 'text-red-800' : 'text-green-800'}`}>
                                {!dgaResult.success ? <AlertCircle size={18} /> : <FileCheck size={18} />}
                                {dgaResult.success ? 'Valid Logic Puzzle Generated' : 'Generation Failed'}
                            </h3>
                            {!dgaResult.success && <p className="text-sm mt-1 text-red-700">{dgaResult.message}</p>}
                        </div>
                         <button onClick={generateDGA} className="px-3 py-1.5 bg-white border border-gray-300 shadow-sm rounded hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            <RefreshCcw size={14} /> Regenerate
                        </button>
                    </div>
                 </div>
            )}

            {/* TICTAC INFO */}
            {activeTab === 'tictac' && ticTacResult && (
                 <div className={`p-4 rounded-lg border ${ticTacResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex justify-between items-center">
                        <div>
                             <h3 className={`font-bold flex items-center gap-2 ${!ticTacResult.success ? 'text-red-800' : 'text-green-800'}`}>
                                {ticTacResult.success ? 'Generated 4 Unique Rounds' : 'Generation Failed'}
                            </h3>
                            {!ticTacResult.success && <p className="text-sm mt-1 text-red-700">Not enough matching words.</p>}
                        </div>
                         <button onClick={generateTicTac} className="px-3 py-1.5 bg-white border border-gray-300 shadow-sm rounded hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-2">
                            <RefreshCcw size={14} /> Regenerate
                        </button>
                    </div>
                 </div>
            )}

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 justify-between items-center">
                
                {activeTab === 'crossword' && (
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button onClick={() => setMode('standard')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'standard' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Standard</button>
                        <button onClick={() => setMode('deduction')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${mode === 'deduction' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Deduction</button>
                    </div>
                )}

                {activeTab === 'dga' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Word Count:</label>
                        <select 
                            value={dgaWordCount} 
                            onChange={(e) => setDgaWordCount(Number(e.target.value))}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-2.5 py-1.5 outline-none"
                        >
                            <option value="6">6</option>
                            <option value="7">7</option>
                            <option value="8">8</option>
                            <option value="9">9</option>
                            <option value="10">10</option>
                        </select>
                    </div>
                )}

                {activeTab === 'tictac' && (
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-gray-700">Difficulty:</label>
                        <select 
                            value={ticTacDifficulty} 
                            onChange={(e) => setTicTacDifficulty(e.target.value as TicTacDifficulty)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block px-2.5 py-1.5 outline-none"
                        >
                            <option value="easy">Easy (Lengths)</option>
                            <option value="medium">Medium (Attributes)</option>
                            <option value="hard">Hard (Intersections)</option>
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2">
                     <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer select-none">
                        <input type="checkbox" checked={showSolution} onChange={(e) => setShowSolution(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500" />
                        Show Solution
                    </label>
                </div>

                {/* Common Download Actions */}
                {!isWordListEmpty && (
                    <div className="flex gap-2 ml-auto">
                        <button onClick={() => handleDownloadSingle(false)} disabled={isDownloadDisabled()} className={`px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${isDownloadDisabled() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileText size={16} />
                            {activeTab === 'tictac' ? 'Print Sheet' : '1-Up'}
                        </button>
                        
                        {activeTab !== 'tictac' && (
                             <button onClick={() => handleDownload2Up(false)} disabled={isDownloadDisabled()} className={`px-3 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${isDownloadDisabled() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                 <Scissors size={16} />
                                 2-Up
                             </button>
                        )}
                        
                        <button onClick={() => handleDownloadSingle(true)} disabled={isDownloadDisabled()} className={`px-3 py-2 bg-blue-50 border border-blue-100 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${isDownloadDisabled() ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <FileCheck size={16} />
                            Key
                        </button>
                    </div>
                )}
            </div>

            {/* Canvas Preview */}
            <div ref={containerRef} className="bg-gray-200 rounded-xl border border-gray-300 p-8 grid place-items-center min-h-125 overflow-hidden shadow-inner">
                 {isWordListEmpty ? (
                    <div className="grid place-items-center text-center gap-6">
                        <Library size={72} className="text-gray-400" />
                        <div className="space-y-2">
                            <p className="text-xl font-semibold text-gray-700">Select a Curriculum to Get Started / 請選擇課程以開始</p>
                            <p className="text-sm text-gray-500">Choose a book and week from the sidebar.</p>
                        </div>
                    </div>
                 ) : (
                    <>
                        <canvas 
                            ref={canvasRef} 
                            className="shadow-2xl bg-white max-w-full"
                            style={{ maxHeight: '80vh' }}
                        />
                        {((activeTab === 'crossword' && !result) || (activeTab === 'dga' && !dgaResult) || (activeTab === 'tictac' && !ticTacResult)) && (
                            <p className="text-gray-500 font-medium">Click Generate to create puzzle</p>
                        )}
                    </>
                 )}
            </div>

            {/* Clues Preview (Crossword Only) */}
            {activeTab === 'crossword' && result && !isWordListEmpty && (
                <CluesList words={result.placedWords} mode={mode} />
            )}
        </div>
      </main>
    </div>
  );
};

export default App;
