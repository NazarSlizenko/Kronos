import { useQuery } from '@tanstack/react-query';
import { getTickerList } from '../services/api';

export function ForecastPage() {
  const { data: tickers = [] } = useQuery({
    queryKey: ['tickers'],
    queryFn: getTickerList,
  });

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm uppercase tracking-[0.25em] text-violet-400">forecast</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Прогноз рынка</h2>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Тикер</span>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none ring-0 focus:border-violet-500" defaultValue={tickers[0] ?? 'BTC-USD'}>
                {(tickers.length ? tickers : ['BTC-USD', 'ETH-USD']).map((ticker: string) => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Период</span>
              <input className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500" defaultValue="60d" />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Таймфрейм</span>
              <select className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500" defaultValue="1h">
                <option value="1h">1 час</option>
                <option value="4h">4 часа</option>
                <option value="1d">1 день</option>
              </select>
            </label>

            <button type="button" className="w-full rounded-xl bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500">
              Запустить прогноз
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">История и прогноз</h3>
            <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">Доверие 82%</span>
          </div>
          <div className="mt-6 h-72 rounded-xl bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/50 p-4">
            <div className="flex h-full items-end gap-2">
              {[42, 51, 58, 46, 64, 72, 90, 84, 96, 88, 73, 88].map((bar, index) => (
                <div key={index} className="flex-1 rounded-t-md bg-gradient-to-t from-violet-600 to-pink-400" style={{ height: `${bar}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
