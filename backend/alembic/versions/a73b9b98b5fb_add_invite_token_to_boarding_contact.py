"""Add invite_token to boarding_contact

Revision ID: a73b9b98b5fb
Revises: 67de2546b88e
Create Date: 2026-02-09 16:16:53.062266

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a73b9b98b5fb'
down_revision: Union[str, None] = '67de2546b88e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add invite_token to store original invite link for user to resume later
    op.add_column('boarding_contact', sa.Column('invite_token', sa.String(length=255), nullable=True))


def downgrade() -> None:
    # Remove invite_token column
    op.drop_column('boarding_contact', 'invite_token')
