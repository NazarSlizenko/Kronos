import { isAxiosError } from 'axios';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import {
  deletePrediction,
  evaluatePredictions,
  formatMarketPrice,
  getLatestMarketQuote,
  getPredictions,
  type PredictionRecord,
} from '../services/api';

interface PredictionChartPoint {
  timestamp: string;
  historicalPrice: number | null;
  forecastPrice: number | null;
  currentPrice: number | null;
}

function PredictionChart({ prediction }: { prediction: PredictionRecord }) {
  const { data: currentQuote, isError, isFetching } = useQuery({
    queryKey: ['prediction-current-quote', prediction.id, prediction.ticker, prediction.interval],
    queryFn: () => getLatestMarketQuote(prediction.ticker, prediction.interval),
    refetchInterval: 5 * 60 * 1000,
    retry: false,
  });

  const chartData = useMemo(() => {
    const observations = prediction.result_summary?.history ?? [];
    const forecast = prediction.result_summary?.forecast ?? [];
    const points: PredictionChartPoint[] = [
      ...observations.map((point) => ({
        timestamp: point.timestamp,
        historicalPrice: point.close,
        forecastPrice: null as number | null,
        currentPrice: null as number | null,
      })),
      ...(observations.length && prediction.latest_price !== null
        ? [{
            timestamp: prediction.latest_timestamp ?? observations[observations.length - 1].timestamp,
            historicalPrice: prediction.latest_price,
            forecastPrice: prediction.latest_price,
            currentPrice: null,
          }]
        : []),
      ...forecast.map((point) => ({
        timestamp: point.timestamp,
        historicalPrice: null,
        forecastPrice: point.close,
        currentPrice: null,
      })),
    ];

    if (currentQuote) {
      points.push({
        timestamp: currentQuote.latest_timestamp,
        historicalPrice: null,
        forecastPrice: null,
        currentPrice: currentQuote.latest_price,
      });
    }

    return points
      .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
      .map((point) => ({
        ...point,
        label: new Date(point.timestamp).toLocaleString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));
  }, [currentQuote, prediction]);

  const priceDomain = useMemo((): [number, number] | ['auto', 'auto'] => {
    const values = chartData.flatMap((point) => [
      point.historicalPrice,
      point.forecastPrice,
      point.currentPrice,
    ]).filter((value): value is number => value !== null && Number.isFinite(value));
    if (!values.length) {
      return ['auto', 'auto'];
    }
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = Math.max((max - min) * 0.1, max * 0.0005, Number.EPSILON);
    return [Math.max(0, min - padding), max + padding];
  }, [chartData]);

  const formatPrice = (value: number) => {
    const price = Number(value).toLocaleString('ru-RU', { maximumFractionDigits: 2 });
    return prediction.ticker.endsWith('=X') ? price : `$${price}`;
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-400">Цена при прогнозе</p>
          <p className="mt-2 font-semibold text-sky-300">
            {prediction.latest_price === null ? '—' : formatPrice(prediction.latest_price)}
          </p>
          {prediction.latest_timestamp && (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(prediction.latest_timestamp).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-400">Текущая закрытая свеча</p>
          <p className="mt-2 font-semibold text-amber-300">
            {currentQuote ? formatPrice(currentQuote.latest_price) : isFetching ? 'Загрузка…' : 'Недоступна'}
          </p>
          {currentQuote && (
            <>
              <p className="mt-1 text-xs text-slate-500">
                {new Date(currentQuote.latest_timestamp).toLocaleString('ru-RU')}
              </p>
              <p className="mt-1 text-xs text-slate-500">{currentQuote.data_source}</p>
            </>
          )}
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
          <p className="text-xs text-slate-400">Последняя прогнозная цена</p>
          <p className="mt-2 font-semibold text-violet-300">
            {prediction.evaluation
              ? formatPrice(prediction.evaluation.predicted_price)
              : 'Нет сохранённых данных'}
          </p>
          {prediction.evaluation?.target_timestamp && (
            <p className="mt-1 text-xs text-slate-500">
              {new Date(prediction.evaluation.target_timestamp).toLocaleString('ru-RU')}
            </p>
          )}
        </div>
      </div>

      {isError && (
        <p role="alert" className="text-sm text-rose-300">
          Не удалось получить текущую котировку. На графике остаются сохранённые данные прогноза.
        </p>
      )}

      <div
        className="h-80 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
        style={{ height: 320, minHeight: 320 }}
      >
        {chartData.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 12, left: 12, bottom: 10 }}>
              <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke="#94a3b8" tick={{ fontSize: 10 }} />
              <YAxis
                type="number"
                domain={priceDomain}
                tickFormatter={formatPrice}
                stroke="#94a3b8"
                tick={{ fontSize: 10 }}
                width={88}
              />
              <Tooltip
                formatter={(value) => [formatPrice(Number(value)), '']}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: 12 }}
              />
              <Line type="monotone" dataKey="historicalPrice" name="История" stroke="#38bdf8" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="forecastPrice" name="Прогноз Kronos" stroke="#a78bfa" strokeWidth={3} dot={false} connectNulls />
              <Line type="monotone" dataKey="currentPrice" name="Текущая цена" stroke="#fbbf24" strokeWidth={0} dot={{ r: 6 }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-slate-400">
            Для этой старой записи исторические точки не сохранены.
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-slate-300">
        <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-sky-400" />Историческая цена</span>
        <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-violet-400" />Прогноз Kronos</span>
        <span><span className="mr-2 inline-block h-2 w-2 rounded-full bg-amber-300" />Текущая цена</span>
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const queryClient = useQueryClient();
  const [selectedPrediction, setSelectedPrediction] = useState<PredictionRecord | null>(null);
  const { data, isPending, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['analytics-predictions'],
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

  const deleteMutation = useMutation({
    mutationFn: deletePrediction,
    onSuccess: async (_, id) => {
      setSelectedPrediction((selected) => selected?.id === id ? null : selected);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['analytics-predictions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard-predictions'] }),
      ]);
    },
  });

  const errorMessage = isAxiosError<{ detail?: string }>(error)
    ? error.response?.data?.detail ?? error.message
    : error instanceof Error
      ? error.message
      : null;
  const deleteError = isAxiosError<{ detail?: string }>(deleteMutation.error)
    ? deleteMutation.error.response?.data?.detail ?? deleteMutation.error.message
    : deleteMutation.error instanceof Error
      ? deleteMutation.error.message
      : null;

  const handleDelete = (prediction: PredictionRecord) => {
    if (window.confirm(`Удалить прогноз ${prediction.ticker} от ${prediction.created_at ? new Date(prediction.created_at).toLocaleString('ru-RU') : ''}?`)) {
      deleteMutation.mutate(prediction.id);
    }
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.25em] text-violet-400">analytics</p>
          <h2 className="mt-2 text-3xl font-bold text-white">История и результаты прогнозов</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-400">
            Каждый прогноз сохраняется автоматически. Нажмите на него, чтобы открыть график
            исторической, прогнозной и текущей цены.
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

      {deleteMutation.isError && (
        <p role="alert" className="rounded-xl border border-rose-900 bg-rose-950/50 p-4 text-sm text-rose-200">
          Не удалось удалить прогноз: {deleteError ?? 'неизвестная ошибка'}
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
                <th className="pb-3 pr-4 font-medium">Результат</th>
                <th className="pb-3 font-medium">Действия</th>
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
                      <td className="py-4 pr-4">
                        {!hasEvaluation
                          ? 'Старая запись без данных для оценки'
                          : isEvaluated
                            ? evaluation.direction_correct
                              ? 'Направление совпало'
                              : 'Направление не совпало'
                            : 'Ожидает закрытия целевой свечи'}
                      </td>
                      <td className="py-4">
                        <div className="flex flex-col items-start gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedPrediction(row)}
                            className="text-sm text-violet-300 hover:text-violet-200"
                          >
                            График
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(row)}
                            disabled={deleteMutation.isPending}
                            className="text-sm text-rose-300 hover:text-rose-200 disabled:opacity-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    {isPending ? 'Загружаем прогнозы…' : 'Прогнозов пока нет. Создайте первый на странице «Прогноз».'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPrediction && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4"
          style={{ position: 'fixed', inset: 0, overflowY: 'auto' }}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedPrediction(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="prediction-chart-title"
            className="my-auto w-full max-w-5xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-violet-300">{selectedPrediction.ticker} · {selectedPrediction.interval}</p>
                <h3 id="prediction-chart-title" className="mt-1 text-2xl font-semibold text-white">
                  График прогноза и текущей цены
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  Прогноз создан {selectedPrediction.created_at
                    ? new Date(selectedPrediction.created_at).toLocaleString('ru-RU')
                    : '—'}
                </p>
              </div>
              <button
                type="button"
                aria-label="Закрыть график"
                onClick={() => setSelectedPrediction(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
              >
                Закрыть
              </button>
            </div>
            <PredictionChart prediction={selectedPrediction} />
          </section>
        </div>
      )}
    </div>
  );
}
