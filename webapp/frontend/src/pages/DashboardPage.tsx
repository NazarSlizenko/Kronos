import { useQuery } from '@tanstack/react-query';

import { getFavorites, getPredictions, getTickerList } from '../services/api';

export function DashboardPage() {
  const { data: tickers = [] } = useQuery({
    queryKey: ['tickers'],
    queryFn: getTickerList,
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
  });

  const { data: predictions = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: getPredictions,
  });

  const latestPrediction = predictions[0];
  const summaryCards = [
    { label: 'Сигнал', value: latestPrediction ? (Number(latestPrediction.change_percent) >= 0 ? 'Покупка' : 'Продажа') : 'Ожидание', accent: Number(latestPrediction?.change_percent ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400' },
    { label: 'Цена при прогнозе', value: latestPrediction ? `$${Number(latestPrediction.latest_price).toLocaleString()}` : '—', accent: 'text-sky-400' },
    { label: 'Доверие', value: latestPrediction ? `${Math.round(Number(latestPrediction.confidence) * 100)}%` : '0%', accent: 'text-violet-400' },
    { label: 'Портфель', value: `${favorites.length || 0} активов`, accent: 'text-amber-400' },
  ];

  const favoriteRows = favorites.length ? favorites : tickers.slice(0, 4).map((ticker: string) => ({ ticker, label: ticker }));

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
            {favoriteRows.map((item: { ticker: string; label?: string }) => (
              <div key={item.ticker} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span className="font-medium text-slate-100">{item.label ?? item.ticker}</span>
                <span className="text-xs text-emerald-400">{Number(latestPrediction?.change_percent ?? 0) >= 0 ? '+2.4%' : '-1.1%'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-xl font-semibold text-white">Краткая сводка</h3>
          <ul className="mt-5 space-y-4 text-sm text-slate-300">
            {predictions.slice(0, 4).map((item: any) => (
              <li key={item.id} className="flex justify-between border-b border-slate-800 pb-2">
                <span>{item.ticker}</span>
                <span className={Number(item.change_percent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {Number(item.change_percent).toFixed(2)}%
                </span>
              </li>
            ))}
            {!predictions.length && (
              <li className="text-slate-400">Пока нет сохранённых прогнозов.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
