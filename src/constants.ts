import { LotterySet, Seller } from './types';

export const LOTTERY_SETS: LotterySet[] = [
  { id: '00', numbers: ['00', '12', '24', '36', '48', '51', '63', '75', '87', '99'] },
  { id: '01', numbers: ['01', '13', '25', '37', '49', '52', '64', '76', '88', '90'] },
  { id: '02', numbers: ['02', '14', '26', '38', '40', '53', '65', '77', '89', '91'] },
  { id: '03', numbers: ['03', '15', '27', '39', '41', '54', '66', '78', '80', '92'] },
  { id: '04', numbers: ['04', '16', '28', '30', '42', '55', '67', '79', '81', '93'] },
  { id: '05', numbers: ['05', '17', '29', '31', '43', '56', '68', '70', '82', '94'] },
  { id: '06', numbers: ['06', '18', '20', '32', '44', '57', '69', '71', '83', '95'] },
  { id: '07', numbers: ['07', '19', '21', '33', '45', '58', '60', '72', '84', '96'] },
  { id: '08', numbers: ['08', '10', '22', '34', '46', '59', '61', '73', '85', '97'] },
  { id: '09', numbers: ['09', '11', '23', '35', '47', '50', '62', '74', '86', '98'] },
];

export const DOUBLE_SETS: Record<string, string> = {
  '00': '06',
  '01': '07',
  '02': '09',
  '03': '05',
  '04': '08',
};

export const UGLY_NUMBERS = ['00', '04', '05', '20', '40', '45', '50', '60', '80', '85', '90'];
export const EXTREMELY_UGLY_NUMBERS = ['00', '04', '05', '85', '45'];

export const BEAUTIFUL_NUMBERS = [
  '07', '09', '11', '19',
  '28', '29',
  '32', '38', '39',           // 3x: chỉ 3 số đẹp
  '47', '49',
  '51', '52', '59',
  '68', '69',
  '72', '77', '78', '79',     // 7x: chỉ 4 số đẹp
  '87', '89', '91', '99'      // 99 là số đẹp
];
export const EXTREMELY_BEAUTIFUL_NUMBERS = ['39', '79', '38', '78', '51', '52', '32', '72'];

export const FORBIDDEN_GROUPS = [
  ['00', '45', '85', '05', '04'],
  ['32', '72', '38', '78', '39', '79', '51', '52']
];

export const getPairId = (id: string): string | undefined => {
  if (DOUBLE_SETS[id]) return DOUBLE_SETS[id];
  return Object.keys(DOUBLE_SETS).find(key => DOUBLE_SETS[key] === id);
};

// Application configuration constants
export const CONFIG = {
  maxHistoryDays: 30,
  defaultSheetsPerNumber: 16,
  defaultMainRatio: 70,
  processingDelayMs: 0, // BUG FIX: removed artificial 1000ms delay
  maxTicketsPerSplit: 100,
} as const;

// DAY_NAMES for Vietnamese
export const DAY_NAMES_VN = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

// Z-Index layering system (consistent)
export const Z_INDEX = {
  sidebar: 20,
  header: 10,
  modal: 50,
  shortageModal: 60,
  topModal: 70,
} as const;

// Default seller template (typed correctly - BUG FIX: was any[])
const createDefaultSeller = (id: string, name: string, targetTotalTickets: number): Seller => ({
  id,
  name,
  setType: 'single',
  sheetsOption: '16',
  targetTotalTickets,
  allocationMode: 'auto',
  currentSetIndex: 0,
  isAutoMode: true,
  isEnabled: true,
  mainEnabled: true,
  subStationRatios: { 'sub1': 20, 'sub2': 10 },
  customPreferences: [],
  fixedSetId: undefined,
});

