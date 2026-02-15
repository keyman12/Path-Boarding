from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class BoardingContact(Base):
    __tablename__ = "boarding_contact"

    id = Column(String(36), primary_key=True, index=True)
    boarding_event_id = Column(
        String(36), ForeignKey("boarding_events.id"), nullable=False, index=True, unique=True
    )
    email = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    email_verified_at = Column(DateTime(timezone=True), nullable=True)
    current_step = Column(String(20), nullable=True, default="form")  # Tracks user progress: form, verify, step2, step3, done
    invite_token = Column(String(255), nullable=True)  # Store invite token so user can resume later
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    # Step 2 personal details
    legal_first_name = Column(String(255), nullable=True)
    legal_last_name = Column(String(255), nullable=True)
    date_of_birth = Column(String(10), nullable=True)
    address_country = Column(String(255), nullable=True)
    address_postcode = Column(String(20), nullable=True)
    address_line1 = Column(String(255), nullable=True)
    address_line2 = Column(String(255), nullable=True)
    address_town = Column(String(255), nullable=True)
    phone_country_code = Column(String(10), nullable=True)
    phone_number = Column(String(32), nullable=True)
    # Step 3 identity verification (SumSub)
    sumsub_applicant_id = Column(String(255), nullable=True)  # SumSub applicant ID
    sumsub_verification_status = Column(String(50), nullable=True)  # pending, completed, rejected
    # Step 5 business details
    vat_number = Column(String(32), nullable=True)
    customer_industry = Column(String(32), nullable=True)
    estimated_monthly_card_volume = Column(String(64), nullable=True)
    average_transaction_value = Column(String(64), nullable=True)
    delivery_timeframe = Column(String(32), nullable=True)
    customer_support_email = Column(String(255), nullable=True)
    customer_websites = Column(String(1024), nullable=True)
    product_description = Column(String(4096), nullable=True)
    # Step 6 bank details
    bank_account_name = Column(String(255), nullable=True)
    bank_currency = Column(String(8), nullable=True)
    bank_country = Column(String(64), nullable=True)
    bank_sort_code = Column(String(16), nullable=True)
    bank_account_number = Column(String(16), nullable=True)
    bank_iban = Column(String(34), nullable=True)

    boarding_event = relationship("BoardingEvent", back_populates="contact")
