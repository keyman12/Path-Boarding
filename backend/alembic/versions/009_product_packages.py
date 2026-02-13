"""Create product_packages and product_package_items tables

Revision ID: 009
Revises: 008_product_catalog
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '009_product_packages'
down_revision: Union[str, None] = '008_product_catalog'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_packages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('partner_id', sa.String(36), sa.ForeignKey('partners.id'), nullable=False, index=True),
        sa.Column('uid', sa.String(64), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(2048), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index('ix_product_packages_partner_uid', 'product_packages', ['partner_id', 'uid'], unique=True)

    op.create_table(
        'product_package_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('package_id', sa.String(36), sa.ForeignKey('product_packages.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('catalog_product_id', sa.String(36), sa.ForeignKey('product_catalog.id'), nullable=False, index=True),
        sa.Column('config', JSONB, nullable=True),
        sa.Column('sort_order', sa.Integer(), default=0, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('product_package_items')
    op.drop_index('ix_product_packages_partner_uid', table_name='product_packages')
    op.drop_table('product_packages')
