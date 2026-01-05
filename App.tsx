
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { CrosswordGenerator } from './utils/crosswordGenerator';
import { drawCrossword, downloadSinglePage, download2UpPage, CrosswordMode } from './components/CrosswordCanvas';
import { DGAGenerator } from './utils/dgaGenerator';
import { drawDGACanvas, downloadDGACanvas, downloadDGA2Up } from './components/DGACanvas';
import { TicTacGenerator } from './utils/tictacGenerator';
import { drawTicTacCanvas, downloadTicTacCanvas } from './components/TicTacCanvas';
import CluesList from './components/CluesList';
import { GenerationResult, WordInput, DGAResult, TicTacResult, TicTacDifficulty } from './types';
import { RefreshCw, AlertCircle, FileCheck, FileText, Scissors, LayoutGrid, BrainCircuit, Gamepad2, BookOpen, Layers, Plus, Trash2, ArrowDownToLine, Library } from 'lucide-react';
import { CURRICULUM } from './curriculumData';

const cloneCrosswordResult = (res: GenerationResult): GenerationResult => ({
  grid: res.grid.map(row => row.map(cell => ({ ...cell }))),
  placedWords: res.placedWords.map(word => ({ ...word })),
  unusedWords: [...res.unusedWords],
  gridSize: res.gridSize,
});

const cloneDgaResult = (res: DGAResult): DGAResult => ({
  ...res,
  clues: res.clues.map(clue => ({ ...clue, matchingWords: [...clue.matchingWords] })),
  wordBank: [...res.wordBank],
});

const cloneTicTacResult = (res: TicTacResult): TicTacResult => ({
  ...res,
  grids: res.grids.map(grid => ({
    ...grid,
    cells: grid.cells.map(cell => ({ ...cell, matchingWords: [...cell.matchingWords] })),
  })),
});

type Tab = 'crossword' | 'dga' | 'tictac';
type BookKey = keyof typeof CURRICULUM;

type StatusTone = 'neutral' | 'success' | 'warning' | 'error';

interface TabStatus {
  tone: StatusTone;
  en: string;
  zh: string;
}

const DEFAULT_STATUSES: Record<Tab, TabStatus> = {
  crossword: {
    tone: 'neutral',
    en: 'No crossword generated yet. Add more words and press Generate.',
    zh: '尚未產生填字遊戲。請先輸入更多單字後再按「產生」。',
  },
  dga: {
    tone: 'neutral',
    en: 'No DGA puzzle generated yet. Prepare your word list and press Generate.',
    zh: '尚未產生 DGA 邏輯題。請整理單字列表後按「產生」。',
  },
  tictac: {
    tone: 'neutral',
    en: 'No Tic-Tac-Word rounds generated yet. Add clue-ready words and press Generate.',
    zh: '尚未產生井字動詞遊戲輪。請輸入含提示的單字後按「產生」。',
  },
};

const TICTAC_DIFFICULTY_LABELS: Record<TicTacDifficulty, { en: string; zh: string }> = {
  easy: { en: 'Easy', zh: '初階' },
  medium: { en: 'Medium', zh: '中階' },
  hard: { en: 'Hard', zh: '高階' },
};

const summarizeList = (items: string[], limit = 4): string => {
  if (items.length === 0) return '';
  if (items.length <= limit) return items.join(', ');
  return `${items.slice(0, limit).join(', ')} … (+${items.length - limit})`;
};

const buildStatus = (tone: StatusTone, en: string, zh: string): TabStatus => ({ tone, en, zh });



