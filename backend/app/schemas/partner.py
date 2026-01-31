from pydantic import BaseModel, ConfigDict, EmailStr


class PartnerCreate(BaseModel):
    name: str
    email: EmailStr
    password: str


class PartnerLogin(BaseModel):
    email: EmailStr
    password: str


class PartnerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    email: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
