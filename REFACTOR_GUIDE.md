# 🔧 REFACTOR GUIDE — Dự án CHIA VÉ SỐ TỰ ĐỘNG 4.0

> **Repo:** https://github.com/vandaiphat012017-dotcom/veso  
> **Stack:** React 19 · TypeScript · Vite · Tailwind CSS v4 · Gemini AI (`@google/genai`)  
> **Mục tiêu refactor:** Tăng khả năng bảo trì, tách biệt mối quan tâm (SoC), cải thiện type-safety và hiệu năng.

---

## 📁 1. Cấu trúc thư mục đề xuất

```
src/
├── assets/                  # Hình ảnh, icon tĩnh
├── components/
│   ├── ui/                  # Các component dùng chung (Button, Input, Badge…)
│   ├── layout/              # Header, Footer, PageWrapper
│   └── features/
│       ├── ticket/          # Các component liên quan vé số
│       └── qrcode/          # QR code display component
├── hooks/                   # Custom React hooks
│   ├── useTicketSplit.ts
│   ├── useGeminiAI.ts
│   └── useLocalStorage.ts
├── services/
│   ├── gemini.service.ts    # Tất cả calls tới @google/genai
│   └── ticket.service.ts    # Logic xử lý chia vé
├── types/
│   └── index.ts             # Tập trung tất cả interface & type
├── utils/
│   ├── formatters.ts        # Hàm format số, tiền tệ, ngày
│   └── validators.ts        # Validate input vé số
├── constants/
│   └── index.ts             # Magic numbers, config cố định
├── pages/                   # Nếu có nhiều trang (React Router)
│   └── HomePage.tsx
└── App.tsx                  # Chỉ giữ routing & layout gốc
```

---

## 🧩 2. Tách Component

### Vấn đề thường gặp trong project AI Studio template
File `App.tsx` thường chứa toàn bộ UI, state, và gọi API — cần tách ra.

### Cách tách

```tsx
// ❌ Trước: App.tsx làm tất cả
export default function App() {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(false)
  // ... 300 dòng logic + JSX
}

// ✅ Sau: App.tsx chỉ là orchestrator
import { TicketSplitter } from './components/features/ticket/TicketSplitter'
import { ResultDisplay } from './components/features/ticket/ResultDisplay'

export default function App() {
  return (
    <PageWrapper>
      <TicketSplitter />
    </PageWrapper>
  )
}
```

### Danh sách component cần tạo

| Component | Trách nhiệm |
|---|---|
| `TicketInputForm` | Form nhập thông tin vé, số lượng người |
| `TicketResultCard` | Hiển thị kết quả 1 người nhận vé |
| `SplitSummary` | Tổng hợp kết quả chia |
| `QRCodeDisplay` | Render QR từ `qrcode.react` |
| `LoadingOverlay` | Trạng thái loading khi gọi Gemini |
| `ErrorBoundary` | Bắt lỗi toàn app |

---

## 🪝 3. Custom Hooks

### `useGeminiAI.ts`
```typescript
// Tách toàn bộ logic gọi Gemini ra hook riêng
import { GoogleGenAI } from '@google/genai'

interface UseGeminiAIReturn {
  generate: (prompt: string) => Promise<string>
  loading: boolean
  error: string | null
}

export function useGeminiAI(): UseGeminiAIReturn {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ai = useMemo(
    () => new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY }),
    []
  )

  const generate = useCallback(async (prompt: string): Promise<string> => {
    setLoading(true)
    setError(null)
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
      })
      return response.text ?? ''
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError(message)
      return ''
    } finally {
      setLoading(false)
    }
  }, [ai])

  return { generate, loading, error }
}
```

### `useTicketSplit.ts`
```typescript
interface TicketSplitConfig {
  totalTickets: number
  participants: string[]
  ticketNumbers: string[]
}

interface SplitResult {
  participant: string
  tickets: string[]
  shareAmount: number
}

export function useTicketSplit() {
  const split = useCallback((config: TicketSplitConfig): SplitResult[] => {
    return splitTickets(config) // gọi pure function từ ticket.service.ts
  }, [])

  return { split }
}
```

---

## 🔌 4. Service Layer (tách logic khỏi component)

### `services/gemini.service.ts`
```typescript
import { GoogleGenAI } from '@google/genai'

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY })

export async function analyzeTickets(ticketData: string): Promise<string> {
  const prompt = buildTicketPrompt(ticketData)
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  })
  return response.text ?? ''
}

function buildTicketPrompt(data: string): string {
  return `Phân tích và chia vé số sau đây một cách công bằng:\n${data}`
}
```

### `services/ticket.service.ts`
```typescript
import type { Ticket, Participant, SplitResult } from '../types'

// Pure functions — dễ test, không phụ thuộc React
export function splitTickets(
  tickets: Ticket[],
  participants: Participant[]
): SplitResult[] {
  // logic chia vé
}

export function calculateShareAmount(
  totalAmount: number,
  count: number
): number {
  return Math.floor(totalAmount / count)
}

export function validateTicketNumber(ticketNumber: string): boolean {
  return /^\d{6}$/.test(ticketNumber)
}
```

---

## 📐 5. Type Safety

