import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8001';
const TOKEN_KEY = 'kronos_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY) ?? '';

export const setStoredToken = (token: string) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  }
};

export const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

export const ensureAuthToken = async () => {
  const current = getStoredToken();
  if (current) {
    return current;
  }

  const response = await api.post('/api/auth/login', {
    username: 'admin',
    password: 'admin123',
  });

  const token = response.data.access_token;
  setStoredToken(token);
  return token;
};

export const authHeaders = async () => ({
  Authorization: `Bearer ${await ensureAuthToken()}`,
});

export const getTickerList = async () => {
  const response = await api.get('/api/tickers');
  return response.data.tickers ?? [];
};

export interface MarketQuote {
  ticker: string;
  latest_price: number;
  latest_timestamp: string;
  interval: string;
  data_source: string;
}

export const formatMarketPrice = (ticker: string, price: number) => {
  const formatted = Number(price).toLocaleString('ru-RU', { maximumFractionDigits: 4 });
  return ticker.toUpperCase().endsWith('=X') ? formatted : `$${formatted}`;
};

export const getLatestMarketQuote = async (
  ticker: string,
): Promise<MarketQuote> => {
  const headers = await authHeaders();
  const response = await api.get(`/api/market/${encodeURIComponent(ticker)}`, {
    headers,
    params: { period: '5d', interval: '1h' },
  });
  return response.data;
};

export const getFavorites = async () => {
  const headers = await authHeaders();
  const response = await api.get('/api/favorites', { headers });
  return response.data ?? [];
};

export const getPredictions = async () => {
  const headers = await authHeaders();
  const response = await api.get('/api/predictions', { headers });
  return response.data ?? [];
};

export interface ForecastPoint {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  amount: number;
}

export interface PredictionResponse {
  ticker: string;
  latest_price: number;
  latest_timestamp: string;
  data_source: string;
  change_percent: number;
  confidence: number | null;
  forecast: ForecastPoint[];
}

export const predictTicker = async (payload: {
  ticker: string;
  period: string;
  interval: string;
  pred_len: number;
}): Promise<PredictionResponse> => {
  const headers = await authHeaders();
  const response = await api.post('/api/predict', payload, { headers });
  return response.data;
};
