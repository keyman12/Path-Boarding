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

    boarding_event = relationship("BoardingEvent", back_populates="contact")
