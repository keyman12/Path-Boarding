"""Add company fields to boarding_contact for agreement PDF

Revision ID: 016
Revises: 015_merchant_agreement_pdf
Create Date: 2026-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = '016_company_fields'
down_revision: Union[str, None] = '015_merchant_agreement_pdf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('boarding_contact', sa.Column('company_name', sa.String(255), nullable=True))
    op.add_column('boarding_contact', sa.Column('company_number', sa.String(32), nullable=True))
    op.add_column('boarding_contact', sa.Column('company_registered_office', sa.String(512), nullable=True))
    op.add_column('boarding_contact', sa.Column('company_incorporated_in', sa.String(64), nullable=True))
    op.add_column('boarding_contact', sa.Column('company_incorporation_date', sa.String(32), nullable=True))
    op.add_column('boarding_contact', sa.Column('company_industry_sic', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('boarding_contact', 'company_industry_sic')
    op.drop_column('boarding_contact', 'company_incorporation_date')
    op.drop_column('boarding_contact', 'company_incorporated_in')
    op.drop_column('boarding_contact', 'company_registered_office')
    op.drop_column('boarding_contact', 'company_number')
    op.drop_column('boarding_contact', 'company_name')
