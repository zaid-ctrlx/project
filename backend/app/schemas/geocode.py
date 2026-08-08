from pydantic import BaseModel


class ReverseGeocodeOut(BaseModel):
    label: str


class GeocodeResult(BaseModel):
    label: str
    lat: float
    lng: float
