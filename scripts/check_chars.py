
import string

def check_special_chars(filepath):
    with open(filepath, 'rb') as f:
        content = f.read()
        for i, b in enumerate(content):
            if b < 32 and b not in [9, 10, 13]: # Not tab, LF, or CR
                print(f"Found suspicious byte {b} at index {i}")
            # Check for non-standard UTF-8 sequences if I could, but let's just check for NUL
            if b == 0:
                print(f"Found NUL byte at index {i}")

check_special_chars(r'c:\Users\USUARIO\AppData\Local\FoundryVTT\Data\modules\got-character-sheet\scripts\got-sheet.js')
