import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface QrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrModal: React.FC<QrModalProps> = ({ isOpen, onClose }) => {
  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyLink = () => {
    const url = process.env.SHARED_APP_URL || process.env.APP_URL || window.location.origin;
    navigator.clipboard.writeText(url).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="glass-card rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col items-center p-8 text-center"
          >
            <div className="w-16 h-16 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 mb-6">
              <QrCode size={32} />
            </div>
            <h3 className="text-xl font-bold text-white/90 mb-2">Quét Mã QR Để Cài Đặt</h3>
            <p className="text-sm text-white/50 mb-6">Dùng camera điện thoại quét mã này để mở ứng dụng và cài đặt vào màn hình chính.</p>

            <div className="p-4 bg-white/5 border-4 border-slate-50 rounded-2xl shadow-inner mb-6">
              <QRCodeSVG
                value={process.env.SHARED_APP_URL || process.env.APP_URL || window.location.origin}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            <div className="mb-6 w-full text-left">
              <p className="text-[10px] text-white/40 uppercase font-bold mb-1">Link Cài Đặt</p>
              <div className="flex items-center gap-2 bg-white/3 p-3 rounded-xl border border-white/5">
                <span className="text-xs text-white/60 font-medium truncate flex-1">
                  {process.env.SHARED_APP_URL || process.env.APP_URL || window.location.origin}
                </span>
                <button
                  onClick={handleCopyLink}
                  className="text-[10px] font-bold text-indigo-400 hover:text-indigo-400 whitespace-nowrap"
                >
                  {copySuccess ? 'Đã chép!' : 'Sao chép'}
                </button>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-white/90 transition-all"
            >
              Đóng
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
