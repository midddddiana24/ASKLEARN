from pathlib import Path
from zipfile import ZipFile
from pypdf import PdfReader
from docx import Document
from pptx import Presentation
from .config import MAX_TEXT_CHARS

ALLOWED = {'.pdf', '.docx', '.pptx', '.txt', '.md'}


def extract_pages(path: Path) -> list[dict]:
    ext = path.suffix.lower()
    if ext not in ALLOWED:
        raise ValueError('Unsupported file type. Use PDF, DOCX, PPTX, TXT or MD.')
    try:
        if ext in {'.docx', '.pptx'}:
            with ZipFile(path) as archive:
                if sum(i.file_size for i in archive.infolist()) > 50 * 1024 * 1024:
                    raise ValueError('The expanded document is too large (maximum 50 MB).')
        if ext == '.pdf':
            reader = PdfReader(path)
            if reader.is_encrypted:
                raise ValueError('This PDF is password protected. Upload an unlocked copy.')
            if len(reader.pages) > 500:
                raise ValueError('Use a document with no more than 500 pages.')
            pages = []
            total = 0
            for number, page in enumerate(reader.pages, 1):
                text = page.extract_text() or ''
                total += len(text)
                if total > MAX_TEXT_CHARS:
                    raise ValueError(f'Too much text. Maximum {MAX_TEXT_CHARS:,} characters per file.')
                pages.append({'page': number, 'text': text})
        elif ext == '.docx':
            doc = Document(path)
            text = '\n'.join([p.text for p in doc.paragraphs] +
                             [' | '.join(c.text for c in row.cells) for table in doc.tables for row in table.rows])
            pages = [{'page': 1, 'text': text}]
        elif ext == '.pptx':
            prs = Presentation(path)
            pages = [{'page': i, 'text': '\n'.join(
                [s.text_frame.text for s in slide.shapes if s.has_text_frame] +
                [' | '.join(c.text for c in row.cells) for s in slide.shapes if s.has_table for row in s.table.rows]
            )} for i, slide in enumerate(prs.slides, 1)]
        else:
            pages = [{'page': 1, 'text': path.read_text(encoding='utf-8-sig')}]
    except (ValueError, UnicodeError) as exc:
        if isinstance(exc, UnicodeError):
            raise ValueError('Save text files as UTF-8 and upload again.') from exc
        raise
    except Exception as exc:
        raise ValueError('This file could not be read. It may be damaged or incorrectly named.') from exc
    length = sum(len(p['text']) for p in pages)
    if length > MAX_TEXT_CHARS:
        raise ValueError(f'Too much text. Maximum {MAX_TEXT_CHARS:,} characters per file.')
    if sum(len(p['text'].strip()) for p in pages) < 50:
        raise ValueError('No readable text found. Scanned PDFs and images need OCR, which is not supported.')
    return pages
