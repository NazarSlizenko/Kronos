const stats = [
  { label: 'Средняя точность', value: '83.4%' },
  { label: 'Победные сделки', value: '64%' },
  { label: 'Средний доход', value: '+12.6%' },
  { label: 'Открытых сигналов', value: '8' },
];

const history = [
  { date: '04.11.2026', ticker: 'BTC-USD', signal: 'Покупка', score: '0.82' },
  { date: '03.11.2026', ticker: 'ETH-USD', signal: 'Покупка', score: '0.79' },
  { date: '02.11.2026', ticker: 'NVDA', signal: 'Стабильно', score: '0.71' },
  { date: '01.11.2026', ticker: 'MSFT', signal: 'Покупка', score: '0.76' },
];

export function AnalyticsPage() {
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
              {history.map((row) => (
                <tr key={`${row.date}-${row.ticker}`} className="border-b border-slate-800 last:border-none">
                  <td className="py-3 pr-4">{row.date}</td>
                  <td className="py-3 pr-4">{row.ticker}</td>
                  <td className="py-3 pr-4 text-emerald-400">{row.signal}</td>
                  <td className="py-3">{row.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
