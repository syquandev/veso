import { Printer, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { DistributionResult } from '../../types';

interface HistoryTabProps {
  history: DistributionResult[][];
  handlePrintResults: (results: DistributionResult[]) => void;
}

export const HistoryTab = ({ history, handlePrintResults }: HistoryTabProps) => {
  const groupedHistory = (() => {
    const map = new Map<string, Map<string, DistributionResult>>();
    [...history].reverse().flat().forEach(res => {
      if (!res.date) return;
      if (!map.has(res.date)) map.set(res.date, new Map());
      map.get(res.date)!.set(res.sellerId, res);
    });
    return Array.from(map.entries())
      .map(([date, sellersMap]) => ({ date, results: Array.from(sellersMap.values()) }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  })();

  return (
    <motion.div 
      key="history"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {groupedHistory.length > 0 ? (
        groupedHistory.map((group, dayIdx) => (
          <div key={dayIdx} className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-sm font-bold text-white/40 uppercase tracking-widest">{group.date}</span>
              <button 
                onClick={() => handlePrintResults(group.results)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs font-bold text-white/70 transition-all"
                title="In tất cả phiếu của ngày này"
              >
                <Printer size={14} />
                In Ngày
              </button>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {group.results.map((res) => (
                <div 
                  key={res.sellerId} 
                  onClick={() => handlePrintResults([res])}
                  className="surface-card p-5 rounded-2xl shadow-lg shadow-black/10 cursor-pointer hover:border-indigo-500/50 hover:bg-white/5 transition-all group relative overflow-hidden"
                >
                  <div className="flex justify-between items-center mb-4 relative z-10">
                    <span className="font-bold text-white/80 group-hover:text-indigo-400 transition-colors">{res.sellerName}</span>
                    <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20">Bộ {res.setName}</span>
                  </div>
                  <div className="space-y-3 relative z-10">
                    {res.mainStationNumbers.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold text-white/40 uppercase w-16">Chính:</span>
                        {res.mainStationNumbers.slice(0, 5).map(n => (
                          <span key={n} className="text-[11px] font-bold w-7 h-7 flex items-center justify-center bg-white/5 rounded border border-white/10 text-white/70">
                            {n}
                          </span>
                        ))}
                        {res.mainStationNumbers.length > 5 && <span className="text-[10px] text-white/30 italic font-medium">+{res.mainStationNumbers.length - 5} số</span>}
                      </div>
                    )}
                    {res.subStationResults.map(sr => (
                      <div key={sr.id} className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-[10px] font-bold text-white/40 uppercase w-16 truncate" title={sr.name}>{sr.name}:</span>
                        {sr.numbers.slice(0, 5).map(n => (
                          <span key={n} className="text-[11px] font-bold w-7 h-7 flex items-center justify-center bg-indigo-500/10 rounded border border-indigo-500/20 text-indigo-400">
                            {n}
                          </span>
                        ))}
                        {sr.numbers.length > 5 && <span className="text-[10px] text-white/30 italic font-medium">+{sr.numbers.length - 5} số</span>}
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/0 to-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="text-center py-20 text-white/40">
          <History size={48} className="mx-auto mb-4 opacity-20" />
          <p>Chưa có lịch sử phân phối.</p>
        </div>
      )}
    </motion.div>
  );
};
