import re
from rank_bm25 import BM25Plus
from .config import CHUNK_SIZE, CHUNK_OVERLAP, RETRIEVAL_K, CONTEXT_CHARS


def tokenize(text: str) -> list[str]:
    return re.findall(r'\w+', text.lower())


def chunk_pages(pages: list[dict], size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[dict]:
    if not 0 <= overlap < size:
        raise ValueError('Chunk overlap must be smaller than size.')
    return [{'page': p['page'], 'text': text[start:start + size]}
            for p in pages if (text := ' '.join(p['text'].split()))
            for start in range(0, len(text), size - overlap)]


def top_k(chunks: list[dict], question: str, k: int = RETRIEVAL_K) -> list[dict]:
    if not chunks:
        return []
    tokens = tokenize(question)
    corpus = [tokenize(c['text']) for c in chunks]
    if not any(corpus):
        return []
    scores = BM25Plus(corpus).get_scores(tokens)
    # BM25Plus avoids zero/negative scores on very small lesson corpora.
    eligible = [i for i, terms in enumerate(corpus) if set(tokens).intersection(terms)]
    return [chunks[i] for i in sorted(eligible, key=lambda i: scores[i], reverse=True)[:k]]


def sample_chunks(chunks: list[dict], count: int) -> list[dict]:
    if len(chunks) <= count:
        return chunks
    return [chunks[round(i * (len(chunks) - 1) / (count - 1))] for i in range(count)] if count > 1 else chunks[:1]


def material_chunks(chunks: list[dict], limit: int = CONTEXT_CHARS) -> list[dict]:
    if sum(len(c['text']) + 100 for c in chunks) <= limit:
        return chunks
    return sample_chunks(chunks, max(1, limit // (CHUNK_SIZE + 100)))


def sources_for(chunks: list[dict]) -> list[dict]:
    return [{'id': f'S{i + 1}', 'file': c['filename'], 'page': c['page'], 'excerpt': c['text'],
             'document_id': c['document_id']} for i, c in enumerate(chunks)]


def source_text(sources: list[dict]) -> str:
    return '\n\n'.join(f"[{s['id']}] {s['file']} (location {s['page']}): {s['excerpt']}" for s in sources)
