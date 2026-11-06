from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class EmailRequest(BaseModel):
    email: EmailStr


class EmailCodeRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResetPasswordRequest(EmailCodeRequest):
    new_password: str = Field(min_length=8, max_length=128)


class MessageOut(BaseModel):
    message: str
