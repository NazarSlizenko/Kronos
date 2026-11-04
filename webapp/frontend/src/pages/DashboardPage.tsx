import { useQuery } from '@tanstack/react-query';
import { getTickerList } from '../services/api';

const summaryCards = [
  { label: 'Сигнал', value: 'Покупка', accent: 'text-emerald-400' },
  { label: 'Цена', value: '$59,880', accent: 'text-sky-400' },
  { label: 'Доверие', value: '82%', accent: 'text-violet-400' },
  { label: 'Портфель', value: '7 активов', accent: 'text-amber-400' },
];

export function DashboardPage() {
  const { data: tickers = [] } = useQuery({
    queryKey: ['tickers'],
    queryFn: getTickerList,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm uppercase tracking-[0.25em] text-violet-400">dashboard</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Панель управления рынком</h2>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-slate-950/20">
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className={`mt-4 text-2xl font-semibold ${card.accent}`}>{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Избранные тикеры</h3>
            <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-300">Live</span>
          </div>
          <div className="mt-5 grid gap-3">
            {tickers.slice(0, 5).map((ticker: string) => (
              <div key={ticker} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span className="font-medium text-slate-100">{ticker}</span>
                <span className="text-xs text-emerald-400">+2.4%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-xl font-semibold text-white">Краткая сводка</h3>
          <ul className="mt-5 space-y-4 text-sm text-slate-300">
            <li className="flex justify-between border-b border-slate-800 pb-2"><span>BTC-USD</span><span className="text-emerald-400">+1.8%</span></li>
            <li className="flex justify-between border-b border-slate-800 pb-2"><span>ETH-USD</span><span className="text-emerald-400">+1.2%</span></li>
            <li className="flex justify-between border-b border-slate-800 pb-2"><span>NVDA</span><span className="text-sky-400">+0.9%</span></li>
            <li className="flex justify-between"><span>MSFT</span><span className="text-violet-400">+0.6%</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
