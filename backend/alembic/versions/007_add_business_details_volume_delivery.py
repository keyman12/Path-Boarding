"""Add estimated monthly card volume, average transaction value, delivery timeframe

Revision ID: 007
Revises: 006_step5_business_details
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '007_business_volume_delivery'
down_revision: Union[str, None] = '006_step5_business_details'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boarding_contact', sa.Column('estimated_monthly_card_volume', sa.String(64), nullable=True))
    op.add_column('boarding_contact', sa.Column('average_transaction_value', sa.String(64), nullable=True))
    op.add_column('boarding_contact', sa.Column('delivery_timeframe', sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column('boarding_contact', 'delivery_timeframe')
    op.drop_column('boarding_contact', 'average_transaction_value')
    op.drop_column('boarding_contact', 'estimated_monthly_card_volume')
