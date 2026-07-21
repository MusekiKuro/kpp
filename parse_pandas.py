import pandas as pd
import json

df = pd.read_excel('Прайс-лист от 17.06.2026.xlsx')
mask = pd.Series(False, index=df.index)
keywords = ['кондиционер', 'сплит', 'almacom']

for col in df.columns:
    if df[col].dtype == object:
        for kw in keywords:
            mask = mask | df[col].astype(str).str.lower().str.contains(kw, na=False)

filtered_df = df[mask]

# Also get some random non-empty ones if empty
if filtered_df.empty:
    filtered_df = df.head(100)

results = filtered_df.head(20).to_dict(orient='records')
with open('output.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, ensure_ascii=False, indent=2)
