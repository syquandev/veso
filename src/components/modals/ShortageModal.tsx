import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, Plus, Edit3, Settings } from 'lucide-react';
import { Shortage } from '../../types';

interface ShortageModalProps {
  shortages: Shortage[];
  setShortages: React.Dispatch<React.SetStateAction<Shortage[]>>;
  addTicketsToInventory: (stationId: string, numberStr: string, qty: number) => void;
  setEditingSellerId: (id: string | null) => void;
  setIsSellerPrefOpen: (v: boolean) => void;
}

export const ShortageModal: React.FC<ShortageModalProps> = ({
  shortages,
  setShortages,
  addTicketsToInventory,
  setEditingSellerId,
  setIsSellerPrefOpen
}) => {
  return (
    <AnimatePresence>
      {shortages.length > 0 && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white/5 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
          >
            <div className="bg-rose-500/100 p-8 text-white relative overflow-hidden">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-2">
                  <AlertCircle size={24} />
                  <h3 className="text-2xl font-bold">Thiếu hụt kho vé!</h3>
                </div>
                <p className="opacity-90 font-medium">Hệ thống không tìm đủ vé để chia cho một số người bán.</p>
              </div>
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
            </div>

            <div className="p-8">
              <div className="space-y-4 max-h-[400px] overflow-y-auto mb-6 pr-2">
                {shortages.map((s, idx) => (
                  <div key={idx} className="flex flex-col gap-3 p-5 bg-rose-500/10 rounded-3xl border border-rose-500/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-white/90 text-lg">{s.sellerName}</div>
                        <div className="text-xs font-bold text-rose-400 uppercase mt-1">
                          Thiếu {s.needed} số {s.station === 'main' ? 'Đài Chính' : s.station === 'ưu tiên' ? 'Số Ưu Tiên' : `Đài Phụ (${s.station})`}
                        </div>
                      </div>
                      <div className="text-rose-400">
                        <AlertCircle size={24} />
                      </div>
                    </div>

                    {s.missingNumber && (
                      <div className="flex flex-col gap-2 mt-2 pt-3 border-t border-rose-500/20/50">
                        <p className="text-xs text-white/50 font-medium italic">
                          Số bị thiếu: <span className="text-rose-400 font-bold text-sm">{s.missingNumber}</span>
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              addTicketsToInventory(s.station, s.missingNumber!, s.needed);
                              setShortages(prev => prev.filter((_, i) => i !== idx));
                            }}
                            className="flex-1 py-2.5 bg-white/5 text-rose-400 border border-rose-200 rounded-xl text-[10px] font-bold hover:bg-rose-100 transition-all flex items-center justify-center gap-1"
                          >
                            <Plus size={12} /> Thêm {s.needed} vé
                          </button>
                          <button 
                            onClick={() => {
                              setEditingSellerId(s.sellerId);
                              setIsSellerPrefOpen(true);
                              setShortages([]);
                            }}
                            className="flex-1 py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-1"
                          >
                            <Edit3 size={12} /> Đổi số khác
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!s.missingNumber && (
                      <div className="mt-2 pt-3 border-t border-rose-500/20/50">
                        <button 
                          onClick={() => {
                            setEditingSellerId(s.sellerId);
                            setIsSellerPrefOpen(true);
                            setShortages([]);
                          }}
                          className="w-full py-2.5 bg-rose-500 text-white rounded-xl text-[10px] font-bold hover:bg-rose-600 transition-all flex items-center justify-center gap-1"
                        >
                          <Settings size={12} /> Điều chỉnh người bán
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setShortages([])}
                  className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-white/90 transition-all shadow-lg shadow-white/10"
                >
                  Đóng và tự xử lý
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
