
import React from 'react';
import { Verdict } from '../types';

interface Props {
  verdict: Verdict;
}

const VerdictBadge: React.FC<Props> = ({ verdict }) => {
  const getColors = () => {
    switch (verdict) {
      case Verdict.REAL:
        return 'bg-green-100 text-green-800 border-green-500';
      case Verdict.SUSPICIOUS:
        return 'bg-yellow-100 text-yellow-800 border-yellow-500';
      case Verdict.LIKELY_FAKE:
        return 'bg-red-100 text-red-800 border-red-500';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-500';
    }
  };

  const getIcon = () => {
    switch (verdict) {
      case Verdict.REAL:
        return 'fa-check-circle';
      case Verdict.SUSPICIOUS:
        return 'fa-exclamation-triangle';
      case Verdict.LIKELY_FAKE:
        return 'fa-skull-crossbones';
      default:
        return 'fa-question-circle';
    }
  };

  return (
    <div className={`flex items-center gap-3 px-6 py-4 rounded-xl border-4 font-bold text-2xl uppercase tracking-wider ${getColors()}`}>
      <i className={`fas ${getIcon()} text-4xl`}></i>
      <span>{verdict}</span>
    </div>
  );
};

export default VerdictBadge;
