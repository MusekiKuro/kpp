import zipfile
import xml.etree.ElementTree as ET
import json
import re

def parse_xlsx(filename):
    with zipfile.ZipFile(filename, 'r') as z:
        # Get shared strings
        shared_strings = []
        try:
            with z.open('xl/sharedStrings.xml') as f:
                tree = ET.parse(f)
                root = tree.getroot()
                ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
                for si in root.findall('main:si', ns):
                    t = si.find('main:t', ns)
                    if t is not None:
                        shared_strings.append(t.text)
                    else:
                        texts = [rt.text for rt in si.findall('.//main:t', ns) if rt.text]
                        shared_strings.append(''.join(texts))
        except Exception as e:
            print("No shared strings:", e)
            
        # Parse sheet 1
        with z.open('xl/worksheets/sheet1.xml') as f:
            tree = ET.parse(f)
            root = tree.getroot()
            ns = {'main': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            rows = root.find('main:sheetData', ns).findall('main:row', ns)
            
            data = []
            for row in rows:
                row_data = []
                for c in row.findall('main:c', ns):
                    v = c.find('main:v', ns)
                    if v is not None:
                        val = v.text
                        if c.attrib.get('t') == 's':
                            val = shared_strings[int(val)]
                        row_data.append(val)
                    else:
                        row_data.append(None)
                data.append(row_data)
                
    return data

try:
    data = parse_xlsx('Прайс-лист от 17.06.2026.xlsx')
    filtered = []
    # Print the first few rows to see headers
    print("Headers / First 3 rows:")
    for row in data[:3]:
        print([str(x) for x in row if x])
        
    for row in data:
        row_str = ' '.join([str(x).lower() for x in row if x])
        if 'кондиционер' in row_str or 'сплит' in row_str or 'almacom' in row_str or 'btu' in row_str or 'acron' in row_str:
            filtered.append(row)

    print("\nFound items:")
    for item in filtered[:20]:
        print([str(x) for x in item if x])
        
except Exception as e:
    print("Error:", e)
