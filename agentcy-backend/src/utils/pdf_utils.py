# src/utils/pdf_utils.py
import fitz  # pip install pymupdf

def extract_text_chunks_from_pdf(filepath, chunk_size=1000):
    doc = fitz.open(filepath)
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    chunks = [full_text[i:i+chunk_size] for i in range(0, len(full_text), chunk_size)]
    return chunks
