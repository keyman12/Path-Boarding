"""Add agreement_pdf_path to merchants

Revision ID: 015
Revises: 014_bank_account_name_iban
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '015_merchant_agreement_pdf'
down_revision: Union[str, None] = '014_bank_account_name_iban'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('merchants', sa.Column('agreement_pdf_path', sa.String(512), nullable=True))


def downgrade() -> None:
    op.drop_column('merchants', 'agreement_pdf_path')
