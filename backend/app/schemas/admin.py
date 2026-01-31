from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, EmailStr


class AdminLogin(BaseModel):
    username: str
    password: str


class AdminCreate(BaseModel):
    username: str
    password: str


class AdminChangePassword(BaseModel):
    new_password: str


class AdminUserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    username: str
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ISV (Partner) admin schemas
class AdminPartnerCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    external_id: Optional[str] = None


class AdminPartnerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None
    external_id: Optional[str] = None


class AdminPartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    email: str
    external_id: Optional[str] = None
    logo_url: Optional[str] = None
    is_active: bool
    created_at: datetime
