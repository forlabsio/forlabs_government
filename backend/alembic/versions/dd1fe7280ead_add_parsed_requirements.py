"""add_parsed_requirements

Revision ID: dd1fe7280ead
Revises: a1b2c3d4e5f6
Create Date: 2026-03-16 15:25:07.432918

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


# revision identifiers, used by Alembic.
revision: str = 'dd1fe7280ead'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('grant_projects', sa.Column('parsed_requirements', JSONB(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('grant_projects', 'parsed_requirements')
