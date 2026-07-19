import { HttpError } from "./cors.ts";

const AKAHU_BASE_URL = "https://api.akahu.io/v1";

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(500, `Missing required Akahu server secret: ${name}`);
  return value;
}

function akahuHeaders(): HeadersInit {
  return {
    "Authorization": `Bearer ${requireEnv("AKAHU_USER_ACCESS_TOKEN")}`,
    "X-Akahu-Id": requireEnv("AKAHU_APP_ID_TOKEN"),
    "Accept": "application/json"
  };
}

async function akahuFetch(path: string, query?: Record<string, string | undefined>): Promise<any> {
  const url = new URL(`${AKAHU_BASE_URL}${path}`);
  for (const [key, value] of Object.entries(query || {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: akahuHeaders()
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new HttpError(response.status, "Akahu API request failed.", {
      path,
      status: response.status,
      message: body?.message || body?.error || "No Akahu error message returned"
    });
  }

  return body;
}

export async function getAccounts(): Promise<any[]> {
  const body = await akahuFetch("/accounts");
  return extractItems(body);
}

export async function getAccount(accountId: string): Promise<any> {
  const body = await akahuFetch(`/accounts/${encodeURIComponent(accountId)}`);
  return body?.item || body?.data || body?.account || body;
}

export async function getAccountTransactions(
  accountId: string,
  start: string,
  end: string
): Promise<any[]> {
  const transactions: any[] = [];
  let cursor: string | undefined;
  let pageSafetyCounter = 0;

  do {
    const body = await akahuFetch(
      `/accounts/${encodeURIComponent(accountId)}/transactions`,
      { start, end, cursor }
    );

    transactions.push(...extractItems(body));
    cursor = extractNextCursor(body);
    pageSafetyCounter += 1;

    if (pageSafetyCounter > 100) {
      throw new HttpError(500, "Akahu pagination safety limit reached.");
    }
  } while (cursor);

  return transactions;
}

export function extractItems(body: any): any[] {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.items)) return body.items;
  if (Array.isArray(body?.data)) return body.data;
  if (Array.isArray(body?.results)) return body.results;
  return [];
}

export function extractNextCursor(body: any): string | undefined {
  // Akahu returns a cursor only when more result pages are available.
  // Some responses expose cursor metadata as an object. The previous version
  // could pass that object back to Akahu as "[object Object]", causing
  // HTTP 400 "Invalid cursor" on the second page request.
  const candidates = [
    body?.cursor?.next,
    body?.cursor?.after,
    body?.next_cursor,
    body?.nextCursor,
    body?.pagination?.next,
    body?.paging?.next
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (typeof body?.cursor === "string" && body.cursor.trim()) {
    return body.cursor.trim();
  }

  return undefined;
}

export function maskAccount(account: any): Record<string, unknown> {
  const rawNumber = String(
    account?.formatted_account ||
    account?.account_number ||
    account?.number ||
    account?.meta?.account_number ||
    ""
  );

  return {
    external_account_id: account?._id || account?.id,
    masked_account_name: String(account?.name || account?.display_name || account?.type || "Kiwibank account"),
    masked_account_number: maskAccountNumber(rawNumber),
    currency_code: String(account?.currency || account?.currency_code || "NZD").slice(0, 3).toUpperCase(),
    current_balance: numberOrNull(account?.balance?.current ?? account?.current_balance ?? account?.balance),
    available_balance: numberOrNull(account?.balance?.available ?? account?.available_balance),
    balance_updated_at: dateOrNull(account?.refreshed?.balance ?? account?.balance_updated_at ?? account?.updated_at),
    last_bank_refresh_at: dateOrNull(account?.refreshed?.transactions ?? account?.refreshed_at ?? account?.updated_at)
  };
}

export function safeAccountForClient(account: any): Record<string, unknown> {
  const masked = maskAccount(account);
  return {
    id: masked.external_account_id,
    name: masked.masked_account_name,
    masked_account_number: masked.masked_account_number,
    currency_code: masked.currency_code,
    current_balance: masked.current_balance,
    available_balance: masked.available_balance,
    balance_updated_at: masked.balance_updated_at,
    last_bank_refresh_at: masked.last_bank_refresh_at
  };
}

export function maskAccountNumber(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "Masked account";
  const lastFour = digits.slice(-4);
  return `•••• ${lastFour}`;
}

function numberOrNull(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function dateOrNull(value: unknown): string | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