const App: React.FC = () => {
  const [inputWords, setInputWords] = useState('');
  const [inputClues, setInputClues] = useState('');
  const [gridSize, setGridSize] = useState(15);
  const [puzzleTitle, setPuzzleTitle] = useState('Crossword Puzzle');
  
  // Curriculum Selector State
  const [selectedBook, setSelectedBook] = useState<BookKey>(Object.keys(CURRICULUM)[0] as BookKey);
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(['']);

  const availableWeeks = useMemo(() => {
    const bookWeeks = CURRICULUM[selectedBook];
    return bookWeeks ? Object.keys(bookWeeks) : [];
  }, [selectedBook]);

  // Crossword State
  const [result, setResultState] = useState<GenerationResult | null>(null);
  
  // DGA State
  const [dgaResult, setDgaResultState] = useState<DGAResult | null>(null);
  const [dgaWordCount, setDgaWordCount] = useState<number>(10);

  // Tic Tac State
  const [ticTacResult, setTicTacResultState] = useState<TicTacResult | null>(null);

  const setResult = (value: GenerationResult | null) => {
    setResultState(value ? cloneCrosswordResult(value) : null);
  };

  const setDgaResult = (value: DGAResult | null) => {
    setDgaResultState(value ? cloneDgaResult(value) : null);
  };

  const setTicTacResult = (value: TicTacResult | null) => {
    setTicTacResultState(value ? cloneTicTacResult(value) : null);
  };
  const [ticTacDifficulty, setTicTacDifficulty] = useState<TicTacDifficulty>('medium');
  const [statusByTab, setStatusByTab] = useState<Record<Tab, TabStatus>>({ ...DEFAULT_STATUSES });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showSolution, setShowSolution] = useState(false);
  const [mode, setMode] = useState<CrosswordMode>('standard');
  const [activeTab, setActiveTab] = useState<Tab>('crossword');

  const isWordListEmpty = inputWords.trim().length === 0;
  const hasCrossword = !!result;
  const hasDga = !!(dgaResult && dgaResult.success);
  const hasTicTac = !!(ticTacResult && ticTacResult.success);
  const activeTabHasRender =
    (activeTab === 'crossword' && hasCrossword) ||
    (activeTab === 'dga' && hasDga) ||
    (activeTab === 'tictac' && hasTicTac);

  const setTabStatus = (tab: Tab, status: TabStatus) => {
    setStatusByTab(prev => ({ ...prev, [tab]: status }));
  };

  const getActiveStatus = (): TabStatus => {
    return statusByTab[activeTab];
  };

  const renderStatusCard = () => {
    if (isWordListEmpty) {
      return (
        <div className="p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-600">
          Enter words or load curriculum to enable generation.
        </div>
      );
    }

    const status = getActiveStatus();

    const iconByTone: Record<StatusTone, React.ReactNode> = {
      neutral: <RefreshCw size={18} className="text-gray-500" />,
      success: <FileCheck size={18} />, 
      warning: <AlertCircle size={18} />, 
      error: <AlertCircle size={18} />,
    };

    const borderTone: Record<StatusTone, string> = {
      neutral: 'border-gray-200',
      success: 'border-green-200',
      warning: 'border-amber-200',
      error: 'border-red-200',
    };

    const bgTone: Record<StatusTone, string> = {
      neutral: 'bg-white',
      success: 'bg-green-50',
      warning: 'bg-amber-50',
      error: 'bg-red-50',
    };

    return (
      <div className={`p-4 rounded-lg border ${bgTone[status.tone]} ${borderTone[status.tone]}`}>
        <div className="flex justify-between items-start gap-6">
          <div className="flex items-start gap-3">
            <span className={`${status.tone === 'neutral' ? 'text-gray-500' : status.tone === 'success' ? 'text-green-700' : status.tone === 'warning' ? 'text-amber-700' : 'text-red-700'} mt-0.5`}>{iconByTone[status.tone]}</span>
            <div className="flex flex-col gap-1">
              <p className={`font-semibold text-sm whitespace-pre-line leading-tight ${status.tone === 'neutral' ? 'text-gray-700' : status.tone === 'success' ? 'text-green-800' : status.tone === 'warning' ? 'text-amber-800' : 'text-red-800'}`}>
                {status.en}
              </p>
              <p className={`text-sm whitespace-pre-line leading-tight ${status.tone === 'neutral' ? 'text-gray-500' : status.tone === 'success' ? 'text-green-700' : status.tone === 'warning' ? 'text-amber-700' : 'text-red-700'}`}>
                {status.zh}
              </p>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white border border-transparent shadow-sm rounded text-sm font-medium grid grid-flow-col auto-cols-max items-center gap-2"
          >
            <RefreshCw size={16} />
            Generate
          </button>
        </div>
      </div>
    );
  };

  const generatePrompts: Record<Tab, string> = {
    crossword: 'Click Generate to build the crossword.',
    dga: 'Click Generate to build the DGA logic grid.',
    tictac: 'Click Generate to assemble the Tic-Tac-Word rounds.',
  };

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

    if (wordInputs.length === 0) {
      setResult(null);
      setTabStatus('crossword', buildStatus(
        'error',
        'Need at least one alphabetic word before generating. Add more entries to the word list.',
        '請先輸入至少一個英文字，再按「產生」完成填字遊戲。'
      ));
      return;
    }

    const longestWordLength = wordInputs.reduce((max, w) => Math.max(max, w.word.length), 0);
    const calculatedGridSize = Math.max(15, longestWordLength + 5);
    setGridSize(calculatedGridSize);

     const generator = new CrosswordGenerator(calculatedGridSize);
     const genResult = generator.generate(wordInputs);
     if (!genResult || genResult.placedWords.length === 0) {
       setResult(null);
        setTabStatus('crossword', buildStatus(
          'error',
          'Could not assemble a valid crossword. Try generating again for a different anchor word, or add more intersecting letters.',
          '無法排出有效的填字方格。請重新產生以換不同起始單字，或加入更多能交叉的字母。'
        ));
       return;
     }

     setResult(cloneCrosswordResult(genResult));

     if (genResult.unusedWords.length > 0) {
       const unusedSummary = summarizeList(genResult.unusedWords);
      const unusedLine = unusedSummary ? `Unused: ${unusedSummary}` : '';
      setTabStatus('crossword', buildStatus(
        'warning',
        ['Crossword built, but some words could not be placed. Try generating again for a different layout, or add more shared letters or trim duplicates.', unusedLine].filter(Boolean).join('\n'),
        ['已產生填字遊戲，但仍有單字無法放入。可再按「產生」換新配置，或增加可交叉的字母、精簡重複字。', unusedLine ? `未放入：${unusedSummary}` : ''].filter(Boolean).join('\n')
      ));
     } else {
       setTabStatus('crossword', buildStatus(
         'success',
         'Crossword ready. All words placed successfully.',
         '填字遊戲已完成，所有單字都成功放入。'
       ));
     }
   };

   const generateDGA = () => {
       const wordLines = inputWords.split('\n').map(s => s.trim()).filter(s => s.length > 0);

       const uniqueWords = Array.from(new Set(wordLines.map(w => w.toUpperCase()))) as string[];

       if (uniqueWords.length < 6) {
         setDgaResult(null);
         setTabStatus('dga', buildStatus(
           'error',
           `DGA logic puzzle needs at least 6 unique words. Current list has ${uniqueWords.length}. Add more overlapped words and try again.`,
           `DGA 邏輯題至少需要 6 個不重複的單字，目前只有 ${uniqueWords.length} 個。請加入更多可共享字母的單字後再試。`
         ));
         return;
       }

       const dgaGen = new DGAGenerator();
       const dgaRes = dgaGen.generate(uniqueWords, dgaWordCount);

       if (!dgaRes || !dgaRes.success) {
         setDgaResult(null);
         const baseMessage = dgaRes?.message ?? 'Could not generate a solvable deduction path.';
         setTabStatus('dga', buildStatus(
           'error',
           `DGA generation failed. ${baseMessage} Add words that share starting and ending letters, then retry.`,
           dgaRes?.message === 'Please provide at least 6 words.'
             ? 'DGA 生成失敗。請至少準備 6 個單字。'
             : 'DGA 生成失敗。請加入有共同開頭或結尾的單字，再度嘗試。'
         ));
         return;
       }

       setDgaResult(cloneDgaResult(dgaRes));
       setTabStatus('dga', buildStatus(
         'success',
         `DGA logic puzzle ready. Clue stack is solvable. Word bank size: ${dgaRes.wordBank.length}.`,
         `DGA 邏輯題已完成，線索堆疊可推理。詞庫數量：${dgaRes.wordBank.length}。`
       ));
   };

   const generateTicTac = () => {
       const wordLines = inputWords.split('\n').map(s => s.trim()).filter(s => s.length > 0);
       const clueLines = inputClues.split('\n').map(s => s.trim());

       if (wordLines.length < 9) {
         setTicTacResult(null);
         setTabStatus('tictac', buildStatus(
           'error',
           `Tic-Tac-Word needs at least nine words with matching clues. Current list has ${wordLines.length}. Add more entries with POS hints.`,
           `井字動詞遊戲至少需要九個對應提示的單字，目前只有 ${wordLines.length} 個。請再加入含詞性提示的條目後重試。`
         ));
         return;
       }

       const generator = new TicTacGenerator();
       const res = generator.generate(wordLines, clueLines, ticTacDifficulty);

       if (!res || !res.success) {
         setTicTacResult(null);
         setTabStatus('tictac', buildStatus(
           'error',
           'Tic-Tac-Word generation failed. Add more varied words (with POS tags for medium/hard) and retry.',
           '井字動詞遊戲生成失敗。請增加更多多樣的單字（中、高階建議附詞性標記），再重新產生。'
         ));
         return;
       }

       setTicTacResult(cloneTicTacResult(res));
       const difficultyLabel = TICTAC_DIFFICULTY_LABELS[ticTacDifficulty];
       setTabStatus('tictac', buildStatus(
         'success',
         `Tic-Tac-Word rounds ready. Difficulty: ${difficultyLabel.en}.`,
         `井字動詞遊戲已完成。難度：${difficultyLabel.zh}。`
       ));
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
    if (activeTab === 'crossword' && result) {
        setResult(cloneCrosswordResult(result));
    } else if (activeTab === 'dga' && dgaResult) {
        setDgaResult(cloneDgaResult(dgaResult));
    } else if (activeTab === 'tictac' && ticTacResult) {
        setTicTacResult(cloneTicTacResult(ticTacResult));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (inputWords.trim().length === 0) {
        setResult(null);
        setDgaResult(null);
        setTicTacResult(null);
        setStatusByTab({ ...DEFAULT_STATUSES });
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
      const lastSelectedWeek = [...selectedWeeks].reverse().find(week => week !== '');
      const usedWeeks = new Set(selectedWeeks.filter(week => week !== ''));
      let nextWeek = '';

      if (lastSelectedWeek) {
          const lastIndex = availableWeeks.indexOf(lastSelectedWeek);
          if (lastIndex !== -1) {
              for (let i = lastIndex + 1; i < availableWeeks.length; i++) {
                  const candidate = availableWeeks[i];
                  if (!usedWeeks.has(candidate)) {
                      nextWeek = candidate;
                      break;
                  }
              }
          }
      }

      setSelectedWeeks([...selectedWeeks, nextWeek]);
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
        
        if (activeTab === 'crossword' && hasCrossword && result) {
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
        else if (activeTab === 'dga' && hasDga && dgaResult) {
            drawDGACanvas(canvasRef.current, dgaResult, puzzleTitle, showSolution);
        }
        else if (activeTab === 'tictac' && hasTicTac && ticTacResult) {
            drawTicTacCanvas(canvasRef.current, ticTacResult, puzzleTitle, showSolution);
        }
        else {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    render();
    window.addEventListener('resize', render);
    return () => window.removeEventListener('resize', render);
  }, [result, dgaResult, ticTacResult, showSolution, mode, activeTab, puzzleTitle, hasCrossword, hasDga, hasTicTac]);

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
    if (activeTab === 'crossword') return !hasCrossword;
    if (activeTab === 'dga') return !hasDga;
    if (activeTab === 'tictac') return !hasTicTac;
    return true;
  };

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto notranslate" data-notranslate>
      <header className="mb-8 border-b pb-4 border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">VocabGen</h1>
            <div className="mt-1 text-gray-500 space-y-0.5">
                <p>Create high-density educational puzzles for Taiwanese ESL teachers & students.</p>
                <p>專為台灣 ESL 師生設計的高密度教學拼字遊戲生成器。</p>
            </div>
        </div>
        <div className="flex gap-2 notranslate" data-notranslate>
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
        <div className="lg:col-span-4 space-y-6 notranslate" data-notranslate>
            
            {/* Title Input */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 notranslate" data-notranslate>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Puzzle Title</label>
                <input 
                    type="text" 
                    value={puzzleTitle}
                    onChange={(e) => setPuzzleTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white text-gray-900 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                />
            </div>

            {/* CURRICULUM SELECTOR */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 border-l-4 border-l-purple-500 notranslate" data-notranslate>
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
                        <div key={index} className="grid grid-flow-col auto-cols-max gap-2 items-center animate-in fade-in slide-in-from-top-2 duration-200 notranslate" data-notranslate>
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
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-4 notranslate" data-notranslate>
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

            </div>
            
             <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800 text-sm flex gap-3 notranslate" data-notranslate>
                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                <p>
                    {activeTab === 'crossword' && "Tip: Use more words for a denser crossword."}
                    {activeTab === 'dga' && "Tip: DGA Logic requires words with shared letters."}
                    {activeTab === 'tictac' && "Tip: Use 30+ words for best variety. Include POS (n., v.) in clues for Medium/Hard modes."}
                </p>
            </div>
        </div>

        {/* RIGHT COLUMN: Preview & Actions */}
        <div className="lg:col-span-8 space-y-6 notranslate" data-notranslate>
            
            {renderStatusCard()}

            {/* Toolbar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap gap-4 justify-between items-center notranslate" data-notranslate>
                
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
             <div ref={containerRef} className="bg-gray-200 rounded-xl border border-gray-300 p-8 grid place-items-center min-h-125 overflow-hidden shadow-inner notranslate" data-notranslate>
                 {isWordListEmpty ? (
                    <div className="grid place-items-center text-center gap-6">
                        <Library size={72} className="text-gray-400" />
                        <div className="space-y-2">
                            <p className="text-xl font-semibold text-gray-700">Select a Curriculum to Get Started / 請選擇課程以開始</p>
                            <p className="text-sm text-gray-500">Choose a book and week from the sidebar.</p>
                        </div>
                    </div>
                 ) : activeTabHasRender ? (
                    <canvas 
                        ref={canvasRef} 
                        className="shadow-2xl bg-white max-w-full"
                        style={{ maxHeight: '80vh' }}
                    />
                 ) : (
                    <div className="grid place-items-center text-center gap-4">
                        <RefreshCw size={48} className="text-gray-400" />
                        <p className="text-base font-medium text-gray-600">{generatePrompts[activeTab]}</p>
                    </div>
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
