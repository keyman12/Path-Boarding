"""Add TrueLayer bank verification fields to boarding_contact

Revision ID: 020_truelayer
Revises: 019_signed_agreement
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "020_truelayer"
down_revision: Union[str, None] = "019_signed_agreement"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_verified_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_account_match", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_account_name_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_director_score", sa.Integer(), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_account_holder_names", sa.String(512), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_verification_message", sa.String(512), nullable=True),
    )
    op.add_column(
        "boarding_contact",
        sa.Column("truelayer_verified", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("boarding_contact", "truelayer_verified")
    op.drop_column("boarding_contact", "truelayer_verification_message")
    op.drop_column("boarding_contact", "truelayer_account_holder_names")
    op.drop_column("boarding_contact", "truelayer_director_score")
    op.drop_column("boarding_contact", "truelayer_account_name_score")
    op.drop_column("boarding_contact", "truelayer_account_match")
    op.drop_column("boarding_contact", "truelayer_verified_at")
