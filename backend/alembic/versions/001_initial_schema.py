"""Initial schema: partners, merchants, boarding_events, invites, merchant_users, verification_codes, audit_log.

Revision ID: 001
Revises:
Create Date: 2025-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "partners",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("external_id", sa.String(255), nullable=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_partners_email", "partners", ["email"], unique=True)
    op.create_index("ix_partners_external_id", "partners", ["external_id"], unique=True)

    op.create_table(
        "merchants",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("partner_id", sa.String(36), nullable=False),
        sa.Column("legal_name", sa.String(255), nullable=True),
        sa.Column("trading_name", sa.String(255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
    )
    op.create_index("ix_merchants_partner_id", "merchants", ["partner_id"])

    op.create_table(
        "boarding_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("partner_id", sa.String(36), nullable=False),
        sa.Column("merchant_id", sa.String(36), nullable=True),
        sa.Column(
            "status",
            sa.Enum("draft", "in_progress", "pending_kyc", "pending_review", "completed", "rejected", name="boardingstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("current_step", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
    )
    op.create_index("ix_boarding_events_partner_id", "boarding_events", ["partner_id"])
    op.create_index("ix_boarding_events_merchant_id", "boarding_events", ["merchant_id"])
    op.create_index("ix_boarding_events_status", "boarding_events", ["status"])

    op.create_table(
        "invites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("partner_id", sa.String(36), nullable=False),
        sa.Column("boarding_event_id", sa.String(36), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.ForeignKeyConstraint(["partner_id"], ["partners.id"]),
        sa.ForeignKeyConstraint(["boarding_event_id"], ["boarding_events.id"]),
    )
    op.create_index("ix_invites_token", "invites", ["token"], unique=True)
    op.create_index("ix_invites_partner_id", "invites", ["partner_id"])
    op.create_index("ix_invites_boarding_event_id", "invites", ["boarding_event_id"])

    op.create_table(
        "merchant_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("merchant_id", sa.String(36), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["merchant_id"], ["merchants.id"]),
    )
    op.create_index("ix_merchant_users_email", "merchant_users", ["email"], unique=True)
    op.create_index("ix_merchant_users_merchant_id", "merchant_users", ["merchant_id"])

    op.create_table(
        "verification_codes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("channel", sa.String(20), nullable=False),
        sa.Column("contact", sa.String(255), nullable=False),
        sa.Column("code", sa.String(10), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_verification_codes_contact", "verification_codes", ["contact"])

    op.create_table(
        "audit_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("actor_type", sa.String(50), nullable=True),
        sa.Column("actor_id", sa.String(36), nullable=True),
        sa.Column("resource_type", sa.String(50), nullable=True),
        sa.Column("resource_id", sa.String(36), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_audit_log_action", "audit_log", ["action"])
    op.create_index("ix_audit_log_actor_id", "audit_log", ["actor_id"])
    op.create_index("ix_audit_log_resource_id", "audit_log", ["resource_id"])


def downgrade() -> None:
    op.drop_table("audit_log")
    op.drop_table("verification_codes")
    op.drop_table("merchant_users")
    op.drop_table("invites")
    op.drop_table("boarding_events")
    op.drop_table("merchants")
    op.drop_table("partners")
    op.execute("DROP TYPE IF EXISTS boardingstatus")
