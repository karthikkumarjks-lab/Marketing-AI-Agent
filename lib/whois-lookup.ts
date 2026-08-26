// Real WHOIS-equivalent data via RDAP (Registration Data Access Protocol) —
// the modern, structured-JSON replacement for legacy WHOIS, exposed for free
// with no API key by registries worldwide. rdap.org is a free public bootstrap
// proxy that resolves any domain to the correct registry's RDAP server and
// follows the redirect — verified live (2026-08-26) against real domains on
// two different registrars (stripe.com via SafeNames, onlinemanipal.com via
// GoDaddy), both returning real registration/expiration dates with zero
// credentials. Registrant name/email/address are NOT included — every
// registry redacts that under GDPR/ICANN privacy rules by default, same as
// real WHOIS today; this only ever returns registrar + dates + status.

const RDAP_TIMEOUT_MS = 10000;

export interface WhoisInfo {
  registrar: string | null;
  registeredDate: string | null;
  expirationDate: string | null;
  lastChangedDate: string | null;
  domainAgeYears: number | null;
  status: string[];
}

interface RdapEvent {
  eventAction: string;
  eventDate: string;
}

interface RdapVcardField extends Array<unknown> {
  0: string;
}

interface RdapEntity {
  roles?: string[];
  vcardArray?: [string, RdapVcardField[]];
}

interface RdapResponse {
  events?: RdapEvent[];
  entities?: RdapEntity[];
  status?: string[];
}

function findEventDate(events: RdapEvent[], action: string): string | null {
  return events.find((e) => e.eventAction === action)?.eventDate ?? null;
}

function findRegistrarName(entities: RdapEntity[]): string | null {
  const registrar = entities.find((e) => e.roles?.includes("registrar"));
  const fnField = registrar?.vcardArray?.[1]?.find((f) => f[0] === "fn");
  return typeof fnField?.[3] === "string" ? fnField[3] : null;
}

export async function lookupWhois(domain: string): Promise<WhoisInfo | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RDAP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "application/rdap+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RdapResponse;
    const events = data.events ?? [];
    const registeredDate = findEventDate(events, "registration");
    const domainAgeYears = registeredDate
      ? Math.floor((Date.now() - new Date(registeredDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
      : null;
    return {
      registrar: findRegistrarName(data.entities ?? []),
      registeredDate,
      expirationDate: findEventDate(events, "expiration"),
      lastChangedDate: findEventDate(events, "last changed"),
      domainAgeYears,
      status: data.status ?? [],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