### `types/index.ts` — Tập trung tất cả type
```typescript
// Định nghĩa rõ ràng thay vì dùng `any`

export interface Ticket {
  id: string
  number: string        // VD: "123456"
  series: string        // VD: "ĐB"
  province: string
  price: number
  purchaseDate: string  // ISO string
}

export interface Participant {
  id: string
  name: string
  shareCount: number    // Số phần muốn mua
}

export interface SplitResult {
  participant: Participant
  tickets: Ticket[]
  totalInvestment: number
  shareRatio: number    // 0–1
}

export interface GeminiResponse {
  analysis: string
  suggestions: string[]
  isValid: boolean
}

// Union types cho trạng thái
export type AppStatus = 'idle' | 'loading' | 'success' | 'error'
```

---

## ⚡ 6. Performance

### Tránh re-render không cần thiết
```tsx
// ❌ Trước
function TicketList({ tickets }: { tickets: Ticket[] }) {
  return <div>{tickets.map(t => <TicketCard ticket={t} />)}</div>
}

// ✅ Sau — memo + stable key
const TicketCard = memo(function TicketCard({ ticket }: { ticket: Ticket }) {
  return <div key={ticket.id}>...</div>
})
```

### Lazy load component nặng
```tsx
const QRCodeDisplay = lazy(() => import('./components/features/qrcode/QRCodeDisplay'))

// Trong JSX:
<Suspense fallback={<Spinner />}>
  <QRCodeDisplay data={shareData} />
</Suspense>
```

### Debounce input người dùng
```typescript
// hooks/useDebounce.ts
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
```

---

## 🔐 7. Bảo mật & Cấu hình

### Không để lộ API key
```bash
# .env.local (KHÔNG commit lên git)
VITE_GEMINI_API_KEY=your_key_here
```

```typescript
// constants/index.ts — validate env khi khởi động
export const CONFIG = {
  geminiApiKey: import.meta.env.VITE_GEMINI_API_KEY,
  geminiModel: 'gemini-2.0-flash',
  maxTicketsPerSplit: 100,
  defaultProvince: 'Miền Nam',
} as const

// Kiểm tra khi app start
if (!CONFIG.geminiApiKey) {
  throw new Error('VITE_GEMINI_API_KEY chưa được cấu hình trong .env.local')
}
```

### Rate limiting phía client
```typescript
// hooks/useRateLimit.ts
export function useRateLimit(maxCalls: number, windowMs: number) {
  const callsRef = useRef<number[]>([])

  return useCallback(() => {
    const now = Date.now()
    callsRef.current = callsRef.current.filter(t => now - t < windowMs)
    if (callsRef.current.length >= maxCalls) {
      throw new Error(`Vui lòng chờ trước khi thử lại`)
    }
    callsRef.current.push(now)
  }, [maxCalls, windowMs])
}
```

---

## ✅ 8. Checklist Refactor

### Giai đoạn 1 — Tái cấu trúc (không thay đổi behavior)
- [ ] Tạo cấu trúc thư mục mới theo mục 1
- [ ] Di chuyển tất cả TypeScript interface vào `types/index.ts`
- [ ] Tách gọi Gemini ra `services/gemini.service.ts`
- [ ] Tách logic chia vé ra `services/ticket.service.ts`
- [ ] Tạo `useGeminiAI` hook
- [ ] Tách `App.tsx` thành các component nhỏ

### Giai đoạn 2 — Cải thiện chất lượng
- [ ] Thêm `ErrorBoundary` bọc toàn app
- [ ] Thêm `React.memo` cho component render nhiều lần
- [ ] Lazy load `QRCodeDisplay` và `motion` animations
- [ ] Thêm `useDebounce` cho input vé số
- [ ] Xóa tất cả `any` type, thay bằng type cụ thể

### Giai đoạn 3 — Testing & Polish
- [ ] Viết unit test cho các pure function trong `ticket.service.ts`
- [ ] Kiểm tra PWA manifest và service worker (đã có `vite-plugin-pwa`)
- [ ] Tối ưu bundle size (`vite build --analyze`)
- [ ] Kiểm tra accessibility (aria-label, keyboard navigation)

---

## 🧪 9. Ví dụ Test (Vitest)

```typescript
// src/services/ticket.service.test.ts
import { describe, it, expect } from 'vitest'
import { validateTicketNumber, calculateShareAmount, splitTickets } from './ticket.service'

describe('validateTicketNumber', () => {
  it('chấp nhận số vé 6 chữ số', () => {
    expect(validateTicketNumber('123456')).toBe(true)
  })
  it('từ chối số vé không đủ 6 chữ số', () => {
    expect(validateTicketNumber('12345')).toBe(false)
  })
})

describe('calculateShareAmount', () => {
  it('chia đều số tiền', () => {
    expect(calculateShareAmount(100_000, 4)).toBe(25_000)
  })
  it('làm tròn xuống khi không chia đều', () => {
    expect(calculateShareAmount(100_000, 3)).toBe(33_333)
  })
})
```

---

## 📦 10. Dependencies cần xem xét

| Package | Hiện tại | Đề xuất |
|---|---|---|
| `motion` | `^12.23.24` | Giữ, nhưng lazy import |
| `express` | `^4.21.2` | Xóa nếu không dùng SSR/API routes |
| `dotenv` | `^17.2.3` | Vite tự xử lý env — có thể xóa |
| `@google/genai` | `^1.29.0` | Giữ, wrap trong service layer |

---

> 💡 **Gợi ý:** Bắt đầu từ Giai đoạn 1 — chỉ tái cấu trúc mà không thay đổi logic. Điều này giúp giảm risk và dễ review hơn. Sau khi cấu trúc ổn định, mới refactor logic bên trong từng service/hook.
