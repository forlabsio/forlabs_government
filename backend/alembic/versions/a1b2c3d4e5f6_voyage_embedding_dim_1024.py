"""voyage_embedding_dim_1024

Revision ID: a1b2c3d4e5f6
Revises: 68c1711d9f2f
Create Date: 2026-03-16 00:00:00.000000

Switch embedding provider from OpenAI text-embedding-3-small (1536 dims)
to Voyage AI voyage-multilingual-2 (1024 dims).

Existing embeddings are dropped and must be re-generated.
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '68c1711d9f2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            -- Drop old 1536-dim columns
            ALTER TABLE grant_projects DROP COLUMN IF EXISTS content_embedding;
            ALTER TABLE users DROP COLUMN IF EXISTS profile_embedding;

            -- Re-create at 1024 dims (voyage-multilingual-2)
            ALTER TABLE grant_projects ADD COLUMN content_embedding vector(1024);
            ALTER TABLE users ADD COLUMN profile_embedding vector(1024);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Embedding column resize skipped (pgvector unavailable): %', SQLERRM;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE grant_projects DROP COLUMN IF EXISTS content_embedding;
            ALTER TABLE users DROP COLUMN IF EXISTS profile_embedding;

            ALTER TABLE grant_projects ADD COLUMN content_embedding vector(1536);
            ALTER TABLE users ADD COLUMN profile_embedding vector(1536);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Embedding column downgrade skipped: %', SQLERRM;
        END
        $$;
    """)
