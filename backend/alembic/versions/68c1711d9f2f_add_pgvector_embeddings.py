"""add_pgvector_embeddings

Revision ID: 68c1711d9f2f
Revises: 251ceaa6f0dd
Create Date: 2026-03-15 11:29:44.961395

"""
from typing import Sequence, Union

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '68c1711d9f2f'
down_revision: Union[str, Sequence[str], None] = '251ceaa6f0dd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")
    op.add_column('grant_projects',
        sa.Column('content_embedding', pgvector.sqlalchemy.Vector(1536), nullable=True))
    op.add_column('users',
        sa.Column('profile_embedding', pgvector.sqlalchemy.Vector(1536), nullable=True))


def downgrade() -> None:
    op.drop_column('grant_projects', 'content_embedding')
    op.drop_column('users', 'profile_embedding')
