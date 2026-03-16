"""add_user_corp_venture_flags

Revision ID: 3e9f2a1b0c8d
Revises: dd1fe7280ead
Create Date: 2026-03-16 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e9f2a1b0c8d'
down_revision: Union[str, Sequence[str], None] = 'dd1fe7280ead'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('users', sa.Column('is_corporate', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('is_venture', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_venture')
    op.drop_column('users', 'is_corporate')
