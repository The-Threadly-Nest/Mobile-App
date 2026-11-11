import { getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import countryNames from "./countryNames.json";

export interface Country { name: string; code: string; flag: string; isoCode: CountryCode }
export const COUNTRIES: Country[] = getCountries().map(isoCode => ({
  isoCode, name: (countryNames as Record<string, string>)[isoCode] || isoCode,
  code: `+${getCountryCallingCode(isoCode)}`,
  flag: String.fromCodePoint(...[...isoCode].map(letter => 127397 + letter.charCodeAt(0))),
})).sort((a, b) => a.name.localeCompare(b.name, "en"));
export const DEFAULT_COUNTRY = COUNTRIES.find(country => country.isoCode === "NG")!;

export function nationalPhoneDigits(value: string, country: Country): string {
  const digits = value.replace(/\D/g, "");
  const parsed = parsePhoneNumberFromString(digits, country.isoCode);
  return parsed && `+${parsed.countryCallingCode}` === country.code ? String(parsed.nationalNumber) : digits;
}

export function resolvePhoneCountry(value: string, preferred = DEFAULT_COUNTRY): { country: Country; nationalNumber: string } {
  const clean = value.trim().replace(/[^\d+]/g, "");
  if (!clean.startsWith("+")) return { country: preferred, nationalNumber: nationalPhoneDigits(clean, preferred) };
  const parsed = parsePhoneNumberFromString(clean);
  const candidates = COUNTRIES.filter(country => clean.startsWith(country.code)).sort((a, b) => b.code.length - a.code.length);
  const sharedDefaults: Record<string, string> = { "+1": "US", "+7": "RU", "+44": "GB", "+61": "AU", "+358": "FI" };
  // Preserve an explicit choice for shared codes such as Canada/US (+1).
  const country = clean.startsWith(preferred.code) ? preferred
    : COUNTRIES.find(country => country.isoCode === parsed?.country)
      || candidates.find(country => country.isoCode === sharedDefaults[candidates[0]?.code])
      || candidates[0] || preferred;
  const nationalNumber = parsed && `+${parsed.countryCallingCode}` === country.code ? String(parsed.nationalNumber) : clean.slice(country.code.length).replace(/\D/g, "");
  return { country, nationalNumber };
}

export function searchCountries(query: string): Country[] {
  const search = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return COUNTRIES.filter(country => country.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search) || country.isoCode.toLowerCase().includes(search) || country.code.includes(search));
}
