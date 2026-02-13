"""Create product_catalog table and seed initial products

Revision ID: 008
Revises: 007_business_volume_delivery
Create Date: 2026-01-30

"""
import uuid
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '008_product_catalog'
down_revision: Union[str, None] = '007_business_volume_delivery'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'product_catalog',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_type', sa.String(32), nullable=False, index=True),
        sa.Column('product_code', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('config_schema', JSONB, nullable=True),
        sa.Column('requires_store_epos', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    # Seed initial products (only if empty)
    conn = op.get_bind()
    existing = conn.execute(sa.text("SELECT 1 FROM product_catalog LIMIT 1")).fetchone()
    if existing is not None:
        return
    products = [
        # Physical POS
        (str(uuid.uuid4()), 'physical_pos', 'pax_a920_pro', 'PAX A920 Pro', '{"requires_store_epos": true}', True),
        (str(uuid.uuid4()), 'physical_pos', 'verifone_p400', 'Verifone P400', '{"requires_store_epos": true}', True),
        (str(uuid.uuid4()), 'physical_pos', 'softpos', 'SoftPOS', '{"requires_store_epos": true, "can_standalone": true}', True),
        # Ecommerce
        (str(uuid.uuid4()), 'ecomm', 'payby_link', 'PaybyLink', '{}', False),
        (str(uuid.uuid4()), 'ecomm', 'virtual_terminal', 'Virtual Terminal', '{}', False),
        # Acquiring
        (str(uuid.uuid4()), 'acquiring', 'debit', 'Debit', '{"min_pct": 0.8}', False),
        (str(uuid.uuid4()), 'acquiring', 'credit', 'Credit', '{"min_pct": 1.3}', False),
        (str(uuid.uuid4()), 'acquiring', 'premium', 'Premium', '{"min_pct": 0.5}', False),
        (str(uuid.uuid4()), 'acquiring', 'cross_border', 'Cross Border', '{"min_pct": 0.6}', False),
        (str(uuid.uuid4()), 'acquiring', 'cnp', 'CNP', '{"min_pct": 0.4}', False),
        # Other fees
        (str(uuid.uuid4()), 'other_fee', 'auth_fee', 'Authorisation Fee', '{"min_amount": 0.01}', False),
        (str(uuid.uuid4()), 'other_fee', 'refund_fee', 'Refund Fee', '{"min_amount": 0.05}', False),
        (str(uuid.uuid4()), 'other_fee', 'three_d_secure_fee', '3D Secure Fee', '{"min_amount": 0.03}', False),
    ]
    for p in products:
        conn.execute(
            sa.text(
                "INSERT INTO product_catalog (id, product_type, product_code, name, config_schema, requires_store_epos) "
                "VALUES (:id, :pt, :pc, :n, CAST(:cs AS jsonb), :rse)"
            ),
            {"id": p[0], "pt": p[1], "pc": p[2], "n": p[3], "cs": p[4], "rse": p[5]}
        )


def downgrade() -> None:
    op.drop_table('product_catalog')
