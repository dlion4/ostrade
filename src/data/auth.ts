// A-1 Sign Up mock data. Local only — no network, no accounts are created.
// Static snapshots: quotes here intentionally never tick or random-walk.

export interface QuoteSnapshot {
  symbol: string;
  venue: string;
  bid: string;
  ask: string;
  change: string;
  direction: "up" | "down";
  assetClass: string;
}
export const quoteSnapshots: QuoteSnapshot[] = [
  { symbol: "EURUSD", venue: "Exness MT5", bid: "1.08420", ask: "1.08432", change: "+0.12%", direction: "up", assetClass: "Forex" },
  { symbol: "GBPUSD", venue: "cTrader", bid: "1.27118", ask: "1.27130", change: "−0.08%", direction: "down", assetClass: "Forex" },
  { symbol: "XAUUSD", venue: "Exness MT5", bid: "2385.50", ask: "2385.72", change: "+0.41%", direction: "up", assetClass: "Metals" },
  { symbol: "BTCUSDT", venue: "Binance", bid: "64120.00", ask: "64124.50", change: "−0.62%", direction: "down", assetClass: "Crypto" },
  { symbol: "R_10", venue: "Deriv", bid: "4532.11", ask: "4532.86", change: "+0.27%", direction: "up", assetClass: "Synthetics" },
  { symbol: "US30", venue: "Exness MT5", bid: "39120.0", ask: "39122.4", change: "−0.19%", direction: "down", assetClass: "Indices" },
  { symbol: "USDJPY", venue: "OANDA", bid: "156.102", ask: "156.116", change: "+0.09%", direction: "up", assetClass: "Forex" },
  { symbol: "NAS100", venue: "cTrader", bid: "19842.5", ask: "19843.8", change: "+0.33%", direction: "up", assetClass: "Indices" },
  { symbol: "ETHUSDT", venue: "Binance", bid: "3120.00", ask: "3120.80", change: "−0.24%", direction: "down", assetClass: "Crypto" },
  { symbol: "AUDUSD", venue: "Deriv", bid: "0.66401", ask: "0.66412", change: "+0.06%", direction: "up", assetClass: "Forex" },
];

export interface WorkspacePreview {
  id: string;
  name: string;
  balance: string;
  currency: string;
  leverage: string;
  mode: string;
  note: string;
}
export const workspacePreviews: WorkspacePreview[] = [
  { id: "w01", name: "OStrade Paper", balance: "10,000.00", currency: "USD", leverage: "1 : 100", mode: "Simulated", note: "Default workspace — no credentials, no real money." },
  { id: "w02", name: "Deriv Demo", balance: "10,000.00", currency: "USD", leverage: "Contract", mode: "Broker demo", note: "Synthetics and forex on the Deriv sandbox." },
  { id: "w03", name: "Exness MT5 Trial", balance: "5,000.00", currency: "USD", leverage: "1 : 200", mode: "Broker demo", note: "MetaApi bridge, conventional MT5 lots." },
  { id: "w04", name: "Alpaca Paper", balance: "100,000.00", currency: "USD", leverage: "Cash", mode: "Broker demo", note: "US stocks and crypto with paper API keys." },
  { id: "w05", name: "Binance Testnet", balance: "10,000.00", currency: "USDT", leverage: "Spot", mode: "Broker demo", note: "Crypto-only sandbox with separate API keys." },
  { id: "w06", name: "OANDA Practice", balance: "100,000.00", currency: "USD", leverage: "1 : 50", mode: "Broker demo", note: "Practice token, v20 instrument naming." },
  { id: "w07", name: "cTrader Demo", balance: "10,000.00", currency: "EUR", leverage: "1 : 100", mode: "Broker demo", note: "Open API OAuth on a cTrader demo account." },
  { id: "w08", name: "IC Markets Demo", balance: "10,000.00", currency: "USD", leverage: "1 : 500", mode: "Broker demo", note: "MT5 trial with exact server name required." },
  { id: "w09", name: "Pepperstone Demo", balance: "50,000.00", currency: "AUD", leverage: "1 : 200", mode: "Broker demo", note: "MT5 trial for forex and index rehearsal." },
  { id: "w10", name: "XM Demo", balance: "10,000.00", currency: "USD", leverage: "1 : 100", mode: "Broker demo", note: "MT5 trial with account-specific symbol suffixes." },
];

export interface OnboardingCountry { code: string; name: string; dial: string; currency: string; }
export const onboardingCountries: OnboardingCountry[] = [
  { code: "KE", name: "Kenya", dial: "+254", currency: "KES" },
  { code: "UG", name: "Uganda", dial: "+256", currency: "UGX" },
  { code: "TZ", name: "Tanzania", dial: "+255", currency: "TZS" },
  { code: "RW", name: "Rwanda", dial: "+250", currency: "RWF" },
  { code: "NG", name: "Nigeria", dial: "+234", currency: "NGN" },
  { code: "ZA", name: "South Africa", dial: "+27", currency: "ZAR" },
  { code: "GB", name: "United Kingdom", dial: "+44", currency: "GBP" },
  { code: "US", name: "United States", dial: "+1", currency: "USD" },
  { code: "DE", name: "Germany", dial: "+49", currency: "EUR" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", currency: "AED" },
  { code: "IN", name: "India", dial: "+91", currency: "INR" },
  { code: "SG", name: "Singapore", dial: "+65", currency: "SGD" },
];

export interface OnboardingTimezone { id: string; city: string; offset: string; }
export const onboardingTimezones: OnboardingTimezone[] = [
  { id: "Africa/Nairobi", city: "Nairobi", offset: "UTC+3" },
  { id: "Africa/Kampala", city: "Kampala", offset: "UTC+3" },
  { id: "Africa/Dar_es_Salaam", city: "Dar es Salaam", offset: "UTC+3" },
  { id: "Africa/Lagos", city: "Lagos", offset: "UTC+1" },
  { id: "Africa/Johannesburg", city: "Johannesburg", offset: "UTC+2" },
  { id: "Europe/London", city: "London", offset: "UTC+0" },
  { id: "Europe/Berlin", city: "Berlin", offset: "UTC+1" },
  { id: "America/New_York", city: "New York", offset: "UTC−5" },
  { id: "Asia/Dubai", city: "Dubai", offset: "UTC+4" },
  { id: "Asia/Kolkata", city: "Mumbai", offset: "UTC+5:30" },
  { id: "Asia/Singapore", city: "Singapore", offset: "UTC+8" },
  { id: "UTC", city: "Coordinated Universal Time", offset: "UTC±0" },
];
