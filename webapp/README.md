# Kronos Web Platform

Локальная веб-платформа на FastAPI + React для прогноза финансовых рынков на базе модели Kronos.

## Что входит

- Backend: FastAPI, SQLAlchemy, SQLite
- Frontend: React + TypeScript + Vite + TailwindCSS + Recharts
- AI-модель: Kronos из директории `D:\Kronos\model`
- JWT-аутентификация для демо-пользователя
- История прогнозов, избранные тикеры, бэктестинг

## Требования

- Python 3.11
- Node.js 18+
- npm
- интернет для загрузки market data через yfinance

## Быстрый запуск

### 1. Подготовить виртуальное окружение Python

```powershell
cd D:\Kronos
python -V
D:\Kronos\venv\Scripts\python.exe -V
```

Если окружение отсутствует, создайте его:

```powershell
cd D:\Kronos
py -3.11 -m venv venv
```

### 2. Запустить backend

```powershell
cd D:\Kronos\webapp\backend
D:\Kronos\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

API доступно по адресам:

- Swagger: http://127.0.0.1:8001/docs
- Health: http://127.0.0.1:8001/health

Демо-пользователь:

- username: admin
- password: admin123

### 3. Запустить frontend

```powershell
cd D:\Kronos\webapp\frontend
npm install
npm run dev -- --host 0.0.0.0 --port 5173
```

Frontend доступен по адресу:

- http://localhost:5173

## Команда для запуска всего проекта одним файлом

В корне репозитория есть `start.bat`:

```powershell
cd D:\Kronos
start.bat
```

Он запускает backend и frontend в отдельных окнах командной строки.

## Notes

- Цена в прогнозе — цена закрытия последней полученной свечи; интерфейс показывает время этой свечи. Если Yahoo Finance недоступен или не вернул данные, API сообщает об ошибке и не подменяет котировки синтетическими значениями.
- Модель Kronos загружается один раз при старте backend и не копируется в webapp.
- База данных SQLite хранится в `D:\Kronos\webapp\backend\app.db`.
