
# AGENTS.md — Инструкции для AI-агента

## 📍 Контекст проекта

Ты работаешь над проектом **Kronos** — фундаментальной моделью для 
прогнозирования финансовых рынков на базе трансформера. 

**Текущее состояние:**
- Модель Kronos уже установлена и работает в `D:\Kronos\model`
- Виртуальное окружение: `D:\Kronos\venv` (Python 3.11)
- Есть рабочий скрипт `my_forecast.py`, который делает прогноз Bitcoin
- Нужно создать **веб-платформу** для личного использования поверх этой модели

**ВАЖНО:** Модель Kronos требует Python 3.11. НЕ использовать Python 3.14.

## 🐛 Известные баги Kronos (учитывай при работе)

1. **MultiIndex от yfinance**: `yfinance` возвращает колонки как MultiIndex. 
   Нужно обрабатывать:
   ```python
   if isinstance(df.columns, pd.MultiIndex):
       first_val = df.columns.get_level_values(0)[0]
       if first_val in ['Open', 'High', 'Low', 'Close', 'Volume']:
           df.columns = df.columns.get_level_values(0)
       else:
           df.columns = df.columns.get_level_values(1)
   ```

2. **Колонка `amount`**: Kronos падает с ошибкой 
   `Cannot set a DataFrame with multiple columns to the single column amount`.
   **Решение:** добавлять `amount` вручную ДО вызова `predictor.predict()`:
   ```python
   df['amount'] = df['volume'] * df['close']
   ```

3. **DatetimeIndex vs Series**: Функция `calc_time_stamps` внутри Kronos 
   требует `pd.Series`, а не `DatetimeIndex`. 
   **Решение:** оборачивать `pd.date_range()` в `pd.Series()`.

4. **Требования к DataFrame**: нужны колонки 
   `['open', 'high', 'low', 'close', 'volume', 'amount']` (строчные буквы).

## 🎯 Целевая архитектура веб-платформы

```
D:\Kronos\webapp\
├── backend\              # FastAPI (Python 3.11)
│   ├── app\
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models\       # SQLAlchemy
│   │   ├── services\     # kronos_service.py, data_service.py
│   │   ├── api\          # эндпоинты
│   │   └── utils\
│   ├── requirements.txt
│   └── .env
├── frontend\             # React + TypeScript + Tailwind + Recharts
│   ├── src\
│   │   ├── components\
│   │   ├── pages\        # Dashboard, Forecast, Analytics
│   │   ├── services\
│   │   └── App.tsx
│   └── package.json
└── README.md
```

## 📋 Пошаговый план реализации

Выполняй задачи СТРОГО ПО ПОРЯДКУ. После каждого шага — тестируй 
и показывай результат. НЕ переходи к следующему шагу, пока текущий 
не работает.

### ШАГ 1: Backend — основа (FastAPI)
- [ ] Создать структуру папок `webapp/backend/`
- [ ] Настроить виртуальное окружение для backend (Python 3.11)
- [ ] Установить зависимости: fastapi, uvicorn, sqlalchemy, pydantic, 
      yfinance, pandas, loguru, python-dotenv
- [ ] Создать `config.py` с чтением из `.env`
- [ ] Создать `database.py` с SQLite
- [ ] Создать модели SQLAlchemy: `User`, `Prediction`, `FavoriteTicker`
- [ ] Создать `kronos_service.py` — загрузка модели ОДИН РАЗ при старте
- [ ] Создать `data_service.py` — загрузка данных через yfinance 
      с обработкой MultiIndex
- [ ] Создать эндпоинт `POST /api/predict` — базовый прогноз
- [ ] Создать эндпоинт `GET /api/tickers` — список тикеров
- [ ] **ТЕСТ:** запустить `uvicorn app.main:app --reload`, 
      открыть `/docs`, сделать тестовый прогноз через Swagger
- [ ] Закоммитить

### ШАГ 2: Backend — дополнительная логика
- [ ] Эндпоинты аутентификации (простой JWT, один пользователь)
- [ ] Эндпоинты истории прогнозов
- [ ] Эндпоинты избранного
- [ ] Сервис бэктестинга (упрощенный)
- [ ] **ТЕСТ:** проверить все эндпоинты через Swagger
- [ ] Закоммитить

### ШАГ 3: Frontend — основа (React)
- [ ] Инициализировать React + TypeScript + Vite
- [ ] Установить: tailwindcss, recharts, react-router-dom, axios, 
      @tanstack/react-query
- [ ] Настроить Tailwind с dark mode
- [ ] Создать базовый layout с навигацией (Dashboard, Forecast, Analytics)
- [ ] Создать API клиент с axios
- [ ] **ТЕСТ:** запустить `npm run dev`, проверить навигацию
- [ ] Закоммитить

### ШАГ 4: Frontend — страница прогноза
- [ ] Форма с параметрами (тикер, период, таймфрейм, слайдеры)
- [ ] Вызов API `/api/predict`
- [ ] Интерактивный график Recharts (история + прогноз)
- [ ] Отображение метрик (цена, изменение %, уверенность)
- [ ] Таблица прогноза + кнопка скачивания CSV
- [ ] **ТЕСТ:** сделать прогноз для BTC-USD, проверить график
- [ ] Закоммитить

### ШАГ 5: Frontend — Dashboard и аналитика
- [ ] Dashboard с избранными тикерами (карточки)
- [ ] Страница аналитики с историей прогнозов
- [ ] Статистика точности
- [ ] **ТЕСТ:** полный workflow
- [ ] Закоммитить

### ШАГ 6: Финализация
- [ ] Написать README.md с инструкцией запуска
- [ ] Создать `start.bat` для удобного запуска всего одной командой
- [ ] Финальное тестирование

## ⚙️ Правила работы агента

1. **Язык:** Все комментарии в коде и строки интерфейса — на РУССКОМ.
2. **Итеративность:** Делай маленькие шаги. После каждого значимого 
   изменения — запускай и проверяй.
3. **Тестирование:** После каждого шага обязательно тестируй результат.
4. **Коммиты:** Делай git commit после каждого завершенного шага 
   с понятным сообщением на русском.
5. **Ошибки:** Если что-то не работает — НЕ переходи дальше. 
   Сначала исправь.
6. **Модель Kronos:** Импортируй из `D:\Kronos\model`, 
   НЕ копируй её в webapp.
7. **Виртуальное окружение:** Используй существующее `D:\Kronos\venv` 
   или создай отдельное для backend.
8. **Без Docker:** Запуск локально, без контейнеров.
9. **Логирование:** Используй loguru, логи в `webapp/backend/logs/`.
10. **Безопасность:** Секреты — только в `.env`, не коммитить `.env`.

## 🔧 Технические требования

**Backend:**
- Python 3.11 (ОБЯЗАТЕЛЬНО)
- FastAPI + Uvicorn
- SQLAlchemy + SQLite
- Pydantic v2
- Модель загружается ОДИН РАЗ при старте (global singleton)

**Frontend:**
- React 18 + TypeScript
- Vite (не Create React App)
- TailwindCSS (dark mode по умолчанию)
- Recharts для графиков
- React Router v6
- Axios + React Query

## 📝 Формат ответа

Когда я прошу выполнить шаг:
1. Кратко опиши, что будешь делать (2-3 предложения)
2. Создай/обнови файлы
3. Покажи команды для запуска
4. Опиши, как проверить, что всё работает
5. Спроси, переходить ли к следующему шагу
