"""Add admin_users table. Initial Admin user is created on app startup if none exist.

Revision ID: 003
Revises: 002
Create Date: 2025-01-30

Initial admin (created by app startup): username Admin, password keywee50.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "admin_users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("username", sa.String(100), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_admin_users_username", "admin_users", ["username"], unique=True)


def downgrade() -> None:
    op.drop_table("admin_users")
