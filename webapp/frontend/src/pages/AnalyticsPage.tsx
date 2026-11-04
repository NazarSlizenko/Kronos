import { useQuery } from '@tanstack/react-query';

import { formatMarketPrice, getPredictions } from '../services/api';

export function AnalyticsPage() {
  const { data: history = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: getPredictions,
  });

  const verifiedHistory = history.filter((item: any) => Boolean(item.data_source));
  const averageForecastChange = verifiedHistory.length
    ? verifiedHistory.reduce((total: number, item: any) => total + Number(item.change_percent), 0) / verifiedHistory.length
    : 0;
  const upwardForecasts = verifiedHistory.filter((item: any) => Number(item.change_percent) > 0).length;

  const stats = [
    { label: 'Сохранено прогнозов', value: String(history.length) },
    { label: 'С прогнозом и источником', value: String(verifiedHistory.length) },
    { label: 'Среднее изменение прогноза', value: verifiedHistory.length ? `${averageForecastChange.toFixed(2)}%` : '—' },
    { label: 'Прогнозов на рост', value: String(upwardForecasts) },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm uppercase tracking-[0.25em] text-violet-400">analytics</p>
        <h2 className="mt-2 text-3xl font-bold text-white">Аналитика и история</h2>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="mt-4 text-2xl font-semibold text-white">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold text-white">История прогнозов</h3>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 pr-4 font-medium">Дата</th>
                <th className="pb-3 pr-4 font-medium">Тикер</th>
                <th className="pb-3 pr-4 font-medium">Цена исходной свечи</th>
                <th className="pb-3 pr-4 font-medium">Свеча по времени</th>
                <th className="pb-3 pr-4 font-medium">Источник</th>
                <th className="pb-3 pr-4 font-medium">Направление</th>
                <th className="pb-3 pr-4 font-medium">Изменение</th>
                <th className="pb-3 font-medium">Фактическая точность</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row: any) => (
                  <tr key={`${row.id}-${row.ticker}`} className="border-b border-slate-800 last:border-none">
                    <td className="py-3 pr-4">{row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                    <td className="py-3 pr-4">{row.ticker}</td>
                    <td className="py-3 pr-4">
                      {row.data_source && row.latest_price !== null
                        ? formatMarketPrice(row.ticker, Number(row.latest_price))
                        : '—'}
                    </td>
                    <td className="py-3 pr-4">
                      {row.latest_timestamp ? new Date(row.latest_timestamp).toLocaleString('ru-RU') : 'Не сохранено'}
                    </td>
                    <td className="py-3 pr-4">{row.data_source ?? 'Не сохранён'}</td>
                    <td className={`py-3 pr-4 ${!row.data_source ? 'text-slate-500' : Number(row.change_percent) > 0 ? 'text-emerald-400' : Number(row.change_percent) < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {!row.data_source ? 'Не подтверждён' : Number(row.change_percent) > 0 ? 'Рост' : Number(row.change_percent) < 0 ? 'Снижение' : 'Без изменения'}
                    </td>
                    <td className="py-3 pr-4">{row.data_source ? `${Number(row.change_percent).toFixed(2)}%` : '—'}</td>
                    <td className="py-3">Не измерена</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">Пока нет данных по прогнозам.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
