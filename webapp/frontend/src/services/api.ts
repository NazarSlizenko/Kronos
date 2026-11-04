import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8001';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getTickerList = async () => {
  const response = await api.get('/api/tickers');
  return response.data.tickers ?? [];
};
