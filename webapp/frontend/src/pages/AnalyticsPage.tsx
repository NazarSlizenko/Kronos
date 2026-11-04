import { useQuery } from '@tanstack/react-query';

import { getPredictions } from '../services/api';

export function AnalyticsPage() {
  const { data: history = [] } = useQuery({
    queryKey: ['predictions'],
    queryFn: getPredictions,
  });

  const accuracy = history.length
    ? `${Math.round((history.filter((item: any) => Number(item.change_percent) >= 0).length / history.length) * 100)}%`
    : '0%';

  const stats = [
    { label: 'Средняя точность', value: accuracy },
    { label: 'Победные сделки', value: `${history.filter((item: any) => Number(item.change_percent) >= 0).length}` },
    { label: 'Средний доход', value: history.length ? `${Math.max(...history.map((item: any) => Number(item.change_percent))).toFixed(1)}%` : '0.0%' },
    { label: 'Открытых сигналов', value: String(history.length) },
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
                <th className="pb-3 pr-4 font-medium">Сигнал</th>
                <th className="pb-3 font-medium">Уверенность</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row: any) => (
                  <tr key={`${row.id}-${row.ticker}`} className="border-b border-slate-800 last:border-none">
                    <td className="py-3 pr-4">{row.created_at ? new Date(row.created_at).toLocaleDateString('ru-RU') : '—'}</td>
                    <td className="py-3 pr-4">{row.ticker}</td>
                    <td className={`py-3 pr-4 ${Number(row.change_percent) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {Number(row.change_percent) >= 0 ? 'Покупка' : 'Продажа'}
                    </td>
                    <td className="py-3">{Math.round(Number(row.confidence) * 100)}%</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400">Пока нет данных по прогнозам.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
