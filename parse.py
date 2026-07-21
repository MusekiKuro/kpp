import pandas as pd
import json

try:
    df = pd.read_excel('Прайс-лист от 17.06.2026.xlsx')
    
    # We want to find air conditioners. We can look for keywords in any text column,
    # or just print everything if the dataset is small enough, but it's 650KB, probably 1000s of rows.
    # Let's search for "кондиционер", "сплит", "almacom", "acron" or similar.
    # We will print the first 20 rows that match our criteria.
    
    # Convert all string columns to lowercase for easier searching
    mask = pd.Series(False, index=df.index)
    keywords = ['кондиционер', 'сплит', 'almacom', 'acron', 'klima', 'btu']
    
    for col in df.columns:
        if df[col].dtype == object:
            # Check if any keyword is in this column
            for kw in keywords:
                mask = mask | df[col].astype(str).str.lower().str.contains(kw, na=False)

    filtered_df = df[mask]
    
    # If we couldn't find them by keywords, maybe it's just a raw list.
    if filtered_df.empty:
        # Just return the first 50 rows
        filtered_df = df.head(50)
        
    # We only need 15 items anyway.
    results = filtered_df.head(20).to_dict(orient='records')
    
    print(json.dumps(results, ensure_ascii=False, indent=2))
    
except Exception as e:
    print(f"Error: {e}")
