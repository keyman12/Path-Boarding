"""Add fee config to PaybyLink and QR code (Virtual Terminal)

Revision ID: 011
Revises: 010_invite_product_package
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op


revision: str = '011_ecomm_fee_fields'
down_revision: Union[str, None] = '010_invite_product_package'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import text
    conn = op.get_bind()
    conn.execute(text(
        "UPDATE product_catalog SET name = 'QR code generation', config_schema = '{\"min_amount\": 0.2}'::jsonb "
        "WHERE product_code = 'virtual_terminal'"
    ))
    conn.execute(text(
        "UPDATE product_catalog SET config_schema = '{\"min_amount\": 0.2}'::jsonb "
        "WHERE product_code = 'payby_link'"
    ))


def downgrade() -> None:
    from sqlalchemy import text
    conn = op.get_bind()
    conn.execute(text(
        "UPDATE product_catalog SET name = 'Virtual Terminal', config_schema = '{}'::jsonb "
        "WHERE product_code = 'virtual_terminal'"
    ))
    conn.execute(text(
        "UPDATE product_catalog SET config_schema = '{}'::jsonb "
        "WHERE product_code = 'payby_link'"
    ))
