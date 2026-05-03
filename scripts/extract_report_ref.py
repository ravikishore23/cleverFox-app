from pathlib import Path
import PyPDF2
pdf_path = Path(r"c:\Users\ravik\for-project-rev\BATCH ONE PROJECT REPORT.pdf")
text_out = Path(r"c:\Users\ravik\cleverFox-app\report_reference.txt")
reader = PyPDF2.PdfReader(str(pdf_path))
parts = []
for i, page in enumerate(reader.pages):
    try:
        parts.append(f"\n--- PAGE {i+1} ---\n")
        parts.append(page.extract_text() or "")
    except Exception as e:
        parts.append(f"\n--- PAGE {i+1} (error) ---\n{e}\n")
text_out.write_text("\n".join(parts), encoding="utf-8")
print(f"Extracted {len(reader.pages)} pages to {text_out}")
