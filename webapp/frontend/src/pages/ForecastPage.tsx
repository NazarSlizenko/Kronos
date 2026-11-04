import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { getTickerList, predictTicker } from '../services/api';

const defaultForm = {
  ticker: 'BTC-USD',
  period: '7d',
  interval: '1h',
  pred_len: 12,
};

export function ForecastPage() {
  const [form, setForm] = useState(defaultForm);

  const { data: tickers = [] } = useQuery({
    queryKey: ['tickers'],
    queryFn: getTickerList,
  });

  const mutation = useMutation({
    mutationFn: predictTicker,
  });
  const errorMessage = isAxiosError<{ detail?: string }>(mutation.error)
    ? mutation.error.response?.data?.detail ?? mutation.error.message
    : mutation.error instanceof Error
      ? mutation.error.message
      : null;

  const chartData = useMemo(() => {
    const forecast = mutation.data?.forecast ?? [];
    return forecast.map((point: any) => ({
      label: new Date(point.timestamp).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
      close: Number(point.close),
      volume: Number(point.volume),
    }));
  }, [mutation.data]);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate(form);
  };

  const handleDownloadCsv = () => {
    const rows = mutation.data?.forecast ?? [];
    if (!rows.length) {
      return;
    }

    const headers = ['timestamp', 'open', 'high', 'low', 'close', 'volume', 'amount'];
    const csv = [headers.join(',')]
      .concat(
        rows.map((row: any) =>
          headers
            .map((header) => JSON.stringify(row[header] ?? ''))
            .join(','),
        ),
      )
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${form.ticker}-forecast.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm uppercase tracking-[0.25em] text-violet-400">forecast</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Прогноз рынка</h2>
      </section>

      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Тикер</span>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
                value={form.ticker}
                onChange={(event) => setForm({ ...form, ticker: event.target.value })}
              >
                {(tickers.length ? tickers : ['BTC-USD', 'ETH-USD']).map((ticker: string) => (
                  <option key={ticker} value={ticker}>{ticker}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Период</span>
              <input
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
                value={form.period}
                onChange={(event) => setForm({ ...form, period: event.target.value })}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Таймфрейм</span>
              <select
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-violet-500"
                value={form.interval}
                onChange={(event) => setForm({ ...form, interval: event.target.value })}
              >
                <option value="1h">1 час</option>
                <option value="4h">4 часа</option>
                <option value="1d">1 день</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-slate-300">Длина прогноза: {form.pred_len}</span>
              <input
                type="range"
                min={2}
                max={48}
                step={1}
                value={form.pred_len}
                onChange={(event) => setForm({ ...form, pred_len: Number(event.target.value) })}
                className="w-full accent-violet-500"
              />
            </label>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 font-medium text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mutation.isPending ? 'Генерируем прогноз...' : 'Запустить прогноз'}
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-semibold text-white">История и прогноз</h3>
            {mutation.data ? (
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                Доверие {Number(mutation.data.confidence * 100).toFixed(0)}%
              </span>
            ) : (
              <span className="rounded-full bg-slate-700 px-3 py-1 text-xs text-slate-300">Ожидание данных</span>
            )}
          </div>

          <div className="mt-6 h-72 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                  <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#94a3b8" tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }} />
                  <Line type="monotone" dataKey="close" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-slate-400">Пустой график. Запустите прогноз.</div>
            )}
          </div>
        </div>
      </div>

      {mutation.isError && (
        <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-200">
          Не удалось получить прогноз: {errorMessage ?? 'неизвестная ошибка'}
        </p>
      )}

      {mutation.data && (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Цена закрытия последней свечи</p>
            <p className="mt-2 text-2xl font-semibold text-white">${Number(mutation.data.latest_price).toLocaleString()}</p>
            <p className="mt-2 text-xs text-slate-500">
              {new Date(mutation.data.latest_timestamp).toLocaleString('ru-RU')}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Изменение</p>
            <p className={`mt-2 text-2xl font-semibold ${Number(mutation.data.change_percent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {Number(mutation.data.change_percent).toFixed(2)}%
            </p>
          </div>
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">Уверенность</p>
            <p className="mt-2 text-2xl font-semibold text-violet-400">{Number(mutation.data.confidence * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}

      {mutation.data?.forecast?.length ? (
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-white">Таблица прогноза</h3>
            <button
              type="button"
              onClick={handleDownloadCsv}
              className="rounded-lg border border-violet-500 px-3 py-2 text-sm text-violet-300 transition hover:bg-violet-500/10"
            >
              Скачать CSV
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-slate-200">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="pb-3 pr-4 font-medium">Время</th>
                  <th className="pb-3 pr-4 font-medium">Open</th>
                  <th className="pb-3 pr-4 font-medium">High</th>
                  <th className="pb-3 pr-4 font-medium">Low</th>
                  <th className="pb-3 pr-4 font-medium">Close</th>
                  <th className="pb-3 font-medium">Volume</th>
                </tr>
              </thead>
              <tbody>
                {mutation.data.forecast.map((row: any, index: number) => (
                  <tr key={`${row.timestamp}-${index}`} className="border-b border-slate-800 last:border-none">
                    <td className="py-3 pr-4">{new Date(row.timestamp).toLocaleString('ru-RU')}</td>
                    <td className="py-3 pr-4">{Number(row.open).toFixed(2)}</td>
                    <td className="py-3 pr-4">{Number(row.high).toFixed(2)}</td>
                    <td className="py-3 pr-4">{Number(row.low).toFixed(2)}</td>
                    <td className="py-3 pr-4">{Number(row.close).toFixed(2)}</td>
                    <td className="py-3">{Number(row.volume).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
