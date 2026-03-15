"""add_pgvector_embeddings

Revision ID: 68c1711d9f2f
Revises: 251ceaa6f0dd
Create Date: 2026-03-15 11:29:44.961395

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '68c1711d9f2f'
down_revision: Union[str, Sequence[str], None] = '251ceaa6f0dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Try to enable pgvector; skip gracefully if not available on this Postgres instance
    op.execute("""
        DO $$
        BEGIN
            CREATE EXTENSION IF NOT EXISTS vector;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'pgvector not available, skipping: %', SQLERRM;
        END
        $$;
    """)

    # Add embedding columns only if vector extension is available
    op.execute("""
        DO $$
        BEGIN
            ALTER TABLE grant_projects ADD COLUMN IF NOT EXISTS content_embedding vector(1536);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_embedding vector(1536);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping embedding columns (pgvector unavailable): %', SQLERRM;
        END
        $$;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE grant_projects DROP COLUMN IF EXISTS content_embedding")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS profile_embedding")
