"""Add merchant support email and phone to partners

Revision ID: 017
Revises: 016_company_fields
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '017_partner_merchant_support'
down_revision: Union[str, None] = '016_company_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('partners', sa.Column('merchant_support_email', sa.String(255), nullable=True))
    op.add_column('partners', sa.Column('merchant_support_phone', sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column('partners', 'merchant_support_phone')
    op.drop_column('partners', 'merchant_support_email')
