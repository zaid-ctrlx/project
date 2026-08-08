import { api } from "./client";

export type GeocodeResult = { label: string; lat: number; lng: number };

export function reverseGeocode(lat: number, lng: number): Promise<{ label: string }> {
  return api.authed(`/geocode/reverse?lat=${lat}&lng=${lng}`);
}

export function searchLocation(query: string): Promise<GeocodeResult[]> {
  return api.authed(`/geocode/search?q=${encodeURIComponent(query)}`);
}
