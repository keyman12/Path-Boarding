"""Add bank details fields to boarding_contact (step6)

Revision ID: 013
Revises: 012_fee_schedules
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '013_bank_details'
down_revision: Union[str, None] = '012_fee_schedules'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boarding_contact', sa.Column('bank_currency', sa.String(8), nullable=True))
    op.add_column('boarding_contact', sa.Column('bank_country', sa.String(64), nullable=True))
    op.add_column('boarding_contact', sa.Column('bank_sort_code', sa.String(16), nullable=True))
    op.add_column('boarding_contact', sa.Column('bank_account_number', sa.String(16), nullable=True))


def downgrade() -> None:
    op.drop_column('boarding_contact', 'bank_account_number')
    op.drop_column('boarding_contact', 'bank_sort_code')
    op.drop_column('boarding_contact', 'bank_country')
    op.drop_column('boarding_contact', 'bank_currency')
