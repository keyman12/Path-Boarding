"""add_sumsub_fields_to_boarding_contact

Revision ID: e7a0534f62b1
Revises: a73b9b98b5fb
Create Date: 2026-02-09 18:59:22.077955

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7a0534f62b1'
down_revision: Union[str, None] = 'a73b9b98b5fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add SumSub tracking fields
    op.add_column('boarding_contact', sa.Column('sumsub_applicant_id', sa.String(length=255), nullable=True))
    op.add_column('boarding_contact', sa.Column('sumsub_verification_status', sa.String(length=50), nullable=True))


def downgrade() -> None:
    # Remove SumSub tracking fields
    op.drop_column('boarding_contact', 'sumsub_verification_status')
    op.drop_column('boarding_contact', 'sumsub_applicant_id')
