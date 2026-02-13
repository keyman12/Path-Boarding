"""Add fee_schedules table and partner.fee_schedule_id

Revision ID: 012
Revises: 011_ecomm_fee_fields
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB


revision: str = '012_fee_schedules'
down_revision: Union[str, None] = '011_ecomm_fee_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_RATES = {
    "pax_a920_pro": {"min_per_month": 20, "min_per_device": 250, "min_service": 5},
    "verifone_p400": {"min_per_month": 20, "min_per_device": 250, "min_service": 5},
    "softpos": {"min_per_month": 10},
    "payby_link": {"min_amount": 0.2},
    "virtual_terminal": {"min_amount": 0.2},
    "debit": {"min_pct": 0.8},
    "credit": {"min_pct": 1.3},
    "premium": {"min_pct": 0.5},
    "cross_border": {"min_pct": 0.6},
    "cnp": {"min_pct": 0.4},
    "auth_fee": {"min_amount": 0.01},
    "refund_fee": {"min_amount": 0.05},
    "three_d_secure_fee": {"min_amount": 0.03},
}


def upgrade() -> None:
    op.create_table(
        'fee_schedules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('rates', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )

    op.add_column(
        'partners',
        sa.Column('fee_schedule_id', sa.String(36), sa.ForeignKey('fee_schedules.id', ondelete='RESTRICT'), nullable=True, index=True)
    )

    conn = op.get_bind()
    from sqlalchemy import text
    import json
    import uuid

    default_id = str(uuid.uuid4())
    rates_json = json.dumps(DEFAULT_RATES)
    conn.execute(
        text("INSERT INTO fee_schedules (id, name, rates) VALUES (:id, :name, CAST(:rates AS jsonb))"),
        {"id": default_id, "name": "Default", "rates": rates_json}
    )
    conn.execute(
        text("UPDATE partners SET fee_schedule_id = :sid"),
        {"sid": default_id}
    )

    op.alter_column(
        'partners',
        'fee_schedule_id',
        existing_type=sa.String(36),
        nullable=False
    )


def downgrade() -> None:
    op.drop_column('partners', 'fee_schedule_id')
    op.drop_table('fee_schedules')
