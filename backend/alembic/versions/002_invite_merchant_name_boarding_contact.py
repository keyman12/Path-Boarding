"""Add merchant_name to invites, logo_url to partners, boarding_contact table.

Revision ID: 002
Revises: 001
Create Date: 2025-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "002"
down_revision: Union[str, None] = "001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("partners", sa.Column("logo_url", sa.String(512), nullable=True))
    op.add_column("invites", sa.Column("merchant_name", sa.String(255), nullable=True))

    op.create_table(
        "boarding_contact",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("boarding_event_id", sa.String(36), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["boarding_event_id"], ["boarding_events.id"]),
    )
    op.create_index("ix_boarding_contact_boarding_event_id", "boarding_contact", ["boarding_event_id"], unique=True)


def downgrade() -> None:
    op.drop_table("boarding_contact")
    op.drop_column("invites", "merchant_name")
    op.drop_column("partners", "logo_url")
