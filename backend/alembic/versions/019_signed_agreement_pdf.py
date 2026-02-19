"""Add signed_agreement_pdf_path to merchants

Revision ID: 019
Revises: 018_docusign
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "019_signed_agreement"
down_revision: Union[str, None] = "018_docusign"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "merchants",
        sa.Column("signed_agreement_pdf_path", sa.String(512), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("merchants", "signed_agreement_pdf_path")
