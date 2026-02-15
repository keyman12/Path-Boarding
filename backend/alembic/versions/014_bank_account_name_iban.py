"""Add bank_account_name and bank_iban to boarding_contact

Revision ID: 014
Revises: 013_bank_details
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '014_bank_account_name_iban'
down_revision: Union[str, None] = '013_bank_details'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boarding_contact', sa.Column('bank_account_name', sa.String(255), nullable=True))
    op.add_column('boarding_contact', sa.Column('bank_iban', sa.String(34), nullable=True))


def downgrade() -> None:
    op.drop_column('boarding_contact', 'bank_iban')
    op.drop_column('boarding_contact', 'bank_account_name')
