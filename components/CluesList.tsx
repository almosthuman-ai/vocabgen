import React from 'react';
import { PlacedWord } from '../types';
import { CrosswordMode } from './CrosswordCanvas';

interface CluesListProps {
  words: PlacedWord[];
  mode: CrosswordMode;
}

// Helper to parse clue string into POS and Definition
export const parseClue = (fullClue: string) => {
  // Regex looks for "n.", "v.", "adj.", "adv.", "prep." at start, followed by optional colon
  const regex = /^([a-z]{1,5}\.)\s*:?\s*(.*)/i;
  const match = fullClue.match(regex);
  if (match) {
      return { pos: match[1].toLowerCase(), definition: match[2] };
  }
  return { pos: null, definition: fullClue };
};

const CluesList: React.FC<CluesListProps> = ({ words, mode }) => {
  
  if (mode === 'deduction') {
    // Group words by length
    const byLength: Record<number, string[]> = {};
    words.forEach(w => {
      const len = w.word.length;
      if (!byLength[len]) byLength[len] = [];
      byLength[len].push(w.word);
    });
    
    const lengths = Object.keys(byLength).map(Number).sort((a, b) => a - b);

    return (
        <div className="mt-6 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-bold mb-4 border-b pb-2">Word Bank</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {lengths.map(len => (
                    <div key={len}>
                        <h4 className="font-bold text-gray-900 mb-2">{len} Letters</h4>
                        <div className="flex flex-wrap gap-2">
                            {byLength[len].map(word => (
                                <span key={word} className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-sm font-mono border border-gray-200">
                                    {word}
                                </span>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
  }

  // Standard Mode
  const across = words.filter(w => w.direction === 'across').sort((a, b) => a.number - b.number);
  const down = words.filter(w => w.direction === 'down').sort((a, b) => a.number - b.number);

  const renderClueItem = (w: PlacedWord, index: number, prefix: string) => {
      const { pos, definition } = parseClue(w.clue);

      return (
        <li key={`${prefix}-${index}`} className="text-sm leading-relaxed">
            <span className="font-bold mr-1.5">{w.number}.</span>
            
            {pos && (
                <span className="inline-block bg-gray-100 text-gray-500 text-xs font-medium px-1.5 py-0.5 rounded mr-1.5 border border-gray-200">
                    {pos}
                </span>
            )}
            
            <span className="text-gray-700">{definition}</span>
            <span className="text-xs text-gray-400 ml-2">({w.word.length})</span>
        </li>
      );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold mb-4 border-b pb-2">Across</h3>
        <ul className="space-y-3">
          {across.map((w, i) => renderClueItem(w, i, 'across'))}
          {across.length === 0 && <li className="text-gray-400 italic">No across clues</li>}
        </ul>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold mb-4 border-b pb-2">Down</h3>
        <ul className="space-y-3">
          {down.map((w, i) => renderClueItem(w, i, 'down'))}
           {down.length === 0 && <li className="text-gray-400 italic">No down clues</li>}
        </ul>
      </div>
    </div>
  );
};

export default CluesList;