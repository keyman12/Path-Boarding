"""Add personal details columns to boarding_contact (step 2).

Revision ID: 005
Revises: 004
Create Date: 2025-01-30

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("boarding_contact", sa.Column("legal_first_name", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("legal_last_name", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("date_of_birth", sa.String(10), nullable=True))
    op.add_column("boarding_contact", sa.Column("address_country", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("address_postcode", sa.String(20), nullable=True))
    op.add_column("boarding_contact", sa.Column("address_line1", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("address_line2", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("address_town", sa.String(255), nullable=True))
    op.add_column("boarding_contact", sa.Column("phone_country_code", sa.String(10), nullable=True))
    op.add_column("boarding_contact", sa.Column("phone_number", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("boarding_contact", "phone_number")
    op.drop_column("boarding_contact", "phone_country_code")
    op.drop_column("boarding_contact", "address_town")
    op.drop_column("boarding_contact", "address_line2")
    op.drop_column("boarding_contact", "address_line1")
    op.drop_column("boarding_contact", "address_postcode")
    op.drop_column("boarding_contact", "address_country")
    op.drop_column("boarding_contact", "date_of_birth")
    op.drop_column("boarding_contact", "legal_last_name")
    op.drop_column("boarding_contact", "legal_first_name")
