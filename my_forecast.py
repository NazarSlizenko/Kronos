import pandas as pd
import yfinance as yf
import matplotlib.pyplot as plt
from model import Kronos, KronosTokenizer, KronosPredictor

print("Loading Kronos model...")
tokenizer = KronosTokenizer.from_pretrained("NeoQuasar/Kronos-Tokenizer-base")
model = Kronos.from_pretrained("NeoQuasar/Kronos-small")
predictor = KronosPredictor(model, tokenizer, max_context=512)

print("Downloading real market data (Bitcoin)...")
df = yf.download("BTC-USD", period="60d", interval="1h", progress=False)

# ПРАВИЛЬНАЯ ОБРАБОТКА MULTINDEX ОТ YFINANCE
# yfinance возвращает кортежи вида (Field, Ticker) или (Ticker, Field)
if isinstance(df.columns, pd.MultiIndex):
    # Проверяем, какой уровень содержит названия полей (Open, High, Low, Close, Volume)
    first_val = df.columns.get_level_values(0)[0]
    if first_val in ['Open', 'High', 'Low', 'Close', 'Volume']:
        # Названия полей на первом уровне - берем его
        df.columns = df.columns.get_level_values(0)
    else:
        # Названия полей на втором уровне - берем его
        df.columns = df.columns.get_level_values(1)

df = df.reset_index()

# ПЕРЕИМЕНОВАНИЕ В ФОРМАТ KRONOS
rename_map = {
    "Date": "timestamps",
    "Datetime": "timestamps",
    "Open": "open",
    "High": "high", 
    "Low": "low",
    "Close": "close",
    "Volume": "volume"
}
df = df.rename(columns=rename_map)

print("Actual columns after rename:", df.columns.tolist())

# РАСЧЕТ 'amount'
if 'volume' in df.columns and 'close' in df.columns:
    df['amount'] = df['volume'] * df['close']
else:
    raise ValueError(f"Critical error: Expected 'volume' and 'close', but got: {df.columns.tolist()}")

# Параметры прогноза
lookback = 200
pred_len = 48

x_df = df.iloc[-lookback:][['open', 'high', 'low', 'close', 'volume', 'amount']].copy()
x_timestamp = df.iloc[-lookback:]['timestamps'].copy()

last_time = pd.to_datetime(x_timestamp.iloc[-1])
future_times = pd.Series(pd.date_range(start=last_time + pd.Timedelta(hours=1), periods=pred_len, freq='h'))

print(f"Generating forecast for {pred_len} hours...")
pred_df = predictor.predict(
    df=x_df,
    x_timestamp=x_timestamp,
    y_timestamp=future_times,
    pred_len=pred_len,
    T=1.0,
    top_k=0,
    top_p=0.9,
    sample_count=1,
    verbose=False
)

print("\nForecast ready! First 5 rows:")
print(pred_df.head())

plt.figure(figsize=(15, 6))
plt.plot(df.iloc[-lookback:]['timestamps'], df.iloc[-lookback:]['close'], label='Real Price (History)', color='blue')
plt.plot(pred_df.index, pred_df['close'], label='Kronos Forecast', color='red', linestyle='--', linewidth=2)
plt.title('Bitcoin Forecast by Kronos (small model)')
plt.xlabel('Time')
plt.ylabel('Price (USD)')
plt.legend()
plt.grid(True, alpha=0.3)
plt.tight_layout()

output_file = "btc_forecast.png"
plt.savefig(output_file)
print(f"Chart saved as {output_file} in D:\\Kronos")