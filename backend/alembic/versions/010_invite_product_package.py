"""Add product_package_id to invites, create invite_device_details

Revision ID: 010
Revises: 009_product_packages
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '010_invite_product_package'
down_revision: Union[str, None] = '009_product_packages'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'invites',
        sa.Column('product_package_id', sa.String(36), sa.ForeignKey('product_packages.id', ondelete='SET NULL'), nullable=True, index=True)
    )

    op.create_table(
        'invite_device_details',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('invite_id', sa.String(36), sa.ForeignKey('invites.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('package_item_id', sa.String(36), sa.ForeignKey('product_package_items.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('store_name', sa.String(255), nullable=True),
        sa.Column('store_address', sa.String(1024), nullable=True),
        sa.Column('epos_terminal', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('invite_device_details')
    op.drop_column('invites', 'product_package_id')
