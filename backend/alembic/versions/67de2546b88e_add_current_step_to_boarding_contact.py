"""Add current_step to boarding_contact

Revision ID: 67de2546b88e
Revises: 005
Create Date: 2026-02-09 16:06:50.981576

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '67de2546b88e'
down_revision: Union[str, None] = '005'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add current_step column to track user progress in boarding flow
    op.add_column('boarding_contact', sa.Column('current_step', sa.String(length=20), nullable=True))


def downgrade() -> None:
    # Remove current_step column
    op.drop_column('boarding_contact', 'current_step')
