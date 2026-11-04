import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { formatMarketPrice, getFavorites, getLatestMarketQuote, getPredictions, getTickerList } from '../services/api';

export function DashboardPage() {
  const [selectedTicker, setSelectedTicker] = useState('BTC-USD');

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

  const quoteQuery = useQuery({
    queryKey: ['market-quote', selectedTicker],
    queryFn: () => getLatestMarketQuote(selectedTicker),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const quoteError = isAxiosError<{ detail?: string }>(quoteQuery.error)
    ? quoteQuery.error.response?.data?.detail ?? quoteQuery.error.message
    : quoteQuery.error instanceof Error
      ? quoteQuery.error.message
      : null;
  const verifiedPredictions = predictions.filter((item: any) => Boolean(item.data_source));
  const latestPrediction = verifiedPredictions[0];
  const forecastChange = Number(latestPrediction?.change_percent ?? 0);
  const summaryCards = [
    { label: 'Направление прогноза', value: latestPrediction ? (forecastChange > 0 ? 'Рост' : forecastChange < 0 ? 'Снижение' : 'Без изменения') : 'Ожидание', accent: forecastChange > 0 ? 'text-emerald-400' : forecastChange < 0 ? 'text-rose-400' : 'text-slate-400' },
    { label: 'Фактическая точность', value: 'Не измерена', accent: 'text-violet-400' },
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
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 shadow-xl shadow-slate-950/20">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-slate-400">Цена закрытия последней завершённой свечи</p>
            <select
              aria-label="Тикер для текущей котировки"
              className="max-w-28 rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
              value={selectedTicker}
              onChange={(event) => setSelectedTicker(event.target.value)}
            >
              {(tickers.length ? tickers : ['BTC-USD', 'ETH-USD']).map((ticker: string) => (
                <option key={ticker} value={ticker}>{ticker}</option>
              ))}
            </select>
          </div>
          {quoteQuery.isError ? (
            <p role="alert" className="mt-4 text-sm text-rose-300">
              Котировка недоступна: {quoteError ?? 'источник данных не ответил'}
            </p>
          ) : (
            <>
              <p className="mt-4 text-2xl font-semibold text-sky-400">
                {quoteQuery.data ? formatMarketPrice(selectedTicker, quoteQuery.data.latest_price) : 'Загрузка…'}
              </p>
              {quoteQuery.data && (
                <>
                  <p className="mt-2 text-xs text-slate-500">
                    {new Date(quoteQuery.data.latest_timestamp).toLocaleString('ru-RU')}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">{quoteQuery.data.data_source}</p>
                </>
              )}
            </>
          )}
        </div>
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
            <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs text-violet-300">Избранное</span>
          </div>
          <div className="mt-5 grid gap-3">
            {favoriteRows.map((item: { ticker: string; label?: string }) => (
              <div key={item.ticker} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <span className="font-medium text-slate-100">{item.label ?? item.ticker}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h3 className="text-xl font-semibold text-white">Краткая сводка</h3>
          <ul className="mt-5 space-y-4 text-sm text-slate-300">
            {verifiedPredictions.slice(0, 4).map((item: any) => (
              <li key={item.id} className="flex justify-between border-b border-slate-800 pb-2">
                <span>{item.ticker}</span>
                <span className={Number(item.change_percent) > 0 ? 'text-emerald-400' : Number(item.change_percent) < 0 ? 'text-rose-400' : 'text-slate-400'}>
                  {Number(item.change_percent).toFixed(2)}%
                </span>
              </li>
            ))}
            {!verifiedPredictions.length && (
              <li className="text-slate-400">Нет прогнозов с подтверждённым источником котировок.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
