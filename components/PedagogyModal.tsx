import React, { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';

export type PedagogySectionKey = 'global' | 'crossword' | 'dga' | 'tictac';

export type PedagogyLanguage = 'zh' | 'en';

interface PedagogySectionCopy {
  title: string;
  body: string | string[];
}

interface PedagogyCopySet {
  zh: PedagogySectionCopy;
  en: PedagogySectionCopy;
}

export const PEDAGOGY_SECTIONS: Record<PedagogySectionKey, PedagogyCopySet> = {
  global: {
    zh: {
      title: '效率的秘密',
      body: [
        '傳統單字抄寫（每個字寫三遍）屬於被動且乏味的無意識抄寫，學生經常不經思考就完成。',
        '這些謎題要求「評鑑式重複」：為了解出任何一個提示，學生必須多次巡覽並主動評估整份單字表。',
        '這種隱性高頻複習被包裝成遊戲情境，促發主動處理，讓我的學生把單字掌握時間縮短約五成。',
      ],
    },
    en: {
      title: 'The Efficiency Secret',
      body: [
        'Traditional homework (writing words 3 times) is passive and boring; students often copy without thinking.',
        'These puzzles require Evaluative Repetition. To answer a single clue, a student must scan and evaluate their entire word list multiple times.',
        'This provides massive repetition disguised as a game. In my classes, this Active Processing has reduced vocabulary learning time by 50%.',
      ],
    },
  },
  crossword: {
    zh: {
      title: 'Crossword 教學邏輯',
      body: '將焦點從單純翻譯轉向語意理解。學生不再只是抄寫中文翻譯，而是必須解析英文定義來鎖定正確字彙，強化單字與語意的長期連結。',
    },
    en: {
      title: 'Crossword Logic',
      body: 'Shifts focus from Translation to Comprehension. Instead of just copying a Chinese translation, the student must process the English definition to find the word. This strengthens the semantic link between the word and its meaning.',
    },
  },
  dga: {
    zh: {
      title: 'DGA 邏輯推拼',
      body: '阻止字形猜測。一般填空題會讓學生用字長猜答案；DGA 強迫學習者進行字位分析（例如：第二個字母是 A），把拼字轉化為邏輯推理，促使大腦精準記錄字母順序。',
    },
    en: {
      title: 'DGA Logic',
      body: 'Prevents Word Shape Guessing. Standard fill-in-the-blanks allow students to guess based on word length. DGA forces Graphemic Analysis—looking at specific letter positions (e.g., 2nd letter is A). This turns spelling into a logic problem, forcing the brain to encode the exact spelling sequence.',
    },
  },
  tictac: {
    zh: {
      title: 'Tic-Tac-Word 遊戲設計',
      body: '遊戲化提取練習。學生在時間壓力下，依據條件（例如：開頭是 B）驗證字彙，從個人背誦轉為高能量的團隊協作，快速累積流暢度。',
    },
    en: {
      title: 'Tic-Tac-Word',
      body: 'Gamified Retrieval Practice. This builds fluency by forcing students to verify words against constraints (e.g., Starts with B) under time pressure. It transforms solitary study into high-energy group collaboration.',
    },
  },
};

export interface PedagogyModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: 'crossword' | 'dga' | 'tictac';
  language?: PedagogyLanguage;
  onLanguageChange?: (language: PedagogyLanguage) => void;
  defaultLanguage?: PedagogyLanguage;
}

const LANGUAGE_LABEL: Record<PedagogyLanguage, string> = {
  zh: '中文',
  en: 'English',
};

const order: PedagogySectionKey[] = ['global', 'crossword', 'dga', 'tictac'];

const PedagogyModal: React.FC<PedagogyModalProps> = ({
  isOpen,
  onClose,
  activeTab,
  language,
  onLanguageChange,
  defaultLanguage = 'zh',
}) => {
  const [internalLanguage, setInternalLanguage] = useState<PedagogyLanguage>(defaultLanguage);
  const resolvedLanguage = language ?? internalLanguage;

  const setLanguage = (next: PedagogyLanguage) => {
    if (onLanguageChange) onLanguageChange(next);
    if (language === undefined) {
      setInternalLanguage(next);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (language === undefined) {
        setInternalLanguage(defaultLanguage);
      }
      const previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = previousOverflow;
      };
    }
    return undefined;
  }, [isOpen, defaultLanguage, language]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const highlightedSection = useMemo(() => {
    switch (activeTab) {
      case 'crossword':
        return 'crossword';
      case 'dga':
        return 'dga';
      case 'tictac':
        return 'tictac';
      default:
        return 'global';
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pedagogy-modal-title"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-hidden bg-white text-gray-900 shadow-2xl md:h-auto md:max-h-[90vh] md:w-[90vw] md:max-w-3xl md:rounded-2xl"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-5 py-3">
          <h2 id="pedagogy-modal-title" className="text-lg font-bold text-gray-900">
            教學設計理念 / Pedagogical Insight
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-gray-200 bg-white p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close pedagogy modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-3 border-b border-gray-200 bg-white px-5 py-3 text-sm font-semibold">
          {(['zh', 'en'] as PedagogyLanguage[]).map(code => (
            <button
              key={code}
              type="button"
              onClick={() => setLanguage(code)}
              className={`rounded-full px-4 py-1.5 transition ${
                resolvedLanguage === code
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {LANGUAGE_LABEL[code as PedagogyLanguage]}
            </button>
          ))}
        </div>

        <div className="scrollbar-thin scrollbar-track-gray-100 scrollbar-thumb-gray-300 flex-1 overflow-y-auto px-5 py-6">
          <div className="space-y-5">
            {order.map(sectionKey => {
              const copySet = PEDAGOGY_SECTIONS[sectionKey];
              const copy = copySet[resolvedLanguage];
              const isActive = sectionKey === highlightedSection || (sectionKey === 'global' && highlightedSection === 'global');
              const bodyLines = Array.isArray(copy.body) ? copy.body : [copy.body];

              return (
                <section
                  key={sectionKey}
                  className={`rounded-xl border p-5 shadow-sm transition ${
                    isActive
                      ? 'border-blue-200 bg-blue-50/60 ring-2 ring-blue-200'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <header className="mb-2 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">{copy.title}</h3>
                    {sectionKey !== 'global' && isActive && (
                      <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs font-semibold text-white">
                        Active
                      </span>
                    )}
                  </header>
                  <div className="space-y-2 text-sm leading-relaxed text-gray-700">
                    {bodyLines.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PedagogyModal;
