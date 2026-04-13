
def check_braces(filepath):
    with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
        level = 0
        brackets = 0
        parens = 0
        for i, line in enumerate(f, 1):
            # Ignore comments
            clean_line = line.split('//')[0].split('/*')[0]
            
            level += (clean_line.count('{') - clean_line.count('}'))
            brackets += (clean_line.count('[') - clean_line.count(']'))
            parens += (clean_line.count('(') - clean_line.count(')'))
            
            if parens != 0 or level != 0 or brackets != 0:
                pass # Just tracking
            
        print(f"Final levels - Braces: {level}, Brackets: {brackets}, Parens: {parens}")

        # Second pass to find where it breaks
        f.seek(0)
        p = 0
        for i, line in enumerate(f, 1):
            clean_line = line.split('//')[0]
            p += (clean_line.count('(') - clean_line.count(')'))
            if p > 0: # This is normal, but if it stays high...
                pass
        
        # Let's just find the last line that has more ( than )
        f.seek(0)
        p = 0
        last_imbalance_line = 0
        for i, line in enumerate(f, 1):
            clean_line = line.split('//')[0]
            diff = clean_line.count('(') - clean_line.count(')')
            if diff > 0:
                last_imbalance_line = i
                # print(f"Line {i} adds {diff} parens. Total: {p+diff}")
            p += diff
        
        print(f"Total parens at end: {p}")

check_braces(r'c:\Users\USUARIO\AppData\Local\FoundryVTT\Data\modules\got-character-sheet\scripts\got-sheet.js')
