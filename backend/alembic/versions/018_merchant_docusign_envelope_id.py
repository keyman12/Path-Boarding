"""Add docusign_envelope_id to merchants

Revision ID: 018
Revises: 017_partner_merchant_support
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "018_docusign"
down_revision: Union[str, None] = "017_partner_merchant_support"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column("docusign_envelope_id", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("merchants", "docusign_envelope_id")
