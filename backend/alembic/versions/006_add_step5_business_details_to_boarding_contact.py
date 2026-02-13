"""Add step5 business details columns to boarding_contact

Revision ID: 006
Revises: e7a0534f62b1
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '006_step5_business_details'
down_revision: Union[str, None] = 'e7a0534f62b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boarding_contact', sa.Column('vat_number', sa.String(32), nullable=True))
    op.add_column('boarding_contact', sa.Column('customer_industry', sa.String(32), nullable=True))
    op.add_column('boarding_contact', sa.Column('customer_support_email', sa.String(255), nullable=True))
    op.add_column('boarding_contact', sa.Column('customer_websites', sa.String(1024), nullable=True))
    op.add_column('boarding_contact', sa.Column('product_description', sa.String(4096), nullable=True))


def downgrade() -> None:
    op.drop_column('boarding_contact', 'product_description')
    op.drop_column('boarding_contact', 'customer_websites')
    op.drop_column('boarding_contact', 'customer_support_email')
    op.drop_column('boarding_contact', 'customer_industry')
    op.drop_column('boarding_contact', 'vat_number')
