"""
Batch embedding generator for active grants.
Run after adding Voyage AI payment method.

Usage: python scripts/generate_embeddings.py
"""
import asyncio
import asyncpg
import voyageai
import time
from supabase import create_client

RAILWAY_URL = 'postgresql://postgres:RgvWTMOPELXjpsglwpkbYbfXnyDThFFI@turntable.proxy.rlwy.net:18690/railway'
SUPABASE_URL = 'https://iynrfhwrbpqpfgcmkxtu.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnJmaHdyYnBxcGZnY21reHR1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzU4ODYyMywiZXhwIjoyMDg5MTY0NjIzfQ.TWtRrmG4kP7Ry5xM74yQ17zCrUJ5nCppXDgvalfZqA0'
VOYAGE_KEY = 'pa-R27-BJep-eLrR2n2qc7b719XIRO1K2pkXuy9D_Bpr-7'

VOYAGE_BATCH = 32
RPC_BATCH = 100

def make_text(r):
    parts = [r['title']]
    if r['summary']:      parts.append(r['summary'])
    if r['category']:     parts.append(f'카테고리: {r["category"]}')
    if r['organization']: parts.append(f'기관: {r["organization"]}')
    return ' '.join(parts)[:8000]

async def main():
    conn = await asyncpg.connect(RAILWAY_URL)
    sb   = create_client(SUPABASE_URL, SUPABASE_KEY)
    vc   = voyageai.AsyncClient(api_key=VOYAGE_KEY)

    # 접수중 + 공고중만 대상 (마감/진행중 제외)
    rows = await conn.fetch("""
        SELECT id, title, summary, category, organization
        FROM grant_projects
        WHERE status IN ('접수중', '공고중')
        ORDER BY created_at DESC
    """)
    total = len(rows)
    print(f'임베딩 대상: {total}건 (접수중/공고중)')

    id_emb_pairs = []
    t0 = time.time()

    for i in range(0, total, VOYAGE_BATCH):
        batch = rows[i:i+VOYAGE_BATCH]
        texts = [make_text(r) for r in batch]
        result = await vc.embed(texts, model='voyage-multilingual-2', input_type='document')
        for j, r in enumerate(batch):
            emb_str = '[' + ','.join(f'{x:.7f}' for x in result.embeddings[j]) + ']'
            id_emb_pairs.append({'id': str(r['id']), 'embedding': emb_str})

        done = min(i + VOYAGE_BATCH, total)
        elapsed = time.time() - t0
        rate = done / elapsed if elapsed > 0 else 0
        eta = (total - done) / rate if rate > 0 else 0
        print(f'  임베딩 {done}/{total}  ({rate:.0f}건/s, ETA {eta:.0f}s)', end='\r')

    print(f'\n임베딩 생성 완료 ({time.time()-t0:.1f}s). Supabase 업데이트 중...')

    t1 = time.time()
    updated = 0
    for i in range(0, len(id_emb_pairs), RPC_BATCH):
        batch = id_emb_pairs[i:i+RPC_BATCH]
        sb.rpc('bulk_update_grant_embeddings', {'updates': batch}).execute()
        updated += len(batch)
        print(f'  DB 업데이트 {updated}/{total}', end='\r')

    print(f'\nDB 업데이트 완료 ({time.time()-t1:.1f}s)')

    check = sb.table('grant_projects').select('id', count='exact').not_.is_('content_embedding', 'null').execute()
    print(f'\n✅ 완료! 임베딩 있는 레코드: {check.count}건')
    await conn.close()

if __name__ == '__main__':
    asyncio.run(main())
