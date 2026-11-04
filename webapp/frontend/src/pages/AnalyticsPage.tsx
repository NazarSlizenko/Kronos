import { isAxiosError } from 'axios';
import { useQuery } from '@tanstack/react-query';

import {
  evaluatePredictions,
  formatMarketPrice,
  getPredictions,
  type PredictionRecord,
} from '../services/api';

export function AnalyticsPage() {
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['predictions'],
    queryFn: async () => {
      const evaluationRun = await evaluatePredictions();
      const history = await getPredictions();
      return { evaluationRun, history };
    },
    refetchOnWindowFocus: true,
  });
  const history = data?.history ?? [];

  const evaluated = history.filter((item) => item.evaluation?.status === 'evaluated');
  const awaiting = history.filter((item) => item.evaluation?.status === 'awaiting_actual');
  const mean = (values: number[]) =>
    values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;

  const averagePredictedChange = mean(
    evaluated.map((item) => item.evaluation!.predicted_change_percent),
  );
  const averageActualChange = mean(
    evaluated.map((item) => item.evaluation!.actual_change_percent!),
  );
  const averageAbsoluteError = mean(
    evaluated.map((item) => item.evaluation!.absolute_error_percent!),
  );
  const directionAccuracy = evaluated.length
    ? (evaluated.filter((item) => item.evaluation!.direction_correct).length / evaluated.length) * 100
    : null;

  const stats = [
    { label: 'Всего прогнозов', value: String(history.length) },
    { label: 'Ожидают фактических данных', value: String(awaiting.length) },
    {
      label: 'Среднее прогнозное изменение',
      value: averagePredictedChange === null ? '—' : `${averagePredictedChange.toFixed(2)}%`,
    },
    {
      label: 'Среднее фактическое изменение',
      value: averageActualChange === null ? '—' : `${averageActualChange.toFixed(2)}%`,
    },
    {
      label: 'Средняя абсолютная ошибка',
      value: averageAbsoluteError === null ? '—' : `${averageAbsoluteError.toFixed(2)} п.п.`,
    },
    {
      label: 'Совпадение направления',
      value: directionAccuracy === null ? '—' : `${directionAccuracy.toFixed(0)}%`,
    },
  ];

  const errorMessage = isAxiosError<{ detail?: string }>(error)
    ? error.response?.data?.detail ?? error.message
    : error instanceof Error
      ? error.message
      : null;

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-400">analytics</p>
          <h2 className="mt-2 text-3xl font-bold text-white">История и результаты прогнозов</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Каждый прогноз сохраняется автоматически. После завершения его горизонта приложение
            сравнивает прогнозную цену с фактической ценой следующей доступной закрытой свечи.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          disabled={isFetching}
          className="rounded-xl border border-violet-500 px-4 py-2 text-sm text-violet-200 transition hover:bg-violet-500/10 disabled:opacity-60"
        >
          {isFetching ? 'Проверяем рынок…' : 'Обновить фактические результаты'}
        </button>
      </section>

      {isError && (
        <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-200">
          Не удалось обновить историю: {errorMessage ?? 'неизвестная ошибка'}
        </p>
      )}

      {data?.evaluationRun && (
        <p className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          Проверено созревших прогнозов: {data.evaluationRun.checked}; новых фактических результатов: {data.evaluationRun.evaluated}.
          {data.evaluationRun.errors.length > 0 && (
            <span className="ml-1 text-amber-300">
              Не удалось проверить котировки: {data.evaluationRun.errors.map((item) => item.ticker).join(', ')}.
            </span>
          )}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <p className="text-sm text-slate-400">{item.label}</p>
            <p className="mt-4 text-2xl font-semibold text-white">{isPending ? '…' : item.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
        <h3 className="text-xl font-semibold text-white">История</h3>
        <p className="mt-2 text-sm text-slate-400">
          Ошибка указана в процентных пунктах: разница между прогнозным и фактическим изменением от исходной цены.
        </p>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-left text-sm text-slate-200">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="pb-3 pr-4 font-medium">Создан</th>
                <th className="pb-3 pr-4 font-medium">Тикер / шаг</th>
                <th className="pb-3 pr-4 font-medium">Цена на старте</th>
                <th className="pb-3 pr-4 font-medium">Прогноз: цена / изменение</th>
                <th className="pb-3 pr-4 font-medium">Факт: цена / изменение</th>
                <th className="pb-3 pr-4 font-medium">Ошибка</th>
                <th className="pb-3 font-medium">Результат</th>
              </tr>
            </thead>
            <tbody>
              {history.length ? (
                history.map((row: PredictionRecord) => {
                  const evaluation = row.evaluation;
                  const isEvaluated = evaluation?.status === 'evaluated';
                  const hasEvaluation = Boolean(evaluation);
                  const predictedPrice = evaluation?.predicted_price;
                  const predictedChange = evaluation?.predicted_change_percent ?? row.change_percent;

                  return (
                    <tr key={row.id} className="border-b border-slate-800 align-top last:border-none">
                      <td className="py-4 pr-4">
                        {row.created_at ? new Date(row.created_at).toLocaleString('ru-RU') : '—'}
                        {row.data_source && <div className="mt-1 text-xs text-slate-500">{row.data_source}</div>}
                      </td>
                      <td className="py-4 pr-4">
                        {row.ticker}
                        <div className="mt-1 text-xs text-slate-500">{row.interval} · {row.period}</div>
                      </td>
                      <td className="py-4 pr-4">
                        {row.latest_price !== null && row.data_source
                          ? formatMarketPrice(row.ticker, row.latest_price)
                          : '—'}
                        {row.latest_timestamp && (
                          <div className="mt-1 text-xs text-slate-500">
                            Свеча: {new Date(row.latest_timestamp).toLocaleString('ru-RU')}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {predictedPrice !== undefined && hasEvaluation
                          ? formatMarketPrice(row.ticker, predictedPrice)
                          : 'Нет сохранённых данных'}
                        {predictedChange !== null && predictedChange !== undefined && hasEvaluation && (
                          <div className="mt-1 text-xs text-violet-300">
                            {predictedChange > 0 ? '+' : ''}{predictedChange.toFixed(2)}%
                          </div>
                        )}
                        {evaluation?.target_timestamp && (
                          <div className="mt-1 text-xs text-slate-500">
                            Цель: {new Date(evaluation.target_timestamp).toLocaleString('ru-RU')}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {isEvaluated && evaluation.actual_price !== undefined
                          ? formatMarketPrice(row.ticker, evaluation.actual_price)
                          : 'Ожидается'}
                        {isEvaluated && evaluation.actual_change_percent !== undefined && (
                          <div className="mt-1 text-xs text-slate-300">
                            {evaluation.actual_change_percent > 0 ? '+' : ''}{evaluation.actual_change_percent.toFixed(2)}%
                          </div>
                        )}
                        {evaluation?.actual_timestamp && (
                          <div className="mt-1 text-xs text-slate-500">
                            Свеча: {new Date(evaluation.actual_timestamp).toLocaleString('ru-RU')}
                          </div>
                        )}
                      </td>
                      <td className="py-4 pr-4">
                        {isEvaluated && evaluation.absolute_error_percent !== undefined
                          ? `${evaluation.absolute_error_percent.toFixed(2)} п.п.`
                          : '—'}
                      </td>
                      <td className="py-4">
                        {!hasEvaluation
                          ? 'Старая запись без данных для оценки'
                          : isEvaluated
                            ? evaluation.direction_correct
                              ? 'Направление совпало'
                              : 'Направление не совпало'
                            : 'Ожидает закрытия целевой свечи'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    {isPending ? 'Загружаем прогнозы…' : 'Прогнозов пока нет. Создайте первый на странице «Прогноз».'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
