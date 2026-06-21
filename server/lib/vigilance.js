const RWG_BASE = "https://rwg.meteofrance.com/wsft/v3";

export async function fetchVigilanceThumbnail(token, day = "today") {
  const echeance = day === "tomorrow" ? "J1" : "J0";
  const url = new URL(`${RWG_BASE}/warning/thumbnail`);
  url.searchParams.set("domain", "FRA");
  url.searchParams.set("resolution", "large");
  url.searchParams.set("warning_type", "vigilance");
  url.searchParams.set("echeance", echeance);
  url.searchParams.set("token", token);

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Vigilance (${response.status}): ${text}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
}