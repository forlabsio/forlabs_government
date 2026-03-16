"""add_user_revenue_krw_certifications

Revision ID: f7e3a9b2c1d5
Revises: 3e9f2a1b0c8d
Create Date: 2026-03-17 01:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import ARRAY


revision: str = 'f7e3a9b2c1d5'
down_revision: Union[str, Sequence[str], None] = '3e9f2a1b0c8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('revenue_krw', sa.BigInteger(), nullable=True))
    op.add_column('users', sa.Column('certifications', ARRAY(sa.String()), nullable=False, server_default='{}'))


def downgrade() -> None:
    op.drop_column('users', 'certifications')
    op.drop_column('users', 'revenue_krw')
