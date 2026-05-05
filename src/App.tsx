import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  Ticket, 
  History, 
  Settings, 
  Plus, 
  Trash2, 
  Play, 
  Calendar, 
  ChevronRight, 
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Target,
  Hash,
  Edit3,
  X,
  ChevronDown,
  Save,
  RefreshCw,
  Download,
  QrCode,
  Star,
  Layers,
  ArrowRightLeft,
  LayoutDashboard,
  Printer,
  Search,
  MinusCircle,
  Menu,
  ChevronUp,
  Bell,
  Zap,
  ShieldCheck,
  SlidersHorizontal,
  Gauge,
  ClipboardList,
  ChevronLeft,
  ChevronFirst,
  ChevronLast
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { QrModal } from './components/modals/QrModal';
import { ShortageModal } from './components/modals/ShortageModal';
import { HistoryTab } from './components/tabs/HistoryTab';
import { motion, AnimatePresence } from 'framer-motion';
import { Seller, DistributionResult, DailyInput, LotterySet, Shortage, WeeklySchedule, DailyStationConfig } from './types';
import { INITIAL_SELLERS, LOTTERY_SETS, DOUBLE_SETS, getPairId } from './constants';
import { distributeTickets } from './utils/lotteryLogic';

const BrandLogo = ({ className = "w-8 h-8" }: { className?: string }) => (
  <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M 8 8 L 20 28" stroke="#818CF8" strokeWidth="8" strokeLinecap="round" />
    <path d="M 32 8 L 20 28" stroke="#38BDF8" strokeWidth="8" strokeLinecap="round" opacity="0.9" />
    <circle cx="20" cy="28" r="4.5" fill="#FFFFFF" />
  </svg>
);
export default function App() {
  const [sellers, setSellers] = useState<Seller[]>(INITIAL_SELLERS);
  const [lotterySets, setLotterySets] = useState<LotterySet[]>(LOTTERY_SETS);
  const [dailyInput, setDailyInput] = useState<DailyInput>({
    date: new Date().toISOString().split('T')[0],
    mainStationTickets: {},
    subStations: [
      { id: 'sub1', name: 'Đài Phụ 1', tickets: {} },
      { id: 'sub2', name: 'Đài Phụ 2', tickets: {} }
    ]
  });
  const [currentPools, setCurrentPools] = useState<{ main: Record<string, number>, subPools: Record<string, Record<string, number>> }>({
    main: {},
    subPools: { 'sub1': {}, 'sub2': {} }
  });
  const [results, setResults] = useState<DistributionResult[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [history, setHistory] = useState<DistributionResult[][]>([]);
  const [activeTab, setActiveTab] = useState<'distribute' | 'sellers' | 'history'>('distribute');
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingStation, setEditingStation] = useState<string>('main');
  const [isSetManagerOpen, setIsSetManagerOpen] = useState(false);
  const [editingSet, setEditingSet] = useState<LotterySet | null>(null);
  const [setInventory, setSetInventory] = useState<Record<string, Record<string, { q16: number, q32: number }>>>({});
  // BUG FIX: typed properly instead of 'any'
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSellerPrefOpen, setIsSellerPrefOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [distributeLeftPage, setDistributeLeftPage] = useState(1);
  const [distributeRightPage, setDistributeRightPage] = useState(1);
  const [editingSellerId, setEditingSellerId] = useState<string | null>(null);
  const [isQuickSelectOpen, setIsQuickSelectOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // BUG FIX: Use React state instead of DOM manipulation for grid toggle
  const [isFullGridOpen, setIsFullGridOpen] = useState(false);
  // UI: Mobile sidebar toggle
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [weeklySchedules, setWeeklySchedules] = useState<WeeklySchedule[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      mainStationBaseQuantity: 160, // Default 160 tickets
      subStationBaseQuantities: { 'sub1': 0, 'sub2': 0 },
      isActive: false
    }))
  );
  const [isWeeklyScheduleOpen, setIsWeeklyScheduleOpen] = useState(false);
  const [doubleSets, setDoubleSets] = useState<Record<string, string>>(DOUBLE_SETS);
  const [isDoubleSetManagerOpen, setIsDoubleSetManagerOpen] = useState(false);
  const [stationConfigs, setStationConfigs] = useState<DailyStationConfig[]>(
    Array.from({ length: 7 }, (_, i) => ({
      dayOfWeek: i,
      mainStationName: i === 0 ? 'Kiên Giang' : i === 1 ? 'TP.HCM' : i === 2 ? 'Bến Tre' : i === 3 ? 'Cần Thơ' : i === 4 ? 'Tây Ninh' : i === 5 ? 'Vĩnh Long' : 'TP.HCM',
      subStations: [
        { id: 'sub1', name: 'Đài Phụ 1' },
        { id: 'sub2', name: 'Đài Phụ 2' }
      ]
    }))
  );
  const [searchNumber, setSearchNumber] = useState('');
  const [adjustAmount, setAdjustAmount] = useState<number>(1);

  const getTargetTickets = useCallback((seller: Seller) => {
    const isSaturday = new Date(dailyInput.date).getDay() === 6;
    if (isSaturday) {
      return (seller.saturdayTickets ?? seller.targetTotalTickets) + (seller.saturdayBonus || 0);
    }
    return seller.targetTotalTickets;
  }, [dailyInput.date]);

  const addTicketsToInventory = (station: string, number: string, quantity: number) => {
    setDailyInput(prev => {
      if (station === 'main' || station === 'ưu tiên') {
        return {
          ...prev,
          mainStationTickets: {
            ...prev.mainStationTickets,
            [number]: (prev.mainStationTickets[number] || 0) + quantity
          }
        };
      } else {
        return {
          ...prev,
          subStations: prev.subStations.map(sub => 
            sub.id === station 
              ? { ...sub, tickets: { ...sub.tickets, [number]: (sub.tickets[number] || 0) + quantity } }
              : sub
          )
        };
      }
    });
  };

  // Apply weekly schedule when date changes
  useEffect(() => {
    const date = new Date(dailyInput.date);
    const dayOfWeek = date.getDay();
    const schedule = weeklySchedules.find(s => s.dayOfWeek === dayOfWeek);
    
    if (schedule && schedule.isActive) {
      // If active, we could automatically fill the inventory
      // But maybe it's better to just provide a "Apply Schedule" button to avoid overwriting manual work
    }
  }, [dailyInput.date, weeklySchedules]);

  const updateSetInventory = (setId: string, type: 'q16' | 'q32', val: number) => {
    const currentInv = setInventory[editingStation]?.[setId] || { q16: 0, q32: 0 };
    const newQ16 = type === 'q16' ? val : currentInv.q16;
    const newQ32 = type === 'q32' ? val : currentInv.q32;
    const totalPerNum = (newQ16 * 16) + (newQ32 * 32);

    setSetInventory(prev => ({
      ...prev,
      [editingStation]: {
        ...(prev[editingStation] || {}),
        [setId]: { q16: newQ16, q32: newQ32 }
      }
    }));

    const set = lotterySets.find(s => s.id === setId);
    if (!set) return;

    setDailyInput(prev => {
      if (editingStation === 'main') {
        const newMain = { ...prev.mainStationTickets };
        set.numbers.forEach(n => {
          if (totalPerNum <= 0) delete newMain[n];
          else newMain[n] = totalPerNum;
        });
        return { ...prev, mainStationTickets: newMain };
      } else {
        const newSubs = prev.subStations.map(s => {
          if (s.id === editingStation) {
            const newTickets = { ...s.tickets };
            set.numbers.forEach(n => {
              if (totalPerNum <= 0) delete newTickets[n];
              else newTickets[n] = totalPerNum;
            });
            return { ...s, tickets: newTickets };
          }
          return s;
        });
        return { ...prev, subStations: newSubs };
      }
    });
  };

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBtn(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handlePrint = (res: DistributionResult) => {
    handlePrintResults([res]);
  };

  const getDraftResults = (sellerId?: string): DistributionResult[] => {
    const day = new Date(dailyInput.date).getDate();
    const baseSetIndex = (day - 1) % lotterySets.length;
    
    const targetSellers = sellerId 
      ? sellers.filter(s => s.id === sellerId)
      : sellers.filter(s => s.isEnabled);

    return targetSellers.map((seller) => {
      const sIdx = sellers.findIndex(s => s.id === seller.id);
      let startSetIndex = baseSetIndex;
      if (seller.fixedSetId) {
        const fixedIdx = lotterySets.findIndex(ls => ls.id === seller.fixedSetId);
        if (fixedIdx !== -1) startSetIndex = fixedIdx;
      } else if (seller.isAutoMode) {
        startSetIndex = (baseSetIndex + sIdx) % lotterySets.length;
      } else if (seller.manualSetId) {
        const manualIdx = lotterySets.findIndex(ls => ls.id === seller.manualSetId);
        if (manualIdx !== -1) startSetIndex = manualIdx;
      }
      
      const startSet = lotterySets[startSetIndex] || { id: '??' };
      
      // Calculate split using GLOBAL pool ratio (same as distributeTickets)
      const totalMainPool = (Object.values(dailyInput.mainStationTickets) as number[]).reduce((a, b) => a + b, 0);
      const totalSubPools: Record<string, number> = {};
      dailyInput.subStations.forEach(sub => {
        totalSubPools[sub.id] = (Object.values(sub.tickets) as number[]).reduce((a, b) => a + b, 0);
      });
      const totalAllPool = totalMainPool + Object.values(totalSubPools).reduce((a, b) => a + b, 0);
      const globalRatio = totalAllPool > 0 ? totalMainPool / totalAllPool : 0.7;
      const sellerTarget = getTargetTickets(seller);
      const mainQty = seller.mainEnabled ? Math.round(sellerTarget * globalRatio) : 0;
      const remainingSub = sellerTarget - mainQty;
      const totalSubPoolSum = Object.values(totalSubPools).reduce((a, b) => a + b, 0);
      
      const subResults = dailyInput.subStations
        .filter(sub => totalSubPools[sub.id] > 0)
        .map(sub => {
          const subRatio = totalSubPoolSum > 0 ? totalSubPools[sub.id] / totalSubPoolSum : 1 / dailyInput.subStations.length;
          const qty = Math.round(remainingSub * subRatio);
          return {
            id: sub.id,
            name: sub.name,
            numbers: [],
            quantities: { "Dự kiến": qty }
          };
        }).filter(sr => (Object.values(sr.quantities)[0] as number) > 0);

      return {
        date: dailyInput.date,
        sellerId: seller.id,
        sellerName: seller.name,
        setName: startSet.id,
        mainStationNumbers: [],
        mainStationQuantities: mainQty > 0 ? { "Dự kiến": mainQty } : {},
        subStationResults: subResults,
        totalSheets: getTargetTickets(seller)
      };
    });
  };

  const handlePrintResults = (resultsToPrint: DistributionResult[]) => {
    if (resultsToPrint.length === 0) {
      alert("Không có dữ liệu để in.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Trình duyệt của bạn đã chặn popup! Vui lòng cho phép trang web này mở popup để in phiếu.");
      return;
    }

    const allTickets: string[] = [];

    resultsToPrint.forEach((res) => {
      const config = stationConfigs.find(c => c.dayOfWeek === new Date(res.date).getDay());
      
      // Main station tickets
      Object.entries(res.mainStationQuantities || {}).forEach(([num, qty]) => {
        if (qty > 0) {
          const stationName = config?.mainStationName || 'Đài Chính';
          allTickets.push(`
            <div class="ticket">
              <div class="header">
                ${new Date(res.date).toLocaleDateString('vi-VN')} - ${stationName}
              </div>
              <div class="quantity">
                ${qty}
              </div>
              <div class="footer">
                <div class="seller-name">${res.sellerName} ${num !== 'Dự kiến' ? `- Số ${num}` : ''}</div>
                <div class="set-name">Bộ ${res.setName}</div>
              </div>
            </div>
          `);
        }
      });
      
      // Sub stations tickets
      res.subStationResults.forEach(sub => {
        Object.entries(sub.quantities || {}).forEach(([num, qty]) => {
          if (qty > 0) {
            allTickets.push(`
              <div class="ticket">
                <div class="header">
                  ${new Date(res.date).toLocaleDateString('vi-VN')} - ${sub.name}
                </div>
                <div class="quantity">
                  ${qty}
                </div>
                <div class="footer">
                  <div class="seller-name">${res.sellerName} ${num !== 'Dự kiến' ? `- Số ${num}` : ''}</div>
                  <div class="set-name">Bộ ${res.setName}</div>
                </div>
              </div>
            `);
          }
        });
      });
    });

    if (allTickets.length === 0) {
      alert("Không có vé nào được phân bổ cho lựa chọn này (có thể do hết vé trong kho hoặc người bán không có vé).");
      printWindow.close();
      return;
    }

    const html = `
      <html>
        <head>
          <title>In Phiếu Phân Phối</title>
          <style>
            @page {
              size: A4;
              margin: 5mm;
            }
            body { 
              margin: 0; 
              padding: 0; 
              font-family: sans-serif; 
            }
            .grid-container {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              grid-template-rows: repeat(5, 1fr);
              width: 200mm;
              height: 287mm;
              gap: 0;
              page-break-after: always;
            }
            .ticket { 
              border: 0.5pt solid #ccc; 
              padding: 5px; 
              display: flex; 
              flex-direction: column; 
              justify-content: space-between; 
              align-items: center;
              box-sizing: border-box;
              overflow: hidden;
              text-align: center;
            }
            .header { 
              font-size: 12px; 
              font-weight: bold; 
              color: #000;
              width: 100%;
              border-bottom: 1pt solid #000;
              padding-bottom: 1px;
            }
            .quantity { 
              font-size: 72px; 
              font-weight: 900; 
              line-height: 0.9;
              margin: 0;
              color: #000;
            }
            .footer { 
              width: 100%;
              display: flex;
              flex-direction: column;
              gap: 0;
              color: #000;
              border-top: 1pt solid #000;
              padding-top: 1px;
            }
            .seller-name {
              font-size: 24px;
              font-weight: 900;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
            }
            .set-name {
              font-size: 14px;
              font-weight: bold;
              line-height: 1;
            }
            @media print {
              .grid-container {
                page-break-after: always;
              }
              .grid-container:last-child {
                page-break-after: auto;
              }
            }
          </style>
        </head>
        <body>
          ${Array.from({ length: Math.ceil(allTickets.length / 20) }).map((_, i) => `
            <div class="grid-container">
              ${allTickets.slice(i * 20, (i + 1) * 20).join('')}
            </div>
          `).join('')}
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 500);
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const adjustInventory = (num: string, amount: number, stationId: string) => {
    if (!num || num.length !== 2) return;
    
    setDailyInput(prev => {
      let newState = { ...prev };
      if (stationId === 'main') {
        const current = prev.mainStationTickets[num] || 0;
        const newVal = Math.max(0, current + amount);
        const newMain = { ...prev.mainStationTickets };
        if (newVal === 0) delete newMain[num];
        else newMain[num] = newVal;
        newState = { ...prev, mainStationTickets: newMain };
      } else {
        const newSubs = prev.subStations.map(s => {
          if (s.id === stationId) {
            const current = s.tickets[num] || 0;
            const newVal = Math.max(0, current + amount);
            const newTickets = { ...s.tickets };
            if (newVal === 0) delete newTickets[num];
            else newTickets[num] = newVal;
            return { ...s, tickets: newTickets };
          }
          return s;
        });
        newState = { ...prev, subStations: newSubs };
      }
      return newState;
    });

    // Explicitly update current pools for immediate feedback
    setCurrentPools(prev => {
      if (stationId === 'main') {
        const current = prev.main[num] || 0;
        const newVal = Math.max(0, current + amount);
        const newMain = { ...prev.main };
        if (newVal === 0) delete newMain[num];
        else newMain[num] = newVal;
        return { ...prev, main: newMain };
      } else {
        const newSubPools = { ...prev.subPools };
        const subPool = newSubPools[stationId] || {};
        const current = subPool[num] || 0;
        const newVal = Math.max(0, current + amount);
        const newTickets = { ...subPool };
        if (newVal === 0) delete newTickets[num];
        else newTickets[num] = newVal;
        newSubPools[stationId] = newTickets;
        return { ...prev, subPools: newSubPools };
      }
    });
  };
  const handleCopyLink = () => {
    const url = process.env.SHARED_APP_URL || process.env.APP_URL || window.location.origin;
    navigator.clipboard.writeText(url);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
    }
  };

  const handleExportCSV = () => {
    if (results.length === 0) return;
    
    let csv = "Ngày,Người Bán,Bộ,Đài,Số,Số Tờ\n";
    results.forEach(res => {
      const config = stationConfigs.find(c => c.dayOfWeek === new Date(res.date).getDay());
      
      // Main
      Object.entries(res.mainStationQuantities || {}).forEach(([num, qty]) => {
        csv += `${res.date},${res.sellerName},${res.setName},${config?.mainStationName || 'Đài Chính'},${num},${qty}\n`;
      });
      
      // Subs
      res.subStationResults.forEach(sub => {
        Object.entries(sub.quantities || {}).forEach(([num, qty]) => {
          csv += `${res.date},${res.sellerName},${res.setName},${sub.name},${num},${qty}\n`;
        });
      });
    });

    const blob = new Blob(["\ufeff" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `chia_ve_${dailyInput.date}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackupData = () => {
    const data = {
      sellers,
      lotterySets,
      weeklySchedules,
      stationConfigs,
      history
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `backup_chia_ve_${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load history and sets from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('lottery_history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
    
    const savedSets = localStorage.getItem('lottery_sets');
    if (savedSets) setLotterySets(JSON.parse(savedSets));

    const savedSellers = localStorage.getItem('lottery_sellers');
    if (savedSellers) {
      try {
        const parsed = JSON.parse(savedSellers);
        if (Array.isArray(parsed)) setSellers(parsed);
      } catch (e) {
        console.error("Error parsing sellers", e);
      }
    }

    const savedWeekly = localStorage.getItem('lottery_weekly_schedule');
    if (savedWeekly) setWeeklySchedules(JSON.parse(savedWeekly));

    const savedDailyInput = localStorage.getItem('lottery_daily_input');
    if (savedDailyInput) {
      const parsed = JSON.parse(savedDailyInput);
      const today = new Date().toISOString().split('T')[0];
      if (parsed.date && parsed.date !== today) {
        // New day: reset inventory but keep station structure
        const resetInput = {
          ...parsed,
          date: today,
          mainStationTickets: {},
          subStations: (parsed.subStations || []).map((s: any) => {
            const config = stationConfigs.find(c => c.dayOfWeek === new Date(today).getDay());
            const subConfig = config?.subStations.find(sub => sub.id === s.id);
            return { ...s, name: subConfig?.name || s.name, tickets: {} };
          })
        };
        setDailyInput(resetInput);
        setSetInventory({});
        setResults([]);
        setShortages([]);
      } else {
        setDailyInput(parsed);
      }
    }

    const savedStationConfigs = localStorage.getItem('lottery_station_configs');
    if (savedStationConfigs) setStationConfigs(JSON.parse(savedStationConfigs));
  }, []);

  // Save sellers and sets when they change
  useEffect(() => {
    localStorage.setItem('lottery_sets', JSON.stringify(lotterySets));
  }, [lotterySets]);

  useEffect(() => {
    localStorage.setItem('lottery_sellers', JSON.stringify(sellers));
  }, [sellers]);

  useEffect(() => {
    localStorage.setItem('lottery_weekly_schedule', JSON.stringify(weeklySchedules));
  }, [weeklySchedules]);

  useEffect(() => {
    localStorage.setItem('lottery_daily_input', JSON.stringify(dailyInput));
  }, [dailyInput]);

  useEffect(() => {
    localStorage.setItem('lottery_station_configs', JSON.stringify(stationConfigs));
  }, [stationConfigs]);

  const applyWeeklySchedule = () => {
    const date = new Date(dailyInput.date);
    const dayOfWeek = date.getDay();
    const schedule = weeklySchedules.find(s => s.dayOfWeek === dayOfWeek);
    
    if (schedule && schedule.isActive) {
      const qty = schedule.mainStationBaseQuantity;
      const newMain: Record<string, number> = {};
      lotterySets.forEach(set => {
        set.numbers.forEach(num => {
          newMain[num] = qty;
        });
      });
      
      const newSubStations = dailyInput.subStations.map(sub => {
        const subQty = schedule.subStationBaseQuantities[sub.id] || 0;
        const newSubTickets: Record<string, number> = {};
        lotterySets.forEach(set => {
          set.numbers.forEach(num => {
            newSubTickets[num] = subQty;
          });
        });
        return { ...sub, tickets: newSubTickets };
      });

      setDailyInput(prev => ({ 
        ...prev, 
        mainStationTickets: newMain,
        subStations: newSubStations
      }));
      
      // Also update setInventory for visual consistency
      const newInv: Record<string, Record<string, { q16: number, q32: number }>> = {
        main: {}
      };
      lotterySets.forEach(set => {
        newInv.main[set.id] = { q16: Math.floor(qty / 16), q32: 0 };
      });
      
      newSubStations.forEach(sub => {
        newInv[sub.id] = {};
        const subQty = schedule.subStationBaseQuantities[sub.id] || 0;
        lotterySets.forEach(set => {
          newInv[sub.id][set.id] = { q16: Math.floor(subQty / 16), q32: 0 };
        });
      });

      setSetInventory(newInv);
    }
  };

  const handleDistribute = (sellerId?: string) => {
    setIsProcessing(true);
    
    // Determine which sellers to process
    const targetSellers = (sellerId 
      ? sellers.filter(s => s.id === sellerId)
      : sellers.filter(s => s.isEnabled)).map(s => ({
        ...s,
        targetTotalTickets: getTargetTickets(s)
      }));

    // Use current pools if distributing individually, otherwise use initial input
    const initialMain = sellerId ? currentPools.main : dailyInput.mainStationTickets;
    const initialSubPools: Record<string, Record<string, number>> = {};
    
    if (sellerId) {
      Object.assign(initialSubPools, currentPools.subPools);
    } else {
      dailyInput.subStations.forEach(s => {
        initialSubPools[s.id] = s.tickets;
      });
    }

    // BUG FIX: Removed artificial setTimeout(1000) delay - process immediately
    const report = distributeTickets(
      dailyInput.date,
      targetSellers,
      initialMain,
      dailyInput.subStations,
      lotterySets,
      doubleSets,
      history
    );
    
    if (sellerId) {
      // Individual mode: update result and update current pools
      setResults(prev => {
        const filtered = prev.filter(r => r.sellerId !== sellerId);
        return [...filtered, ...report.results];
      });
      setCurrentPools({
        main: report.updatedMainPool,
        subPools: report.updatedSubPools
      });
    } else {
      // Batch mode: replace results and update current pools from initial
      setResults(report.results);
      setCurrentPools({
        main: report.updatedMainPool,
        subPools: report.updatedSubPools
      });
    }
    
    setShortages(report.shortages);

    if (report.results.length > 0) {
      const updatedHistory = [report.results, ...history].slice(0, 30); // Keep 30 days
      setHistory(updatedHistory);
      localStorage.setItem('lottery_history', JSON.stringify(updatedHistory));
    }
    
    // Update seller set indices for next time (rotation) for auto-mode sellers
    const updatedSellers = sellers.map(s => {
      const isTarget = sellerId ? s.id === sellerId : s.isEnabled;
      if (isTarget && s.isAutoMode) {
        return {
          ...s,
          currentSetIndex: (s.currentSetIndex + 1) % lotterySets.length
        };
      }
      return s;
    });
    setSellers(updatedSellers);
    
    setIsProcessing(false);
  };

  const resetPools = () => {
    const initialSubPools: Record<string, Record<string, number>> = {};
    dailyInput.subStations.forEach(s => {
      initialSubPools[s.id] = { ...s.tickets };
    });

    setCurrentPools({
      main: { ...dailyInput.mainStationTickets },
      subPools: initialSubPools
    });
    setResults([]);
    setShortages([]);
  };

  useEffect(() => {
    // Sync current pools when daily input changes
    const initialSubPools: Record<string, Record<string, number>> = {};
    dailyInput.subStations.forEach(s => {
      initialSubPools[s.id] = { ...s.tickets };
    });

    setCurrentPools({
      main: { ...dailyInput.mainStationTickets },
      subPools: initialSubPools
    });
  }, [dailyInput.mainStationTickets, dailyInput.subStations]);

  const updateTicketQuantity = (num: string, qty: number, stationId: string) => {
    setDailyInput(prev => {
      if (stationId === 'main') {
        const newMain = { ...prev.mainStationTickets };
        if (qty <= 0) delete newMain[num];
        else newMain[num] = qty;
        return { ...prev, mainStationTickets: newMain };
      } else {
        const newSubStations = prev.subStations.map(s => {
          if (s.id === stationId) {
            const newTickets = { ...s.tickets };
            if (qty <= 0) delete newTickets[num];
            else newTickets[num] = qty;
            return { ...s, tickets: newTickets };
          }
          return s;
        });
        return { ...prev, subStations: newSubStations };
      }
    });

    // Also update current pools to stay in sync
    setCurrentPools(prev => {
      if (stationId === 'main') {
        const newMain = { ...prev.main };
        if (qty <= 0) delete newMain[num];
        else newMain[num] = qty;
        return { ...prev, main: newMain };
      } else {
        const newSubPools = { ...prev.subPools };
        const newTickets = { ...(newSubPools[stationId] || {}) };
        if (qty <= 0) delete newTickets[num];
        else newTickets[num] = qty;
        newSubPools[stationId] = newTickets;
        return { ...prev, subPools: newSubPools };
      }
    });
  };

  const totalMain = (Object.values(dailyInput?.mainStationTickets || {}) as number[]).reduce((a, b) => a + b, 0);
  const totalSub = (dailyInput?.subStations || []).reduce((acc, s) => acc + (Object.values(s?.tickets || {}) as number[]).reduce((a, b) => a + b, 0), 0);
  const totalTickets = totalMain + totalSub;
  const currentRatio = totalTickets > 0 ? Math.round((totalMain / totalTickets) * 100) : 70;

  const addSeller = () => {
    const newSeller: Seller = {
      id: Math.random().toString(36).substr(2, 9),
      name: `Người mới ${sellers.length + 1}`,
      setType: 'single',
      sheetsOption: '16',
      targetTotalTickets: 160,
      allocationMode: 'auto',
      currentSetIndex: 0,
      isAutoMode: true,
      isEnabled: true,
      mainEnabled: true,
      subStationRatios: { 'sub1': 20, 'sub2': 10 },
      customPreferences: [],
      fixedSetId: undefined
    };
    setSellers([...sellers, newSeller]);
  };

  const removeSeller = (id: string) => {
    setSellers(sellers.filter(s => s.id !== id));
  };

  const updateSeller = (id: string, updates: Partial<Seller>) => {
    setSellers(sellers.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateSetNumber = (setId: string, index: number, value: string) => {
    setLotterySets(prev => prev.map(set => {
      if (set.id === setId) {
        const newNumbers = [...set.numbers];
        newNumbers[index] = value.padStart(2, '0').slice(-2);
        return { ...set, numbers: newNumbers };
      }
      return set;
    }));
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[700px] h-[700px] bg-indigo-600/[0.03] rounded-full blur-[150px]" />
        <div className="absolute -bottom-32 right-1/4 w-[600px] h-[600px] bg-violet-600/[0.03] rounded-full blur-[150px]" />
      </div>

      {/* Mobile Overlay */}
      {isMobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-20 bg-[var(--bg-base)]/95 backdrop-blur-xl border-b border-white/[0.04] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors"
          >
            <Menu size={20} className="text-white/60" />
          </button>
          <div className="flex items-center gap-2.5">
            <BrandLogo className="w-8 h-8 drop-shadow-lg" />
            <span className="font-black text-[22px] tracking-[-0.04em] text-white leading-none">
              veso<span className="text-indigo-500">.</span>
            </span>
          </div>
        </div>
        <button 
          onClick={() => handlePrintResults(results.length > 0 ? results : getDraftResults())}
          className="p-2.5 bg-indigo-500/15 text-indigo-400 rounded-xl border border-indigo-500/20"
        >
          <Printer size={16} />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-[260px] bg-[var(--bg-surface)] border-r border-white/[0.04] flex flex-col z-40 transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Logo */}
        <div className="flex items-center gap-3.5 px-6 pt-8 pb-6">
          <BrandLogo className="w-[38px] h-[38px] drop-shadow-[0_0_15px_rgba(99,102,241,0.2)] shrink-0" />
          <h1 className="font-black text-[32px] leading-none tracking-[-0.05em] text-white">
            veso<span className="text-indigo-500">.</span>
          </h1>
        </div>

        {/* Global Date Picker */}
        <div className="px-5 mb-4">
          <div className="bg-white/5 border border-white/10 hover:bg-white/10 transition-colors rounded-xl px-3 py-2 cursor-pointer relative">
            <p className="text-[9px] font-bold text-white/30 uppercase tracking-[0.15em] mb-1.5">Ngày phân phối</p>
            <div className="relative flex items-center">
              <Calendar className="text-indigo-400 absolute left-0" size={14} />
              <input 
                type="date" 
                value={dailyInput.date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  if (newDate !== dailyInput.date) {
                    setDailyInput(prev => ({
                      ...prev,
                      date: newDate,
                      mainStationTickets: {},
                      subStations: prev.subStations.map(s => {
                        const config = stationConfigs.find(c => c.dayOfWeek === new Date(newDate).getDay());
                        const subConfig = config?.subStations.find(sub => sub.id === s.id);
                        return { ...s, name: subConfig?.name || s.name, tickets: {} };
                      })
                    }));
                    setSetInventory({});
                    setResults([]);
                    setShortages([]);
                  }
                }}
                className="w-full bg-transparent pl-6 pr-1 text-xs font-bold text-white/90 outline-none cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
              />
            </div>
          </div>
        </div>

        <div className="divider mx-5 mb-4" />

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-3 mb-5">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em] px-3 mb-2">Chính</p>
          {([
            { id: 'distribute' as const, icon: Play, label: 'Chia Vé' },
            { id: 'sellers' as const, icon: Users, label: 'Người Bán' },
            { id: 'history' as const, icon: History, label: 'Lịch Sử' },
          ]).map(item => (
            <button 
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsMobileSidebarOpen(false); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-[13px] font-medium ${
                activeTab === item.id 
                  ? 'bg-indigo-500/10 text-indigo-400 font-semibold' 
                  : 'text-white/45 hover:bg-white/[0.03] hover:text-white/65'
              }`}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              {activeTab === item.id && <div className="ml-auto w-1.5 h-1.5 bg-indigo-400 rounded-full" />}
            </button>
          ))}
        </nav>

        {/* Tools */}
        <div className="flex flex-col gap-0.5 px-3 mb-5">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em] px-3 mb-2">Công cụ</p>
          {[
            { icon: Edit3, label: 'Quản Lý Bộ Số', action: () => setIsSetManagerOpen(true) },
            { icon: Layers, label: 'Quản Lý Bộ Đôi', action: () => setIsDoubleSetManagerOpen(true) },
            { icon: Calendar, label: 'Lịch Trình Tuần', action: () => setIsWeeklyScheduleOpen(true) },
          ].map((tool, i) => (
            <button 
              key={i}
              onClick={tool.action}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/35 hover:bg-white/[0.03] hover:text-white/55 transition-all text-[13px]"
            >
              <tool.icon size={15} />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-0.5 px-3 mb-5">
          <p className="text-[9px] font-bold text-white/20 uppercase tracking-[0.15em] px-3 mb-2">Tác vụ</p>
          
          {showInstallBtn && (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl btn-primary text-[13px]"
            >
              <Download size={15} />
              <span>Cài Đặt App</span>
            </button>
          )}

          <button 
            onClick={() => setIsQrModalOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/35 hover:bg-white/[0.03] hover:text-white/55 transition-all text-[13px]"
          >
            <QrCode size={15} />
            <span>Mã QR Cài Đặt</span>
          </button>

          <button 
            onClick={handleExportCSV}
            disabled={results.length === 0}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-[13px] ${results.length > 0 ? 'text-emerald-400/60 hover:bg-emerald-500/5 hover:text-emerald-400' : 'text-white/12 cursor-not-allowed'}`}
          >
            <Download size={15} />
            <span>Xuất CSV</span>
          </button>

          <button 
            onClick={handleBackupData}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-white/35 hover:bg-white/[0.03] hover:text-white/55 transition-all text-[13px]"
          >
            <Save size={15} />
            <span>Sao Lưu</span>
          </button>
        </div>

        {/* Bottom stats */}
        <div className="mt-auto px-4 pb-5">
          <div className="p-4 bg-white/[0.02] rounded-2xl border border-white/[0.04]">
            <div className="flex items-center gap-2 text-[9px] font-bold text-white/25 uppercase tracking-[0.15em] mb-3">
              <TrendingUp size={11} />
              <span>Tỷ lệ kho vé</span>
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-medium text-white/40">Đài Chính</span>
                <span className="text-[11px] font-bold text-indigo-400">
                  {(() => {
                    const totalMain = Object.values(dailyInput.mainStationTickets).reduce((a, b) => a + b, 0) as number;
                    const totalSub = dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0), 0);
                    const total = totalMain + totalSub;
                    return total > 0 ? Math.round((totalMain / total) * 100) : 0;
                  })()}%
                </span>
              </div>
              {(dailyInput?.subStations || []).map(sub => {
                const subTotal = (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0);
                const ratio = totalTickets > 0 ? Math.round((subTotal / totalTickets) * 100) : 0;
                return (
                  <div key={sub.id} className="flex justify-between items-center">
                    <span className="text-[11px] font-medium text-white/40">{sub.name}</span>
                    <span className="text-[11px] font-bold text-emerald-400">{ratio}%</span>
                  </div>
                );
              })}
              <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden mt-1">
                <div className="h-full bg-gradient-to-r from-indigo-500/80 to-violet-500/80 rounded-full transition-all duration-500" style={{ width: `${(() => {
                  const totalMain = Object.values(dailyInput.mainStationTickets).reduce((a, b) => a + b, 0) as number;
                  const totalSub = dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0), 0);
                  const total = totalMain + totalSub;
                  return total > 0 ? Math.round((totalMain / total) * 100) : 0;
                })()}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-4 pt-20 lg:p-8 lg:ml-[260px] max-w-[1400px] mx-auto relative z-10">
        {/* Header */}
        {activeTab !== 'sellers' && (
          <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-6">
            <div className="flex items-center gap-10">
              <h2 className="text-2xl lg:text-3xl font-black tracking-tight text-white/90">
                {activeTab === 'distribute' && 'Hệ Thống Chia Vé'}
                {activeTab === 'history' && 'Lịch Sử Phân Phối'}
              </h2>
              
              {activeTab === 'distribute' && (
                <div className="hidden xl:flex items-center gap-8">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Tổng Kho</span>
                    <span className="text-xl font-black text-white/90">{totalTickets}</span>
                  </div>
                  <div className="w-px h-10 bg-white/[0.06]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Đài Chính</span>
                    <span className="text-xl font-black text-indigo-400">{(Object.values(currentPools.main) as number[]).reduce((a, b) => a + b, 0)}</span>
                  </div>
                  <div className="w-px h-10 bg-white/[0.06]" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-white/30 uppercase tracking-wider mb-1">Đài Phụ</span>
                    <span className="text-xl font-black text-emerald-400">{Object.values(currentPools.subPools).reduce((acc: number, pool) => acc + (Object.values(pool) as number[]).reduce((a, b) => a + b, 0), 0)}</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-4 flex-wrap">
              {activeTab === 'distribute' && (
                <button 
                  onClick={() => handlePrintResults(results.length > 0 ? results : getDraftResults())}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg ${results.length > 0 ? 'bg-white text-slate-900 shadow-white/10 hover:bg-white/90' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500/20'}`}
                >
                  <Printer size={16} />
                  <span>{results.length > 0 ? 'In Tất Cả Phiếu' : 'In Phiếu Dự Kiến'}</span>
                </button>
              )}

            </div>
          </header>
        )}

        <AnimatePresence>
          {activeTab === 'distribute' && (
            <motion.div 
              key="distribute"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 xl:grid-cols-5 gap-6"
            >
              {/* Left Panel: Kho Vé Ngày */}
              <div className="xl:col-span-3 space-y-6">
                <div className="bg-[#181824] p-6 rounded-2xl border border-white/5">
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                        <Calendar size={24} />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white/90">Kho Vé Ngày</h3>
                        <p className="text-xs text-white/40 font-medium">Nhập tổng vé hiện có cho phiên phân phối</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          if (confirm('Xóa toàn bộ kho vé? Dữ liệu sẽ về 0.')) {
                            setDailyInput(prev => ({
                              ...prev,
                              mainStationTickets: {},
                              subStations: prev.subStations.map(s => ({ ...s, tickets: {} }))
                            }));
                            setSetInventory({});
                            setCurrentPools({ main: {}, subPools: dailyInput.subStations.reduce((acc, s) => ({ ...acc, [s.id]: {} }), {} as Record<string, Record<string, number>>) });
                            setResults([]);
                            setShortages([]);
                          }
                        }}
                        className="w-10 h-10 bg-rose-500/10 flex items-center justify-center rounded-xl text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-colors"
                        title="Xóa toàn bộ kho vé"
                      >
                        <Trash2 size={18} />
                      </button>
                      <button 
                        onClick={() => setIsWeeklyScheduleOpen(true)}
                        className="w-10 h-10 bg-white/5 flex items-center justify-center rounded-xl text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                      >
                        <SlidersHorizontal size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Dashboard Summary & +% Scaling */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#13131A] p-4 rounded-xl border border-white/5">
                      <div className="text-[10px] font-bold text-white/40 uppercase mb-2">Tổng vé yêu cầu (Khách)</div>
                      <div className="text-2xl font-black text-indigo-400 mb-2">
                        {sellers.filter(s => s.isEnabled).reduce((acc, s) => acc + getTargetTickets(s), 0)} <span className="text-sm font-bold text-white/30">tờ</span>
                      </div>

                    </div>
                    <div className="bg-[#13131A] p-4 rounded-xl border border-white/5">
                      <div className="text-[10px] font-bold text-white/40 uppercase mb-2">Tổng vé hiện có (Kho)</div>
                      <div className={`text-2xl font-black mb-2 ${((Object.values(dailyInput.mainStationTickets) as number[]).reduce((a, b) => a + b, 0) + dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets) as number[]).reduce((a, b) => a + b, 0), 0)) >= sellers.filter(s => s.isEnabled).reduce((acc, s) => acc + getTargetTickets(s), 0) ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {((Object.values(dailyInput.mainStationTickets) as number[]).reduce((a, b) => a + b, 0) + dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets) as number[]).reduce((a, b) => a + b, 0), 0))} <span className="text-sm font-bold text-white/30">tờ</span>
                      </div>

                    </div>
                  </div>

                  {/* Search and Quick Adjust Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Tìm kiếm số (00-99)</label>
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Ví dụ: 88"
                          value={searchNumber}
                          onChange={(e) => setSearchNumber(e.target.value.slice(0, 2))}
                          className="w-full pl-4 pr-10 py-3 bg-[#13131A] border border-white/5 rounded-xl text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none placeholder:text-white/20"
                        />
                        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40" />
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Nhập số lượng</label>
                      <div className="flex items-center bg-[#13131A] rounded-xl border border-white/5 p-1 h-[46px]">
                        <button 
                          onClick={() => {
                            if (!searchNumber) return;
                            const num = searchNumber.length === 1 ? '0' + searchNumber : searchNumber;
                            adjustInventory(num, -adjustAmount, editingStation);
                          }}
                          disabled={!searchNumber}
                          className="w-10 h-full flex items-center justify-center text-indigo-400 hover:bg-white/5 rounded-lg transition-colors font-bold text-xl disabled:opacity-30"
                        >
                          -
                        </button>
                        <input 
                          type="number"
                          value={adjustAmount}
                          onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                          className="flex-1 w-full text-center bg-transparent border-none text-sm font-bold text-white/90 focus:ring-0 outline-none"
                        />
                        <button 
                          onClick={() => {
                            if (!searchNumber) return;
                            const num = searchNumber.length === 1 ? '0' + searchNumber : searchNumber;
                            adjustInventory(num, adjustAmount, editingStation);
                          }}
                          disabled={!searchNumber}
                          className="w-10 h-full flex items-center justify-center text-indigo-400 hover:bg-white/5 rounded-lg transition-colors font-bold text-xl disabled:opacity-30"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Station Tabs */}
                  <div className="flex bg-[#13131A] p-1 rounded-2xl mb-6 overflow-x-auto scrollbar-hide">
                    <button 
                      onClick={() => setEditingStation('main')}
                      className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-bold ${editingStation === 'main' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-white/40 hover:text-white/80'}`}
                    >
                      {stationConfigs.find(c => c.dayOfWeek === new Date(dailyInput.date).getDay())?.mainStationName || 'Đài Chính'}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${editingStation === 'main' ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                        {(Object.values(dailyInput.mainStationTickets) as number[]).reduce((a, b) => a + b, 0)}
                      </div>
                    </button>
                    {(dailyInput?.subStations || []).map(sub => {
                      const subConfig = stationConfigs.find(c => c.dayOfWeek === new Date(dailyInput.date).getDay())?.subStations.find(s => s.id === sub.id);
                      const total = (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0);
                      return (
                        <button 
                          key={sub.id}
                          onClick={() => setEditingStation(sub.id)}
                          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-3 rounded-xl transition-all text-xs font-bold ${editingStation === sub.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-white/40 hover:text-white/80'}`}
                        >
                          {subConfig?.name || sub.name}
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${editingStation === sub.id ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60'}`}>
                            {total}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Set List Header */}
                  <div className="grid grid-cols-12 gap-4 px-4 mb-3">
                    <div className="col-span-5 text-[10px] font-bold text-white/40 uppercase">Thông tin bộ số</div>
                    <div className="col-span-3 text-[10px] font-bold text-white/40 uppercase text-center">Trạng thái</div>
                    <div className="col-span-2 text-[10px] font-bold text-white/40 uppercase text-center">Bộ 16 vé</div>
                    <div className="col-span-2 text-[10px] font-bold text-white/40 uppercase text-center">Bộ 32 vé</div>
                  </div>

                  {/* Set List */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                    {lotterySets.map(set => {
                      const inv = setInventory[editingStation]?.[set.id] || { q16: 0, q32: 0 };
                      const totalTickets = (inv.q16 * 16 + inv.q32 * 32) * set.numbers.length;
                      
                      return (
                        <div key={set.id} className="bg-[#13131A] grid grid-cols-12 gap-4 items-center p-3 rounded-2xl border border-white/5 hover:border-white/10 transition-colors">
                          <div className="col-span-5 flex items-start gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0">
                              {set.id}
                            </div>
                            <div className="min-w-0 flex-1 pt-0.5">
                              <div className="text-xs font-bold text-white/90">Bộ {set.id}</div>
                              <div className="text-[10px] font-medium text-white/40 mt-1 leading-relaxed">
                                {set.numbers.join(', ')}
                              </div>
                            </div>
                          </div>
                          <div className="col-span-3 flex items-center justify-center">
                            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${totalTickets > 0 ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
                              <div className={`w-1.5 h-1.5 rounded-full ${totalTickets > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <span className="text-[10px] font-bold text-white/60">{inv.q16 * 16 + inv.q32 * 32} vé/số</span>
                            </div>
                          </div>
                          <div className="col-span-2 px-1">
                            <input 
                              type="number" 
                              value={inv.q16 || ''}
                              onChange={(e) => updateSetInventory(set.id, 'q16', parseInt(e.target.value) || 0)}
                              className="w-full bg-[#1A1A24] rounded-xl text-center py-2 text-xs font-bold text-white/80 border border-white/5 focus:border-indigo-500 outline-none"
                              placeholder="0"
                            />
                          </div>
                          <div className="col-span-2 px-1">
                            <input 
                              type="number" 
                              value={inv.q32 || ''}
                              onChange={(e) => updateSetInventory(set.id, 'q32', parseInt(e.target.value) || 0)}
                              className="w-full bg-[#1A1A24] rounded-xl text-center py-2 text-xs font-bold text-white/80 border border-white/5 focus:border-indigo-500 outline-none"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button 
                      onClick={() => setIsFullGridOpen(prev => !prev)}
                      className="px-6 py-2.5 bg-white/5 rounded-full text-xs font-bold text-white/60 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <span>Xem chi tiết 100 con</span>
                      <ChevronDown size={14} className={`transition-transform ${isFullGridOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                  
                  {isFullGridOpen && (
                    <div className="mt-6 grid grid-cols-5 md:grid-cols-10 gap-2 max-h-72 overflow-y-auto p-1 scrollbar-thin border-t border-white/5 pt-6">
                      {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).map(num => {
                        const qty = editingStation === 'main' 
                          ? dailyInput.mainStationTickets[num] || 0 
                          : (dailyInput.subStations.find(s => s.id === editingStation)?.tickets[num] || 0);
                        return (
                          <div key={num} className="flex flex-col items-center">
                            <span className="text-xs font-bold text-white/40 mb-1">{num}</span>
                            <input 
                              type="number" 
                              value={qty || ''}
                              onChange={(e) => updateTicketQuantity(num, parseInt(e.target.value) || 0, editingStation)}
                              className={`w-full text-center py-2 text-xs font-bold rounded-xl border transition-all ${qty > 0 ? 'bg-indigo-500/10 border-indigo-200 text-indigo-400' : 'bg-[#13131A] border-white/5 text-white/40 focus:border-indigo-500 outline-none'}`}
                              placeholder="0"
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Individual Distribution Panel */}
                <div className="bg-[#181824] p-6 rounded-2xl border border-white/5">
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white/90">Danh sách người nhận</h3>
                        <p className="text-xs text-white/40">Cấu hình & xử lý phân phối</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 sm:flex-initial">
                        <input 
                          type="text"
                          placeholder="Tìm người nhận..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="pl-9 pr-3 py-2 bg-[#13131A] border border-white/5 rounded-xl text-xs text-white/80 focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-44 placeholder:text-white/20"
                        />
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const filtered = sellers.filter(s => s.isEnabled && s.name.toLowerCase().includes(searchTerm.toLowerCase()));
                      const itemsPerPage = 9;
                      return filtered.slice((distributeLeftPage - 1) * itemsPerPage, distributeLeftPage * itemsPerPage).map(seller => {
                        const isDistributed = results.some(r => r.sellerId === seller.id);
                        const result = results.find(r => r.sellerId === seller.id);
                      
                      return (
                        <div key={seller.id} className={`p-4 rounded-2xl border transition-all ${isDistributed ? 'bg-[#13131A] border-white/5' : 'bg-[#1A1A24] border-white/5 hover:border-indigo-500/30'}`}>
                          <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${isDistributed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                                {seller.name.charAt(0)}
                              </div>
                              <div>
                                <span className="font-bold text-white/90 block">{seller.name}</span>
                                {!isDistributed && (
                                  <div className="flex items-center gap-2 mt-1">
                                    <button 
                                      onClick={() => updateSeller(seller.id, { mainEnabled: !seller.mainEnabled })}
                                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${seller.mainEnabled ? 'bg-indigo-500 text-white' : 'bg-[#13131A] border border-white/10 text-white/40'}`}
                                    >
                                      Chính
                                    </button>
                                    {(dailyInput?.subStations || []).map(sub => (
                                      <span key={sub.id} className="px-2 py-0.5 bg-[#13131A] border border-white/10 text-white/60 text-[11px] font-bold rounded uppercase">
                                        {sub.name}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                {/* Sở Thích Summary */}
                                {(seller.customPreferences || []).length > 0 && !isDistributed && (
                                  <div className="mt-3 flex flex-wrap gap-1 items-center">
                                    <div className="flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                      <Star size={8} fill="currentColor" />
                                      <span>SỞ THÍCH:</span>
                                    </div>
                                    {seller.customPreferences?.map((pref, i) => (
                                      <span key={i} className="px-1.5 py-0.5 bg-white/5 text-white/60 text-[11px] font-bold rounded border border-white/10">
                                        {pref.number} ({pref.quantity}t)
                                      </span>
                                    ))}
                                    <button 
                                      onClick={() => {
                                        setEditingSellerId(seller.id);
                                        setIsSellerPrefOpen(true);
                                      }}
                                      className="text-[11px] font-bold text-indigo-400 hover:underline ml-1"
                                    >
                                      Sửa
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {isDistributed ? (
                              <div className="flex items-center gap-1 text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                                <CheckCircle2 size={14} />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Hoàn tất</span>
                              </div>
                            ) : (
                              <button 
                                onClick={() => handleDistribute(seller.id)}
                                disabled={isProcessing}
                                className="px-5 py-2 bg-white/5 text-white/80 text-xs font-bold rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 flex items-center gap-2 border border-white/5"
                              >
                                {isProcessing ? (
                                  <RefreshCw size={14} className="animate-spin text-white/60" />
                                ) : (
                                  <Play size={14} className="text-white/60" fill="currentColor" />
                                )}
                                <span>Chia riêng</span>
                              </button>
                            )}
                          </div>

                          {!isDistributed ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Loại Bộ</label>
                                  <select 
                                    value={seller.setType}
                                    onChange={(e) => updateSeller(seller.id, { setType: e.target.value as 'single' | 'double' })}
                                    className="w-full bg-[#13131A] border border-white/5 rounded-xl text-xs font-bold text-white/80 py-2 px-3 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="single">Bộ Đơn (10 số)</option>
                                    <option value="double">Bộ Đôi (20 số)</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Bộ Số</label>
                                  <select 
                                    value={seller.manualSetId || ''}
                                    onChange={(e) => updateSeller(seller.id, { manualSetId: e.target.value || undefined, isAutoMode: !e.target.value })}
                                    className="w-full bg-[#13131A] border border-white/5 rounded-xl text-xs font-bold text-white/80 py-2 px-3 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="">Tự động xoay vòng</option>
                                    {lotterySets.map(set => (
                                      <option key={set.id} value={set.id}>Bộ {set.id}</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Số Tờ/Số</label>
                                  <select 
                                    value={seller.sheetsOption}
                                    onChange={(e) => {
                                      const option = e.target.value as '16' | '32' | 'custom';
                                      const sheets = option === '16' ? 16 : option === '32' ? 32 : (seller.customSheets || 10);
                                      updateSeller(seller.id, { 
                                        sheetsOption: option,
                                        targetTotalTickets: sheets * (seller.setType === 'single' ? 10 : 20)
                                      });
                                    }}
                                    className="w-full bg-[#13131A] border border-white/5 rounded-xl text-xs font-bold text-white/80 py-2 px-3 focus:border-indigo-500 outline-none"
                                  >
                                    <option value="16">16 tờ/số</option>
                                    <option value="32">32 tờ/số</option>
                                    <option value="custom">Tùy chỉnh</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Phân bổ đài</label>
                                  <div className="flex bg-[#13131A] border border-white/5 p-1 rounded-xl">
                                    <button 
                                      onClick={() => updateSeller(seller.id, { allocationMode: 'auto' })}
                                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${seller.allocationMode === 'auto' ? 'bg-indigo-500 text-white' : 'text-white/40 hover:text-white/80'}`}
                                    >
                                      Tự động
                                    </button>
                                    <button 
                                      onClick={() => updateSeller(seller.id, { allocationMode: 'manual' })}
                                      className={`flex-1 py-1 text-[10px] font-bold rounded-lg transition-all ${seller.allocationMode === 'manual' ? 'bg-indigo-500 text-white' : 'text-white/40 hover:text-white/80'}`}
                                    >
                                      Tùy chỉnh
                                    </button>
                                  </div>
                                </div>
                                {new Date(dailyInput.date).getDay() === 6 ? (
                                  <div className="flex flex-col gap-2">
                                    <div>
                                      <label className="text-[10px] font-bold text-amber-400/60 uppercase mb-1 flex items-center gap-1">
                                        <Star size={10} /> Lương Thứ 7
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          value={seller.saturdayTickets ?? seller.targetTotalTickets}
                                          onChange={(e) => updateSeller(seller.id, { saturdayTickets: parseInt(e.target.value) || 0 })}
                                          className="w-full bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs font-bold text-amber-400 py-2 px-3 focus:border-amber-500 outline-none"
                                        />
                                        <span className="text-xs font-bold text-amber-400/40">tờ</span>
                                      </div>
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-emerald-400/60 uppercase mb-1 flex items-center gap-1">
                                        <Plus size={10} /> Chỉ định tăng
                                      </label>
                                      <div className="flex items-center gap-2">
                                        <input 
                                          type="number" 
                                          value={seller.saturdayBonus || ''}
                                          placeholder="+0"
                                          onChange={(e) => updateSeller(seller.id, { saturdayBonus: parseInt(e.target.value) || 0 })}
                                          className="w-full bg-emerald-500/5 border border-emerald-500/20 rounded-xl text-xs font-bold text-emerald-400 py-2 px-3 focus:border-emerald-500 outline-none placeholder:text-emerald-500/30"
                                        />
                                        <span className="text-xs font-bold text-emerald-400/40">tờ</span>
                                      </div>
                                    </div>
                                    <div className="text-[10px] text-white/40 mt-1">
                                      Tổng cộng: <span className="font-bold text-white">{getTargetTickets(seller)}</span> tờ
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">
                                      {seller.allocationMode === 'manual' ? 'Vé Đài Chính' : 'Tổng Vé Lấy'}
                                    </label>
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="number" 
                                        value={seller.targetTotalTickets}
                                        onChange={(e) => updateSeller(seller.id, { targetTotalTickets: parseInt(e.target.value) || 0 })}
                                        className="w-full bg-[#13131A] border border-white/5 rounded-xl text-xs font-bold text-white/80 py-2 px-3 focus:border-indigo-500 outline-none"
                                        min="0"
                                        step="1"
                                      />
                                      <span className="text-xs font-bold text-white/40">tờ</span>
                                    </div>
                                  </div>
                                )}
                                {seller.allocationMode === 'auto' && seller.mainEnabled && (
                                  <div className="space-y-3">
                                    <div>
                                      <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-bold text-white/40 uppercase block">Tỷ lệ Đài Chính</label>
                                        <span className="text-[10px] font-bold text-indigo-400">{seller.customRatio !== undefined ? seller.customRatio : currentRatio}%</span>
                                      </div>
                                      <input 
                                        type="range" 
                                        min="0" 
                                        max="100" 
                                        step="5"
                                        value={seller.customRatio !== undefined ? seller.customRatio : currentRatio}
                                        onChange={(e) => updateSeller(seller.id, { customRatio: parseInt(e.target.value) })}
                                        className="w-full h-1.5 bg-[#13131A] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                      />
                                    </div>
                                    {(dailyInput?.subStations || []).map(sub => (
                                      <div key={sub.id}>
                                        <div className="flex justify-between items-center mb-1">
                                          <label className="text-[10px] font-bold text-white/40 uppercase block">Tỷ lệ {sub.name}</label>
                                          <span className="text-[10px] font-bold text-indigo-400">{seller.subStationRatios?.[sub.id] || 0}%</span>
                                        </div>
                                        <input 
                                          type="range" 
                                          min="0" 
                                          max="100" 
                                          step="5"
                                          value={seller.subStationRatios?.[sub.id] || 0}
                                          onChange={(e) => {
                                            const newRatios = { ...(seller.subStationRatios || {}) };
                                            newRatios[sub.id] = parseInt(e.target.value);
                                            updateSeller(seller.id, { subStationRatios: newRatios });
                                          }}
                                          className="w-full h-1.5 bg-[#13131A] rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                        />
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-[#13131A] p-4 rounded-xl border border-white/5">
                              <div className="grid grid-cols-2 gap-4 mb-3">
                                <div>
                                  <div className="text-[11px] font-bold text-emerald-400 uppercase mb-0.5">Bộ đã chia</div>
                                  <div className="text-xs font-black text-emerald-400">{result?.setName}</div>
                                </div>
                                <div>
                                  <div className="text-[11px] font-bold text-emerald-400 uppercase mb-0.5">Tổng vé nhận</div>
                                  <div className="text-xs font-black text-emerald-400">{result?.totalSheets} tờ</div>
                                </div>
                              </div>
                              <div className="space-y-2">
                                {result?.mainStationNumbers.length > 0 && (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <div className="w-full text-[11px] font-bold text-white/40 uppercase mb-0.5">Chính:</div>
                                    {result?.mainStationNumbers.map(n => {
                                      const qty = result.mainStationQuantities?.[n];
                                      return (
                                        <div key={n} className="flex flex-col items-center">
                                          <span className="px-1.5 py-0.5 bg-white/5 rounded text-[10px] font-bold text-emerald-400 border border-emerald-500/20">{n}</span>
                                          {qty && qty !== (sellers.find(s => s.id === seller.id)?.sheetsOption === '32' ? 32 : (sellers.find(s => s.id === seller.id)?.sheetsOption === 'custom' ? (sellers.find(s => s.id === seller.id)?.customSheets || 16) : 16)) && (
                                            <span className="text-[10px] font-black text-rose-400 mt-0.5">{qty}t</span>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                {result?.subStationResults.some(r => r.numbers.length > 0) && (
                                  <div className="flex flex-col gap-1">
                                    {result?.subStationResults.map(sr => sr.numbers.length > 0 && (
                                      <div key={sr.id} className="flex flex-wrap gap-1 items-center">
                                        <div className="w-full text-[11px] font-bold text-white/40 uppercase mb-0.5">{sr.name}:</div>
                                        {sr.numbers.map(n => {
                                          const qty = sr.quantities?.[n];
                                          return (
                                            <div key={n} className="flex flex-col items-center">
                                              <span key={n} className="px-1.5 py-0.5 bg-emerald-500/10 rounded text-[10px] font-bold text-emerald-400">{n}</span>
                                              {qty && qty !== (sellers.find(s => s.id === seller.id)?.sheetsOption === '32' ? 32 : (sellers.find(s => s.id === seller.id)?.sheetsOption === 'custom' ? (sellers.find(s => s.id === seller.id)?.customSheets || 16) : 16)) && (
                                                <span className="text-[10px] font-black text-rose-400 mt-0.5">{qty}t</span>
                                              )}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                    {(() => {
                      const filteredSellers = sellers.filter(s => s.isEnabled && s.name.toLowerCase().includes(searchTerm.toLowerCase()));
                      const itemsPerPage = 9;
                      const totalPages = Math.ceil(filteredSellers.length / itemsPerPage) || 1;
                      if (totalPages <= 1) return null;
                      return (
                        <div className="flex items-center justify-between mt-4 bg-[#181824] px-4 py-3 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-white/40">
                            Trang <span className="text-white/80">{distributeLeftPage}</span> / {totalPages}
                          </span>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => setDistributeLeftPage(prev => Math.max(1, prev - 1))}
                              disabled={distributeLeftPage === 1}
                              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button 
                              onClick={() => setDistributeLeftPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={distributeLeftPage === totalPages}
                              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                </div>
              </div>
            </div>

              {/* Right Panel: Sẵn sàng chia vé / Kết quả */}
              <div className="xl:col-span-2 xl:sticky xl:top-8 self-start">
                {results.length > 0 ? (
                  <div className="space-y-6">
                    <div className="bg-[#181824] p-6 rounded-2xl border border-white/5 mb-6">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400">
                            <LayoutDashboard size={24} />
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-white/90">Tổng Hợp Kết Quả</h3>
                            <p className="text-xs text-white/40 font-medium">Thống kê lượng vé đã chia</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setResults([]);
                            const initialSubPools: Record<string, Record<string, number>> = {};
                            dailyInput.subStations.forEach(s => {
                              initialSubPools[s.id] = { ...s.tickets };
                            });
                            setCurrentPools({
                              main: { ...dailyInput.mainStationTickets },
                              subPools: initialSubPools
                            });
                          }}
                          className="px-4 py-2 bg-rose-500/10 text-rose-400 text-xs font-bold rounded-xl hover:bg-rose-500/20 transition-colors"
                        >
                          Xóa kết quả
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-[#13131A] p-4 rounded-xl border border-white/5">
                          <span className="text-[10px] font-bold text-indigo-400 uppercase block mb-1">Đài Chính Đã Chia</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-indigo-400">
                              {results.reduce((acc, r) => acc + (Object.values(r.mainStationQuantities || {}) as number[]).reduce((a, b) => a + b, 0), 0)}
                            </span>
                            <span className="text-xs font-bold text-white/40">/ {totalMain} tờ</span>
                          </div>
                        </div>
                        {(dailyInput?.subStations || []).map(sub => {
                          const subTotalDistributed = results.reduce((acc, r) => {
                            const subRes = r.subStationResults.find(sr => sr.id === sub.id);
                            return acc + (subRes ? (Object.values(subRes.quantities || {}) as number[]).reduce((a, b) => a + b, 0) : 0);
                          }, 0);
                          const subInitialTotal = (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0);
                          return (
                            <div key={sub.id} className="bg-[#13131A] p-4 rounded-xl border border-white/5">
                              <span className="text-[10px] font-bold text-emerald-400 uppercase block mb-1">{sub.name} Đã Chia</span>
                              <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-emerald-400">{subTotalDistributed}</span>
                                <span className="text-xs font-bold text-white/40">/ {subInitialTotal} tờ</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Kho Còn Lại - Remaining Inventory After Distribution */}
                    {results.length > 0 && (
                      <div className="bg-[#181824] p-6 rounded-2xl border border-white/5 mb-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-400">
                              <ClipboardList size={20} />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-white/90">Kho Còn Lại</h3>
                              <p className="text-[10px] text-white/40 font-medium">Số lượng tờ còn lại sau khi chia</p>
                            </div>
                          </div>
                        </div>
                        
                        {/* Main Station Remaining */}
                        <div className="mb-4">
                          <div className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-2">
                            <span>Đài Chính</span>
                            <span className="text-white/30">
                              — Tổng còn: {(Object.values(currentPools.main) as number[]).reduce((a, b) => a + b, 0)} tờ
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).map(num => {
                              const remaining = currentPools.main[num] || 0;
                              const initial = dailyInput.mainStationTickets[num] || 0;
                              if (initial === 0 && remaining === 0) return null;
                              const used = initial - remaining;
                              const pct = initial > 0 ? remaining / initial : 0;
                              const colorClass = remaining === 0 ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' 
                                : pct < 0.3 ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                              return (
                                <div key={num} className={`flex flex-col items-center px-1.5 py-1 rounded-lg border text-[10px] font-bold ${colorClass}`}>
                                  <span className="text-xs font-black">{num}</span>
                                  <span>{remaining}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Sub Stations Remaining */}
                        {(dailyInput?.subStations || []).map(sub => {
                          const subPool = currentPools.subPools[sub.id] || {};
                          const subTotal = (Object.values(subPool) as number[]).reduce((a, b) => a + b, 0);
                          const hasTickets = Object.keys(sub.tickets || {}).length > 0;
                          if (!hasTickets) return null;
                          return (
                            <div key={sub.id} className="mt-3">
                              <div className="text-[10px] font-bold text-emerald-400 uppercase mb-2 flex items-center gap-2">
                                <span>{sub.name}</span>
                                <span className="text-white/30">— Tổng còn: {subTotal} tờ</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).map(num => {
                                  const remaining = subPool[num] || 0;
                                  const initial = sub.tickets[num] || 0;
                                  if (initial === 0 && remaining === 0) return null;
                                  const pct = initial > 0 ? remaining / initial : 0;
                                  const colorClass = remaining === 0 ? 'bg-rose-500/20 border-rose-500/30 text-rose-400' 
                                    : pct < 0.3 ? 'bg-amber-500/15 border-amber-500/25 text-amber-400'
                                    : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
                                  return (
                                    <div key={num} className={`flex flex-col items-center px-1.5 py-1 rounded-lg border text-[10px] font-bold ${colorClass}`}>
                                      <span className="text-xs font-black">{num}</span>
                                      <span>{remaining}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {(() => {
                        const itemsPerPage = 5;
                        const paginatedResults = results.slice((distributeRightPage - 1) * itemsPerPage, distributeRightPage * itemsPerPage);
                        return paginatedResults.map((res, idx) => (
                        <motion.div 
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: idx * 0.1 }}
                          key={res.sellerId}
                          className="bg-[#181824] rounded-2xl p-4 border border-white/5 hover:border-white/10 transition-all"
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h4 className="text-xl font-bold text-white/90">{res.sellerName}</h4>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 text-xs font-bold rounded-md uppercase">Bộ {res.setName}</span>
                                <span className="text-white/40 text-xs font-medium">• {res.totalSheets} tờ tổng cộng</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handlePrint(res)}
                                className="p-2 bg-white/5 text-white/60 rounded-xl hover:bg-white/10 hover:text-white transition-all"
                                title="In phiếu"
                              >
                                <Printer size={18} />
                              </button>
                              <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                <CheckCircle2 size={14} />
                                Hợp lệ
                              </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="bg-[#13131A] p-3 rounded-xl border border-white/5">
                              <div className="flex items-center gap-2 text-xs font-bold text-white/40 uppercase mb-3">
                                <Hash size={14} />
                                Đài Chính
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {res.mainStationNumbers.map(n => {
                                  const qty = res.mainStationQuantities?.[n];
                                    return (
                                      <div key={n} className="flex flex-col items-center justify-center bg-[#1A1A24] border border-white/10 rounded-lg py-1 min-w-[36px] shadow-lg shadow-black/10 gap-0.5">
                                        <span className="font-bold text-[13px] text-white/80 leading-none mt-0.5">
                                          {n}
                                        </span>
                                        {qty && (
                                          <span className="text-[10px] font-black text-emerald-400 leading-none mb-0.5">{qty}</span>
                                        )}
                                      </div>
                                    );
                                })}
                              </div>
                            </div>
                            {res.subStationResults.map(subRes => (
                              <div key={subRes.id} className="bg-indigo-500/5 p-3 rounded-xl border border-indigo-500/10">
                                <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase mb-3">
                                  <Hash size={14} />
                                  {subRes.name}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {subRes.numbers.map(n => {
                                    const qty = subRes.quantities?.[n];
                                    return (
                                      <div key={n} className="flex flex-col items-center justify-center bg-indigo-500/10 border border-indigo-500/20 rounded-lg py-1 min-w-[36px] shadow-lg shadow-black/10 gap-0.5">
                                        <span className="font-bold text-[13px] text-indigo-400 leading-none mt-0.5">
                                          {n}
                                        </span>
                                        {qty && (
                                          <span className="text-[10px] font-black text-emerald-400 leading-none mb-0.5">{qty}</span>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      ));
                    })()}
                    {(() => {
                      const itemsPerPage = 5;
                      const totalPages = Math.ceil(results.length / itemsPerPage) || 1;
                      if (totalPages <= 1) return null;
                      return (
                        <div className="flex items-center justify-between mt-4 bg-[#181824] px-4 py-3 rounded-2xl border border-white/5">
                          <span className="text-[10px] font-bold text-white/40">
                            Trang <span className="text-white/80">{distributeRightPage}</span> / {totalPages}
                          </span>
                          <div className="flex gap-1.5">
                            <button 
                              onClick={() => setDistributeRightPage(prev => Math.max(1, prev - 1))}
                              disabled={distributeRightPage === 1}
                              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                            >
                              <ChevronLeft size={14} />
                            </button>
                            <button 
                              onClick={() => setDistributeRightPage(prev => Math.min(totalPages, prev + 1))}
                              disabled={distributeRightPage === totalPages}
                              className="p-1.5 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-[650px]">
                    <div className="flex-1 bg-[#181824] rounded-2xl border border-white/5 flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
                      {/* Decorative background glow */}
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-indigo-500/20 blur-[100px] rounded-full pointer-events-none" />
                      
                      <div className="w-32 h-32 bg-indigo-500 rounded-full flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(99,102,241,0.3)] relative group">
                        <div className="absolute inset-0 border-[6px] border-indigo-400/30 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
                        <div className="absolute inset-0 border-2 border-indigo-400/50 rounded-full animate-ping" style={{ animationDuration: '2s', animationDelay: '0.5s' }} />
                        <Play size={48} className="text-white ml-3 transition-transform group-hover:scale-110 duration-500" fill="currentColor" />
                      </div>
                      <h3 className="text-[28px] font-black text-white/90 mb-4 relative z-10 tracking-tight">Sẵn sàng chia vé</h3>
                      <p className="text-[13px] text-white/40 max-w-sm leading-relaxed relative z-10 mb-12">
                        Nhấn nút <strong className="text-white/70">"CHIA VÉ NGAY"</strong> để bắt đầu phân phối số cho ngày hôm nay dựa trên cấu hình kho hiện tại.
                      </p>
                      
                      <button 
                        onClick={() => handleDistribute()}
                        disabled={isProcessing}
                        className="w-full py-5 bg-[#5B4DF6] text-white rounded-2xl font-black text-lg hover:bg-[#4F41ED] hover:-translate-y-1 transition-all shadow-[0_8px_30px_rgba(91,77,246,0.3)] flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw size={24} className="animate-spin" />
                            ĐANG CHIA VÉ...
                          </>
                        ) : (
                          <>
                            CHIA VÉ NGAY
                            <Zap size={20} fill="currentColor" />
                          </>
                        )}
                      </button>
                    </div>

                    <div className="mt-4 bg-[#181824] rounded-2xl border border-white/5 p-5 flex items-center gap-4">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-400 shrink-0">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <div className="text-[13px] font-black text-emerald-400 tracking-wider mb-1">HỆ THỐNG ỔN ĐỊNH</div>
                        <div className="text-[11px] font-medium text-white/40">Đã cập nhật: 1 phút trước</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'sellers' && (
            <motion.div 
              key="sellers"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-6 glass-card p-6 rounded-3xl border border-white/5 shadow-lg shadow-black/10">
                <div>
                  <h2 className="text-2xl font-black text-white/90">Danh Sách Người Bán</h2>
                  <p className="text-sm text-white/50">Quản lý thông tin và cấu hình chia vé cho từng người.</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <input 
                      type="text"
                      placeholder="Tìm người bán..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 pr-4 py-2.5 bg-white/3 border border-white/10 rounded-xl text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all w-full sm:w-64"
                    />
                    <Users size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  </div>
                  <button 
                    onClick={() => {
                      setSellers(INITIAL_SELLERS);
                      localStorage.removeItem('lottery_sellers');
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-white/60 rounded-xl font-bold hover:bg-white/10 transition-all whitespace-nowrap"
                    title="Khôi phục danh sách người bán gốc"
                  >
                    <RefreshCw size={18} />
                    <span>Đặt lại</span>
                  </button>
                  <button 
                    onClick={() => {
                      const newId = (sellers.length + 1).toString().padStart(2, '0');
                      setSellers([...sellers, { ...INITIAL_SELLERS[0], id: newId, name: `Người Bán ${newId}` }]);
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20 whitespace-nowrap"
                  >
                    <Plus size={20} />
                    <span>Thêm Mới</span>
                  </button>
                  <button 
                    onClick={() => handlePrintResults(results.length > 0 ? results : getDraftResults())}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg whitespace-nowrap ${results.length > 0 ? 'bg-white text-slate-900 shadow-white/10 hover:bg-white/90' : 'bg-indigo-500 text-white shadow-indigo-500/20 hover:bg-indigo-600'}`}
                  >
                    <Printer size={20} />
                    <span>{results.length > 0 ? 'In Phiếu' : 'In Dự Kiến'}</span>
                  </button>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: TOTAL SELLERS */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-[#181824] shadow-lg shadow-black/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Tổng Người Bán</span>
                    <Users size={16} className="text-white/40" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white/90">{sellers.length}</span>
                    <span className="text-xs font-bold text-emerald-400">+{sellers.filter(s => s.isEnabled).length} hoạt động</span>
                  </div>
                  <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(sellers.filter(s => s.isEnabled).length / Math.max(1, sellers.length)) * 100}%` }} />
                  </div>
                </div>

                {/* Card 2: TICKETS RESERVED */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-[#181824] shadow-lg shadow-black/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Tổng Vé Cần Lấy</span>
                    <Ticket size={16} className="text-indigo-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white/90">
                      {sellers.filter(s => s.isEnabled).reduce((acc, s) => acc + getTargetTickets(s), 0).toLocaleString()}
                    </span>
                    <span className="text-xs font-bold text-indigo-400">tờ</span>
                  </div>
                  {/* Small Bar Chart Decoration */}
                  <div className="mt-4 flex items-end gap-1 h-6 opacity-60">
                    {[40, 60, 45, 80, 50, 90].map((h, i) => (
                      <div key={i} className="flex-1 bg-indigo-500 rounded-t-sm" style={{ height: `${h}%` }} />
                    ))}
                  </div>
                </div>

                {/* Card 3: CHANNEL LOAD */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-[#181824] shadow-lg shadow-black/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Tỉ lệ phân bổ</span>
                    <Gauge size={16} className="text-amber-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white/90">
                      {(() => {
                        const totalTicketsReserved = sellers.filter(s => s.isEnabled).reduce((acc, s) => acc + getTargetTickets(s), 0);
                        const totalMain = Object.values(dailyInput.mainStationTickets).reduce((a, b) => a + b, 0) as number;
                        const totalInventory = totalMain + dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0), 0);
                        return totalInventory > 0 ? ((totalTicketsReserved / totalInventory) * 100).toFixed(1) : '0.0';
                      })()}%
                    </span>
                    <span className="text-xs font-bold text-amber-400">Tải kho</span>
                  </div>
                  <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(() => {
                        const totalTicketsReserved = sellers.filter(s => s.isEnabled).reduce((acc, s) => acc + getTargetTickets(s), 0);
                        const totalMain = Object.values(dailyInput.mainStationTickets).reduce((a, b) => a + b, 0) as number;
                        const totalInventory = totalMain + dailyInput.subStations.reduce((acc, sub) => acc + (Object.values(sub.tickets || {}) as number[]).reduce((a, b) => a + b, 0), 0);
                        return totalInventory > 0 ? Math.min(100, (totalTicketsReserved / totalInventory) * 100) : 0;
                      })()}%` }} />
                  </div>
                </div>

                {/* Card 4: DISTRIBUTED / ACTIVE */}
                <div className="glass-card p-5 rounded-2xl border border-white/5 bg-[#181824] shadow-lg shadow-black/10 flex flex-col justify-between">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[11px] font-bold text-white/40 uppercase tracking-wider">Trạng Thái Chia</span>
                    <ClipboardList size={16} className="text-emerald-400" />
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black text-white/90">{results.length}</span>
                    <span className="text-xs font-bold text-white/40">/ {sellers.filter(s => s.isEnabled).length} người</span>
                  </div>
                  <div className="mt-4 flex gap-4 text-[10px] font-bold text-white/40">
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/> Hoàn tất: {results.length}</div>
                    <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-white/20"/> Chờ xử lý: {sellers.filter(s => s.isEnabled).length - results.length}</div>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-3xl shadow-lg shadow-black/10 border border-white/5 overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-white/3 border-b border-white/5">
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Trạng Thái</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase min-w-[160px]">Người Bán</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Đài</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Loại Bộ</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Số Tờ/Số</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Tổng Vé Cần Lấy</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">
                        <div className="flex items-center gap-1">
                          <Star size={12} className="text-amber-500" />
                          <span>Sở Thích</span>
                        </div>
                      </th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase">Bộ Hiện Tại</th>
                      <th className="px-6 py-4 text-xs font-bold text-white/40 uppercase text-right">Thao Tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {(() => {
                      const filteredSellers = Array.isArray(sellers) ? sellers.filter(s => s && s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) : [];
                      const itemsPerPage = 10;
                      const paginatedSellers = filteredSellers.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                      return paginatedSellers.map((seller) => (
                        <tr key={seller.id} className={`hover:bg-white/5/50 transition-colors ${!seller.isEnabled ? 'opacity-50 grayscale' : ''}`}>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => updateSeller(seller.id, { isEnabled: !seller.isEnabled })}
                          className={`w-10 h-5 rounded-full relative transition-colors ${seller.isEnabled ? 'bg-indigo-500' : 'bg-white/10'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${seller.isEnabled ? 'right-1' : 'left-1'}`} />
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="text" 
                          value={seller.name}
                          onChange={(e) => updateSeller(seller.id, { name: e.target.value })}
                          className="bg-transparent border-none focus:ring-0 font-bold text-white/80 p-0 w-full"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateSeller(seller.id, { mainEnabled: !seller.mainEnabled })}
                              className={`px-2 py-1 rounded text-[10px] font-bold transition-colors w-16 ${seller.mainEnabled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-white/5 text-white/40'}`}
                            >
                              Chính
                            </button>
                            <input 
                              type="number" 
                              value={seller.customRatio || 70}
                              onChange={(e) => updateSeller(seller.id, { customRatio: parseInt(e.target.value) || 0 })}
                              className="w-10 bg-transparent border border-white/10 hover:bg-white/5 focus:border-indigo-500/50 transition-colors rounded text-[10px] font-bold text-white/80 px-1 py-0.5 outline-none text-center"
                              title="% Đài Chính"
                            />
                            <span className="text-[10px] text-white/40">%</span>
                          </div>
                          {(dailyInput?.subStations || []).map(sub => (
                            <div key={sub.id} className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-white/40 w-16 truncate" title={sub.name}>{sub.name}</span>
                              <input 
                                type="number" 
                                value={seller.subStationRatios?.[sub.id] || 0}
                                onChange={(e) => {
                                  const newRatios = { ...(seller.subStationRatios || {}) };
                                  newRatios[sub.id] = parseInt(e.target.value) || 0;
                                  updateSeller(seller.id, { subStationRatios: newRatios });
                                }}
                                className="w-10 bg-transparent border border-white/10 hover:bg-white/5 focus:border-indigo-500/50 transition-colors rounded text-[10px] font-bold text-white/80 px-1 py-0.5 outline-none text-center"
                                title={`% ${sub.name}`}
                              />
                              <span className="text-[10px] text-white/40">%</span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={seller.setType}
                          onChange={(e) => updateSeller(seller.id, { setType: e.target.value as 'single' | 'double' })}
                          className="bg-transparent hover:bg-white/5 border border-white/10 transition-colors rounded-lg text-sm font-semibold text-white/80 px-3 py-1.5 outline-none"
                        >
                          <option value="single">Đơn</option>
                          <option value="double">Đôi</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <select 
                            value={seller.sheetsOption}
                            onChange={(e) => updateSeller(seller.id, { sheetsOption: e.target.value as any })}
                            className="bg-transparent hover:bg-white/5 border border-white/10 transition-colors rounded-lg text-sm font-semibold text-white/80 px-3 py-1.5 outline-none"
                          >
                            <option value="16">Cố định 16</option>
                            <option value="32">Cố định 32</option>
                            <option value="custom">Tuỳ chọn</option>
                          </select>
                          {seller.sheetsOption === 'custom' && (
                            <input 
                              type="number" 
                              value={seller.customSheets || ''}
                              onChange={(e) => updateSeller(seller.id, { customSheets: parseInt(e.target.value) || 0 })}
                              className="w-full bg-white/8 border-none rounded-lg text-xs font-bold text-white/60 px-3 py-1 outline-none"
                              placeholder="Số tờ..."
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <input 
                          type="number" 
                          value={seller.targetTotalTickets}
                          onChange={(e) => updateSeller(seller.id, { targetTotalTickets: parseInt(e.target.value) || 0 })}
                          className="w-20 bg-transparent hover:bg-white/5 border border-white/10 focus:border-indigo-500/50 transition-colors rounded-lg text-sm font-bold text-white/80 px-3 py-1.5 outline-none text-center"
                        />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          {(seller.customPreferences || []).length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {seller.customPreferences?.map((pref, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 text-[10px] font-bold rounded border border-indigo-500/20">
                                  {pref.number}({pref.quantity})
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[10px] text-white/30 italic">Trống</span>
                          )}
                          <button 
                            onClick={() => {
                              setEditingSellerId(seller.id);
                              setIsSellerPrefOpen(true);
                            }}
                            className="text-[10px] font-bold text-indigo-400 hover:underline text-left mt-1"
                          >
                            + Chỉnh sửa
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => updateSeller(seller.id, { isAutoMode: !seller.isAutoMode })}
                              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${seller.isAutoMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'bg-transparent text-white/40 border border-white/10'}`}
                            >
                              {seller.isAutoMode ? 'TỰ ĐỘNG' : 'CỐ ĐỊNH'}
                            </button>
                            <button 
                              onClick={() => {
                                setEditingSellerId(seller.id);
                                setIsSellerPrefOpen(true);
                              }}
                              className="p-1.5 hover:bg-white/5 rounded-lg text-white/40 hover:text-indigo-400 transition-all"
                              title="Sở thích & Ưu tiên"
                            >
                              <Settings size={14} />
                            </button>
                          </div>
                          
                          <select 
                            value={seller.isAutoMode ? seller.currentSetIndex : (seller.manualSetId || '00')}
                            onChange={(e) => {
                              if (seller.isAutoMode) {
                                updateSeller(seller.id, { currentSetIndex: parseInt(e.target.value) });
                              } else {
                                updateSeller(seller.id, { manualSetId: e.target.value });
                              }
                            }}
                            className="bg-transparent hover:bg-white/5 border border-white/10 transition-colors rounded-lg text-sm font-semibold text-white/80 px-3 py-1.5 outline-none"
                          >
                            {seller.setType === 'single' ? (
                              lotterySets.map((set, idx) => (
                                <option key={set.id} value={seller.isAutoMode ? idx : set.id}>
                                  Bộ {set.id}
                                </option>
                              ))
                            ) : (
                              lotterySets.map((set, idx) => {
                                const pairId = getPairId(set.id);
                                return (
                                  <option key={set.id} value={seller.isAutoMode ? idx : set.id}>
                                    Cặp {set.id} - {pairId}
                                  </option>
                                );
                              })
                            )}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handlePrintResults(getDraftResults(seller.id))}
                            className="p-2 text-white/30 hover:text-amber-500 transition-colors"
                            title="In phiếu dự kiến"
                          >
                            <Printer size={18} />
                          </button>
                          <button 
                            onClick={() => removeSeller(seller.id)}
                            className="p-2 text-white/30 hover:text-rose-400 transition-colors"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {(() => {
                const filteredSellers = Array.isArray(sellers) ? sellers.filter(s => s && s.name && s.name.toLowerCase().includes(searchTerm.toLowerCase())) : [];
                const itemsPerPage = 10;
                const totalPages = Math.ceil(filteredSellers.length / itemsPerPage) || 1;
                return totalPages > 1 ? (
                  <div className="flex items-center justify-between mt-4 bg-[#181824] px-6 py-4 rounded-2xl border border-white/5 shadow-lg shadow-black/10">
                    <span className="text-xs font-bold text-white/40">
                      Trang <span className="text-white/80">{currentPage}</span> / {totalPages} (Tổng {filteredSellers.length} người bán)
                    </span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronFirst size={16} />
                      </button>
                      <button 
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button 
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                      <button 
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="p-2 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-all"
                      >
                        <ChevronLast size={16} />
                      </button>
                    </div>
                  </div>
                ) : null;
              })()}
            </motion.div>
          )}

          {activeTab === 'history' && (
            <HistoryTab history={history} handlePrintResults={handlePrintResults} />
          )}
        </AnimatePresence>
      </main>

      {/* Shortage Modal */}
      <ShortageModal
        shortages={shortages}
        setShortages={setShortages}
        addTicketsToInventory={addTicketsToInventory}
        setEditingSellerId={setEditingSellerId}
        setIsSellerPrefOpen={setIsSellerPrefOpen}
      />

      {/* Double Set Manager Modal */}
      <AnimatePresence>
        {isDoubleSetManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/3">
                <div>
                  <h3 className="text-xl font-bold text-white/90">Quản Lý Bộ Đôi</h3>
                  <p className="text-sm text-white/50">Thiết lập các cặp bộ số đi cùng nhau khi chọn loại "Bộ Đôi".</p>
                </div>
                <button 
                  onClick={() => setIsDoubleSetManagerOpen(false)}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={24} className="text-white/40" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {Object.entries(doubleSets).map(([setA, setB], idx) => (
                    <div key={idx} className="flex items-center gap-4 glass-card-light p-4 rounded-2xl border border-white/5">
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Bộ Thứ Nhất</label>
                        <select 
                          value={setA}
                          onChange={(e) => {
                            const newSets = { ...doubleSets };
                            const val = e.target.value;
                            delete newSets[setA];
                            newSets[val] = setB;
                            setDoubleSets(newSets);
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold text-white/80 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          {lotterySets.map(s => <option key={s.id} value={s.id}>Bộ {s.id}</option>)}
                        </select>
                      </div>
                      <div className="flex items-center justify-center pt-5">
                        <ArrowRightLeft size={20} className="text-white/30" />
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] font-bold text-white/40 uppercase mb-1 block">Bộ Thứ Hai</label>
                        <select 
                          value={setB}
                          onChange={(e) => {
                            const newSets = { ...doubleSets };
                            newSets[setA] = e.target.value;
                            setDoubleSets(newSets);
                          }}
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold text-white/80 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          {lotterySets.map(s => <option key={s.id} value={s.id}>Bộ {s.id}</option>)}
                        </select>
                      </div>
                      <button 
                        onClick={() => {
                          const newSets = { ...doubleSets };
                          delete newSets[setA];
                          setDoubleSets(newSets);
                        }}
                        className="p-2 text-white/30 hover:text-rose-400 transition-colors mt-5"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}

                  <button 
                    onClick={() => {
                      const availableSets = lotterySets.map(s => s.id).filter(id => !doubleSets[id] && !Object.values(doubleSets).includes(id));
                      if (availableSets.length >= 2) {
                        setDoubleSets({ ...doubleSets, [availableSets[0]]: availableSets[1] });
                      } else {
                        alert("Không còn đủ bộ số trống để tạo cặp mới.");
                      }
                    }}
                    className="w-full py-4 border-2 border-dashed border-white/10 rounded-2xl text-white/40 font-bold text-sm hover:border-indigo-300 hover:text-indigo-500 transition-all flex items-center justify-center gap-2"
                  >
                    <Plus size={18} />
                    Thêm Cặp Bộ Đôi Mới
                  </button>
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white/3 flex justify-end gap-3">
                <button 
                  onClick={() => setDoubleSets(DOUBLE_SETS)}
                  className="px-6 py-3 text-white/50 font-bold hover:text-white/80 transition-colors"
                >
                  Khôi phục mặc định
                </button>
                <button 
                  onClick={() => setIsDoubleSetManagerOpen(false)}
                  className="px-8 py-3 bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/10 hover:bg-indigo-600 transition-all"
                >
                  Lưu & Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Set Manager Modal */}
      <AnimatePresence>
        {isSetManagerOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/3">
                <div>
                  <h3 className="text-xl font-bold text-white/90">Quản Lý Các Bộ Số</h3>
                  <p className="text-sm text-white/50">Chỉnh sửa hoặc thêm mới các bộ số để hệ thống tự động chia.</p>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      const newId = (lotterySets.length + 1).toString().padStart(2, '0');
                      setLotterySets([...lotterySets, { id: newId, numbers: Array(10).fill('00') }]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all"
                  >
                    <Plus size={16} />
                    Thêm Bộ Mới
                  </button>
                  <button 
                    onClick={() => setIsSetManagerOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} className="text-white/40" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lotterySets.map((set) => (
                    <div key={set.id} className="glass-card-light p-5 rounded-2xl border border-white/10 relative group">
                      <button 
                        onClick={() => {
                          if (confirm(`Xoá bộ số ${set.id}?`)) {
                            setLotterySets(lotterySets.filter(s => s.id !== set.id));
                          }
                        }}
                        className="absolute top-4 right-4 p-2 text-white/30 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white/40 uppercase">Mã Bộ:</span>
                          <input 
                            type="text"
                            value={set.id}
                            onChange={(e) => {
                              const newId = e.target.value;
                              setLotterySets(lotterySets.map(s => s.id === set.id ? { ...s, id: newId } : s));
                            }}
                            className="w-12 bg-white/5 border border-white/10 rounded px-2 py-1 text-sm font-bold text-indigo-400 outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-white/40 uppercase">Số lượng:</span>
                            <input 
                              type="number"
                              min="0"
                              max="100"
                              value={set.numbers.length}
                              onChange={(e) => {
                                const newSize = parseInt(e.target.value) || 0;
                                let newNumbers = [...set.numbers];
                                if (newSize > newNumbers.length) {
                                  newNumbers = [...newNumbers, ...Array(newSize - newNumbers.length).fill('00')];
                                } else {
                                  newNumbers = newNumbers.slice(0, newSize);
                                }
                                setLotterySets(lotterySets.map(s => s.id === set.id ? { ...s, numbers: newNumbers } : s));
                              }}
                              className="w-12 bg-white/5 border border-white/10 rounded px-1 py-0.5 text-[10px] font-bold text-white/60 outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-white/40 uppercase">
                            <Hash size={12} />
                            {set.numbers.length} con số
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        {set.numbers.map((num, idx) => (
                          <div key={idx} className="relative group/num">
                            <input 
                              type="text"
                              value={num}
                              onChange={(e) => updateSetNumber(set.id, idx, e.target.value)}
                              className="w-full text-center py-2 bg-white/5 border border-white/10 rounded-lg font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                              maxLength={2}
                            />
                            <button 
                              onClick={() => {
                                const newNumbers = set.numbers.filter((_, i) => i !== idx);
                                setLotterySets(lotterySets.map(s => s.id === set.id ? { ...s, numbers: newNumbers } : s));
                              }}
                              className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500/100 text-white rounded-full flex items-center justify-center opacity-0 group-hover/num:opacity-100 transition-all shadow-lg shadow-black/10"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-3 flex justify-between items-center">
                        <button 
                          onClick={() => {
                            if (confirm(`Xoá tất cả số trong bộ ${set.id}?`)) {
                              setLotterySets(lotterySets.map(s => s.id === set.id ? { ...s, numbers: [] } : s));
                            }
                          }}
                          className="text-[10px] font-bold text-rose-400 hover:text-rose-400 transition-colors"
                        >
                          Xóa tất cả số
                        </button>
                        <button 
                          onClick={() => {
                            const newNumbers = [...set.numbers, '00'];
                            setLotterySets(lotterySets.map(s => s.id === set.id ? { ...s, numbers: newNumbers } : s));
                          }}
                          className="text-[10px] font-bold text-indigo-400 hover:underline"
                        >
                          + Thêm số vào bộ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-white/5 bg-white/3 flex justify-end gap-3">
                <button 
                  onClick={() => {
                    if (confirm('Bạn có chắc chắn muốn khôi phục bộ số mặc định?')) {
                      setLotterySets(LOTTERY_SETS);
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 text-white/50 font-bold hover:text-white/80 transition-colors"
                >
                  <RefreshCw size={20} />
                  Khôi phục mặc định
                </button>
                <button 
                  onClick={() => setIsSetManagerOpen(false)}
                  className="flex items-center gap-2 px-8 py-3 bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/10 hover:bg-indigo-600 transition-all"
                >
                  <Save size={20} />
                  Lưu & Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Weekly Schedule Modal */}
      <AnimatePresence>
        {isWeeklyScheduleOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-500 text-white">
                <div>
                  <h3 className="text-2xl font-bold">Lịch Trình Hàng Tuần</h3>
                  <p className="text-sm opacity-80 font-medium">Thiết lập lượng vé cố định cho từng ngày trong tuần</p>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const base = weeklySchedules[0].mainStationBaseQuantity;
                      setWeeklySchedules(prev => prev.map(s => ({ ...s, mainStationBaseQuantity: base })));
                    }}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors"
                    title="Áp dụng giá trị của Chủ Nhật cho tất cả các ngày"
                  >
                    Sao chép CN
                  </button>
                  <button 
                    onClick={() => {
                      setWeeklySchedules(prev => prev.map(s => ({ ...s, isActive: true })));
                    }}
                    className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-bold transition-colors"
                  >
                    Bật tất cả
                  </button>
                  <button 
                    onClick={() => setIsWeeklyScheduleOpen(false)}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((dayName, idx) => {
                  const schedule = weeklySchedules.find(s => s.dayOfWeek === idx)!;
                  const config = stationConfigs.find(c => c.dayOfWeek === idx)!;
                  
                  return (
                    <div key={idx} className="glass-card-light p-6 rounded-3xl border border-white/5 space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white/80">{dayName}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-white/40 uppercase">Kích hoạt</span>
                          <button 
                            onClick={() => {
                              const newSchedules = [...weeklySchedules];
                              newSchedules[idx].isActive = !newSchedules[idx].isActive;
                              setWeeklySchedules(newSchedules);
                            }}
                            className={`w-10 h-5 rounded-full relative transition-colors ${schedule.isActive ? 'bg-indigo-500' : 'bg-slate-300'}`}
                          >
                            <div className={`absolute top-1 w-3 h-3 bg-white/5 rounded-full transition-all ${schedule.isActive ? 'right-1' : 'left-1'}`} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase">Tên Đài Chính</label>
                          <input 
                            type="text"
                            value={config.mainStationName}
                            onChange={(e) => {
                              const newConfigs = [...stationConfigs];
                              newConfigs[idx].mainStationName = e.target.value;
                              setStationConfigs(newConfigs);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-white/40 uppercase">Lượng vé Đài Chính</label>
                          <input 
                            type="number" 
                            value={schedule.mainStationBaseQuantity}
                            onChange={(e) => {
                              const newSchedules = [...weeklySchedules];
                              newSchedules[idx].mainStationBaseQuantity = parseInt(e.target.value) || 0;
                              setWeeklySchedules(newSchedules);
                            }}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            disabled={!schedule.isActive}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {config.subStations.map((sub, subIdx) => (
                          <div key={sub.id} className="space-y-2 p-3 glass-card rounded-2xl border border-white/5">
                            <label className="text-[10px] font-bold text-white/40 uppercase">Đài Phụ {subIdx + 1}</label>
                            <div className="flex gap-2">
                              <input 
                                type="text"
                                value={sub.name}
                                onChange={(e) => {
                                  const newConfigs = [...stationConfigs];
                                  newConfigs[idx].subStations[subIdx].name = e.target.value;
                                  setStationConfigs(newConfigs);
                                }}
                                className="flex-1 bg-white/3 border border-white/10 rounded-lg px-3 py-1.5 text-xs font-bold text-white/60 outline-none"
                                placeholder="Tên đài"
                              />
                              <input 
                                type="number"
                                value={schedule.subStationBaseQuantities[sub.id] || 0}
                                onChange={(e) => {
                                  const newSchedules = [...weeklySchedules];
                                  newSchedules[idx].subStationBaseQuantities[sub.id] = parseInt(e.target.value) || 0;
                                  setWeeklySchedules(newSchedules);
                                }}
                                className="w-16 bg-white/3 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-bold text-white/60 outline-none text-center"
                                placeholder="Vé"
                                disabled={!schedule.isActive}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
                
                <div className="p-4 bg-amber-500/10 rounded-2xl border border-amber-500/20 flex gap-3">
                  <AlertCircle className="text-amber-400 shrink-0" size={20} />
                  <p className="text-xs text-amber-400 leading-relaxed">
                    Khi kích hoạt, hệ thống sẽ tự động gợi ý áp dụng lượng vé này cho đài chính khi bạn chọn ngày tương ứng. 
                    Bạn có thể nhấn nút <strong>"Áp dụng lịch trình"</strong> ở màn hình chính để điền nhanh.
                  </p>
                </div>
              </div>

              <div className="p-8 border-t border-white/5 bg-white/3 flex justify-end">
                <button 
                  onClick={() => setIsWeeklyScheduleOpen(false)}
                  className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-white/90 transition-all shadow-lg shadow-white/10"
                >
                  Đóng
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {isSellerPrefOpen && editingSellerId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white/5 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
            >
              {(() => {
                const seller = sellers.find(s => s.id === editingSellerId);
                if (!seller) return null;
                return (
                  <>
                    <div className="p-8 border-b border-white/5 flex justify-between items-center bg-indigo-500 text-white">
                      <div>
                        <h3 className="text-2xl font-bold">Sở Thích Người Bán</h3>
                        <p className="text-sm opacity-80 font-medium">{seller.name}</p>
                      </div>
                      <button 
                        onClick={() => setIsSellerPrefOpen(false)}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                      >
                        <X size={24} />
                      </button>
                    </div>

                    <div className="p-8 space-y-8 overflow-y-auto max-h-[70vh]">
                      {/* Fixed Set Preference */}
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <Target size={18} className="text-indigo-400" />
                          <h4 className="font-bold text-white/90">Bộ Số Cố Định</h4>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <button 
                            onClick={() => updateSeller(seller.id, { fixedSetId: undefined })}
                            className={`p-3 rounded-2xl border-2 text-xs font-bold transition-all ${!seller.fixedSetId ? 'border-indigo-600 bg-indigo-500/10 text-indigo-400' : 'border-white/5 bg-white/3 text-white/40'}`}
                          >
                            Không cố định
                          </button>
                          {lotterySets.map(set => (
                            <button 
                              key={set.id}
                              onClick={() => updateSeller(seller.id, { fixedSetId: set.id })}
                              className={`p-3 rounded-2xl border-2 text-xs font-bold transition-all ${seller.fixedSetId === set.id ? 'border-indigo-600 bg-indigo-500/10 text-indigo-400' : 'border-white/5 bg-white/3 text-white/40'}`}
                            >
                              Bộ {set.id}
                            </button>
                          ))}
                        </div>
                      </section>

                      {/* Extra Sheets Option */}
                      <section>
                        <div className="flex items-center gap-2 mb-4">
                          <Layers size={18} className="text-indigo-400" />
                          <h4 className="font-bold text-white/90">Cấu hình Số Tờ cho Vé Lẻ (Góc)</h4>
                        </div>
                        <p className="text-xs text-white/40 mb-3">
                          Nếu khách hàng lấy Bộ (Case) 16 tờ nhưng các số lẻ (Góc) chia thêm lại là 32 tờ (hoặc ngược lại), bạn có thể cấu hình ở đây.
                        </p>
                        <div className="flex gap-4 items-end">
                          <div className="flex-1">
                            <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Số tờ / Số lẻ (Góc)</label>
                            <select 
                              value={seller.extraSheetsOption || ''}
                              onChange={(e) => updateSeller(seller.id, { extraSheetsOption: e.target.value as any || undefined })}
                              className="w-full bg-[#13131A] border border-white/5 rounded-xl text-sm font-bold text-white/80 py-3 px-4 focus:border-indigo-500 outline-none"
                            >
                              <option value="">Giống với Bộ (Mặc định)</option>
                              <option value="16">16 tờ / số</option>
                              <option value="32">32 tờ / số</option>
                              <option value="custom">Tùy chỉnh</option>
                            </select>
                          </div>
                          {seller.extraSheetsOption === 'custom' && (
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-white/40 uppercase mb-2 block">Nhập số tờ</label>
                              <input 
                                type="number" 
                                value={seller.extraCustomSheets || ''}
                                onChange={(e) => updateSeller(seller.id, { extraCustomSheets: parseInt(e.target.value) || 0 })}
                                className="w-full bg-[#13131A] border border-white/5 rounded-xl text-sm font-bold text-white/80 py-3 px-4 focus:border-indigo-500 outline-none"
                                placeholder="VD: 24"
                              />
                            </div>
                          )}
                        </div>
                      </section>

                      {/* Custom Number Preferences */}
                      <section>
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <Hash size={18} className="text-indigo-400" />
                            <h4 className="font-bold text-white/90">Số Lượng Riêng Biệt</h4>
                          </div>
                          <button 
                            onClick={() => {
                              const prefs = seller.customPreferences || [];
                              updateSeller(seller.id, { customPreferences: [...prefs, { number: '00', quantity: 16 }] });
                            }}
                            className="text-xs font-bold text-indigo-400 hover:underline"
                          >
                            + Thêm số ưu tiên
                          </button>
                        </div>

                        {/* Quick Select Grid */}
                        <div className="mb-6">
                          <button 
                            onClick={() => setIsQuickSelectOpen(!isQuickSelectOpen)}
                            className="text-[10px] font-bold text-white/40 hover:text-indigo-400 flex items-center gap-1 mb-3"
                          >
                            <ChevronDown size={12} className={`transition-transform ${isQuickSelectOpen ? 'rotate-180' : ''}`} />
                            <span>Chọn nhanh từ bảng 100 số (Mặc định 16 tờ)</span>
                          </button>
                          {isQuickSelectOpen && (
                            <div className="grid grid-cols-10 gap-1 p-3 bg-white/3 rounded-2xl border border-white/5">
                              {Array.from({ length: 100 }, (_, i) => i.toString().padStart(2, '0')).map(num => {
                                const isSelected = (seller.customPreferences || []).some(p => p.number === num);
                                return (
                                  <button 
                                    key={num}
                                    onClick={() => {
                                      const prefs = [...(seller.customPreferences || [])];
                                      if (isSelected) {
                                        updateSeller(seller.id, { customPreferences: prefs.filter(p => p.number !== num) });
                                      } else {
                                        updateSeller(seller.id, { customPreferences: [...prefs, { number: num, quantity: 16 }] });
                                      }
                                    }}
                                    className={`aspect-square flex items-center justify-center text-[9px] font-bold rounded-lg border transition-all ${isSelected ? 'bg-indigo-500 border-indigo-600 text-white shadow-lg shadow-black/10' : 'bg-white/5 border-white/10 text-white/40 hover:border-indigo-300'}`}
                                  >
                                    {num}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        <div className="space-y-3">
                          {(seller.customPreferences || []).length > 0 ? (
                            (seller.customPreferences || []).map((pref, idx) => (
                              <div key={idx} className="flex flex-col gap-4 glass-card-light p-4 rounded-2xl border border-white/5">
                                <div className="flex items-center gap-4">
                                  <div className="flex-1">
                                    <label className="text-[11px] font-bold text-white/40 uppercase mb-1 block">Con số</label>
                                    <input 
                                      type="text" 
                                      value={pref.number}
                                      onChange={(e) => {
                                        const newPrefs = [...(seller.customPreferences || [])];
                                        newPrefs[idx].number = e.target.value.padStart(2, '0').slice(-2);
                                        updateSeller(seller.id, { customPreferences: newPrefs });
                                      }}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                      maxLength={2}
                                    />
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[11px] font-bold text-white/40 uppercase mb-1 block">Số lượng vé</label>
                                    <div className="flex items-center gap-2">
                                      <input 
                                        type="number"
                                        value={pref.quantity || ''}
                                        onChange={(e) => {
                                          const newPrefs = [...(seller.customPreferences || [])];
                                          newPrefs[idx].quantity = parseInt(e.target.value) || 0;
                                          updateSeller(seller.id, { customPreferences: newPrefs });
                                        }}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        placeholder="0"
                                      />
                                      <span className="text-[11px] font-bold text-white/40">tờ</span>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => {
                                      const newPrefs = (seller.customPreferences || []).filter((_, i) => i !== idx);
                                      updateSeller(seller.id, { customPreferences: newPrefs });
                                    }}
                                    className="mt-4 p-2 text-white/30 hover:text-rose-400 transition-colors"
                                  >
                                    <Trash2 size={18} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="flex-1">
                                    <label className="text-[11px] font-bold text-white/40 uppercase mb-1 block">Đài lấy vé</label>
                                    <select 
                                      value={pref.stationId || ''}
                                      onChange={(e) => {
                                        const newPrefs = [...(seller.customPreferences || [])];
                                        newPrefs[idx].stationId = e.target.value || undefined;
                                        updateSeller(seller.id, { customPreferences: newPrefs });
                                      }}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    >
                                      <option value="">Tự động (Chính {'>'} Phụ)</option>
                                      <option value="main">Đài Chính</option>
                                      {(dailyInput?.subStations || []).map(sub => (
                                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex-1">
                                    <label className="text-[11px] font-bold text-white/40 uppercase mb-1 block">Ngày áp dụng</label>
                                    <select 
                                      value={pref.dayOfWeek === undefined ? '' : pref.dayOfWeek}
                                      onChange={(e) => {
                                        const newPrefs = [...(seller.customPreferences || [])];
                                        newPrefs[idx].dayOfWeek = e.target.value === '' ? undefined : parseInt(e.target.value);
                                        updateSeller(seller.id, { customPreferences: newPrefs });
                                      }}
                                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-bold text-white/80 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    >
                                      <option value="">Tất cả các ngày</option>
                                      <option value="1">Thứ Hai</option>
                                      <option value="2">Thứ Ba</option>
                                      <option value="3">Thứ Tư</option>
                                      <option value="4">Thứ Năm</option>
                                      <option value="5">Thứ Sáu</option>
                                      <option value="6">Thứ Bảy</option>
                                      <option value="0">Chủ Nhật</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-center py-8 bg-white/3 rounded-2xl border border-dashed border-white/10 text-white/40 text-xs font-medium">
                              Chưa có số ưu tiên nào.
                            </div>
                          )}
                        </div>
                      </section>
                    </div>

                    <div className="p-8 border-t border-white/5 bg-white/3 flex justify-end">
                      <button 
                        onClick={() => setIsSellerPrefOpen(false)}
                        className="px-10 py-4 bg-white text-slate-900 rounded-2xl font-bold hover:bg-white/90 transition-all shadow-lg shadow-white/10"
                      >
                        Hoàn Tất
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <QrModal isOpen={isQrModalOpen} onClose={() => setIsQrModalOpen(false)} />
    </div>
  );
}