export const INITIAL_SELLERS: Seller[] = [
  createDefaultSeller('1', 'CHỊ HƯƠNG', 704),
  createDefaultSeller('2', 'BÍCH', 320),
  createDefaultSeller('3', 'MƯỜI', 160),
  createDefaultSeller('4', 'A TRUNG', 176),
  createDefaultSeller('5', 'A DẤU', 448),
  createDefaultSeller('6', 'DIỄM', 288),
  createDefaultSeller('7', 'CHỊ LOAN', 352),
  createDefaultSeller('8', 'ANH DŨNG', 0),
  createDefaultSeller('9', 'VỢ DŨNG', 0),
  createDefaultSeller('10', 'ÚT HẰNG', 352),
  createDefaultSeller('11', 'CHỊ NHẰM', 480),
  createDefaultSeller('12', 'HỒNG PHÁT', 480),
  createDefaultSeller('13', 'TUYẾN', 304),
  createDefaultSeller('14', 'QUÝ', 512),
  createDefaultSeller('15', 'CHỊ HẠNH', 208),
  createDefaultSeller('16', 'ANH 9', 272),
  createDefaultSeller('17', 'THUÝ Ln', 160),
  createDefaultSeller('18', 'CHỊ DIỆP', 160),
  createDefaultSeller('19', 'ANH 6', 0),
  createDefaultSeller('20', 'QUẢNG', 320),
  createDefaultSeller('21', 'CHỊ VÂN', 288),
  createDefaultSeller('22', 'TÝ', 192),
  createDefaultSeller('23', 'LÀ', 320),
  createDefaultSeller('24', 'A BỘ', 80),
  createDefaultSeller('25', 'ANH TIẾN', 224),
  createDefaultSeller('26', 'THU', 960),
  createDefaultSeller('27', 'C LAN', 160),
  createDefaultSeller('28', 'A PHONG', 320),
  createDefaultSeller('29', 'NGHĨA', 352),
  createDefaultSeller('30', 'SỮA XE', 288),
  createDefaultSeller('31', 'THƠM', 272),
  createDefaultSeller('32', 'ANH QUANG', 208),
  createDefaultSeller('33', 'PHONG', 96),
  createDefaultSeller('34', 'GIÀU', 112),
  createDefaultSeller('35', 'THU_2', 640),
  createDefaultSeller('36', 'A KHANH', 288),
  createDefaultSeller('37', 'THỌ', 560),
  createDefaultSeller('38', 'THẢO', 208),
  createDefaultSeller('39', 'THUỶ', 352),
  createDefaultSeller('40', 'TÙNG', 192),
  createDefaultSeller('41', 'A XÊ', 608),
  createDefaultSeller('42', 'HỒNG LN', 320),
  createDefaultSeller('43', 'NHI', 64),
  createDefaultSeller('44', 'A THẮNG', 400),
  createDefaultSeller('45', 'CHÂU', 400),
  createDefaultSeller('46', 'SÂN NHÀ', 240),
  createDefaultSeller('47', 'THẮNG', 800),
  createDefaultSeller('48', 'A LỢI', 320),
  createDefaultSeller('49', 'A THÀNH', 288),
  createDefaultSeller('50', 'C THANH', 320),
  createDefaultSeller('51', 'HẰNG', 352),
  createDefaultSeller('52', 'A TÂM', 640),
  createDefaultSeller('53', 'C PHƯỢNG', 352),
  createDefaultSeller('54', 'C HẢO', 640),
  createDefaultSeller('55', 'C LÂU', 256),
  createDefaultSeller('56', 'KIM', 400),
  createDefaultSeller('57', 'A CƯỜNG', 352),
  createDefaultSeller('58', 'NHU', 256),
  createDefaultSeller('59', 'KIẾM', 720),
  createDefaultSeller('60', 'C THUỶ', 480),
  createDefaultSeller('61', 'C HIỀN', 640),
  createDefaultSeller('62', 'QUỲNH', 352),
  createDefaultSeller('63', 'C TÀI', 160),
  createDefaultSeller('64', 'A BACH', 464),
  createDefaultSeller('65', 'LINH', 208),
  createDefaultSeller('66', 'NGÂN', 256),
  createDefaultSeller('67', 'A MINH', 0),
  createDefaultSeller('68', 'TUYỀN', 256),
  createDefaultSeller('69', 'DÌ 8', 288),
  createDefaultSeller('70', 'A TUẤT', 320),
  createDefaultSeller('71', 'CHÚ 2', 208),
  createDefaultSeller('72', 'DAN', 480),
  createDefaultSeller('73', 'A KỶ', 160),
  createDefaultSeller('74', 'THẮNG TÓC', 160),
  createDefaultSeller('75', 'BÀ 2', 224),
  createDefaultSeller('76', 'A VUI', 256),
  createDefaultSeller('77', 'THUỶ AD', 400),
  createDefaultSeller('78', 'A DŨNG', 640),
  createDefaultSeller('79', 'TUẤN', 304),
  createDefaultSeller('80', 'C THUẬN', 320),
  createDefaultSeller('81', 'A HOAN', 320),
  createDefaultSeller('82', 'CHÚ MINH', 288),
  createDefaultSeller('83', 'CHỊ ÚT', 192),
  createDefaultSeller('84', 'ANHAD', 0),
  createDefaultSeller('85', 'DUNGMUN', 160),
  createDefaultSeller('86', 'TÌM', 160),
  createDefaultSeller('87', 'A THANH', 160),
  createDefaultSeller('88', 'HẰNG_2', 160),
  createDefaultSeller('89', 'TUYẾT', 416),
  createDefaultSeller('90', 'A TỐT', 160),
  createDefaultSeller('91', 'BỔNG', 160),
  createDefaultSeller('92', 'THUẬN 2', 160),
  createDefaultSeller('93', 'A BỬU', 176),
  createDefaultSeller('94', 'MỚI 5', 96),
  createDefaultSeller('95', 'ỨNG', 640),
  createDefaultSeller('96', 'PHƯỢNG', 160),
  createDefaultSeller('97', 'BÍCH RK', 640),
  createDefaultSeller('98', 'LỢP', 0),
  createDefaultSeller('99', 'TÌNH', 0),
  createDefaultSeller('100', 'VÂN', 0),
  createDefaultSeller('101', 'HẠNH', 0),
  createDefaultSeller('102', 'THỤ', 0),
  createDefaultSeller('103', 'BÉ PHƯƠNG', 0),
  createDefaultSeller('104', 'TÚ', 0),
  createDefaultSeller('105', 'AN', 0),
  createDefaultSeller('106', 'THÔNG', 0),
  createDefaultSeller('107', 'THUỶ_2', 0),
  createDefaultSeller('108', 'MẸ TRANG', 0),
  createDefaultSeller('109', 'TRAI', 0),
  createDefaultSeller('110', 'MỌI', 0),
  createDefaultSeller('111', 'DƯƠNG', 0),
  createDefaultSeller('112', 'THẢO_2', 0),
  createDefaultSeller('113', 'CHỊ 10', 0),
  createDefaultSeller('114', 'LỢI', 0),
];
