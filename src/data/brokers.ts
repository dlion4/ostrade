// Supplemental H-2 mock data. The canonical broker list and capability matrix
// stay in src/data/landing.ts and are reused here, never duplicated.

export interface ConnectionMethodDetail {
  id: "oauth" | "token" | "mt5" | "paper";
  name: string;
  short: string;
  usedBy: string[];
  fields: string[];
  steps: string[];
  note: string;
}

export const connectionMethods: ConnectionMethodDetail[] = [
  {
    id: "oauth",
    name: "OAuth",
    short: "Authorise without sharing your password.",
    usedBy: ["Deriv", "cTrader"],
    fields: ["Broker authorisation", "Requested scopes", "Account selection"],
    steps: ["Choose the broker in OStrade.", "Authorise on the broker's own page.", "Return and select the account OStrade may use."],
    note: "OStrade stores the resulting credential encrypted. You can revoke access from the broker as well.",
  },
  {
    id: "token",
    name: "API token or keys",
    short: "Use a restricted key created for trading.",
    usedBy: ["Alpaca", "Binance", "OANDA"],
    fields: ["API key / token", "API secret where required", "Paper or live environment"],
    steps: ["Create a key in your broker dashboard.", "Enable trading only; leave withdrawals disabled.", "Paste it into the encrypted OStrade vault."],
    note: "Never use a withdrawal-enabled key for trade execution. IP restrictions are recommended where supported.",
  },
  {
    id: "mt5",
    name: "MT5 login + server",
    short: "Bridge MT4/MT5 accounts through MetaApi.",
    usedBy: ["Exness", "IC Markets", "Pepperstone", "XM", "FXTM", "Tickmill"],
    fields: ["MT5 login number", "Trading password", "Exact broker server name"],
    steps: ["Copy the server name from your MT5 terminal.", "Enter the login and trading password.", "Choose demo or live after the account is validated."],
    note: "The server name must match exactly. An investor password can read an account but cannot place trades.",
  },
  {
    id: "paper",
    name: "Built-in paper",
    short: "No credentials and no broker signup.",
    usedBy: ["OStrade Paper"],
    fields: ["Starting balance", "Account currency", "Simulation rules"],
    steps: ["Open a free OStrade workspace.", "Keep the default $10,000 paper account.", "Paste a signal and review the simulated fill."],
    note: "Paper fills, positions and journal entries are simulated locally in this frontend preview.",
  },
];

export interface DemoVenue {
  id: string;
  name: string;
  environment: string;
  markets: string;
  detail: string;
}
export const demoVenues: DemoVenue[] = [
  { id: "paper", name: "OStrade Paper", environment: "Local simulation", markets: "All sample markets", detail: "Instant setup with a simulated $10,000 balance and full journal." },
  { id: "deriv", name: "Deriv", environment: "Demo", markets: "Synthetics, forex, crypto", detail: "Practise contract-based orders, including 24/7 synthetic indices." },
  { id: "exness", name: "Exness / MT5", environment: "MT5 trial", markets: "Forex, metals, indices", detail: "Rehearse MT5 lots, stops, partial closes and symbol suffixes." },
  { id: "ctrader", name: "cTrader", environment: "Demo", markets: "Forex, indices, commodities", detail: "Test OAuth access and Open API order behaviour without real funds." },
  { id: "alpaca", name: "Alpaca", environment: "Paper", markets: "US stocks, crypto", detail: "Use separate paper keys to rehearse stock and crypto orders." },
  { id: "binance", name: "Binance", environment: "Testnet", markets: "Crypto", detail: "Try API-key permissions and crypto order sizing on testnet." },
  { id: "oanda", name: "OANDA", environment: "Practice", markets: "Forex, metals, indices", detail: "Connect a practice token and learn OANDA's instrument naming." },
];

export interface SymbolMapping {
  canonical: string;
  assetClass: string;
  note: string;
  // Deriv, Exness/MT5, cTrader, Alpaca, Binance, OANDA. Null = not offered.
  codes: (string | null)[];
}
export const symbolMappings: SymbolMapping[] = [
  { canonical: "EURUSD", assetClass: "Forex", note: "Six-letter FX pair; OANDA inserts an underscore.", codes: ["frxEURUSD", "EURUSDm", "EURUSD", null, null, "EUR_USD"] },
  { canonical: "GBPUSD", assetClass: "Forex", note: "MT5 suffix varies by account type.", codes: ["frxGBPUSD", "GBPUSDm", "GBPUSD", null, null, "GBP_USD"] },
  { canonical: "USDJPY", assetClass: "Forex", note: "Digits and pip size are preserved per venue.", codes: ["frxUSDJPY", "USDJPYm", "USDJPY", null, null, "USD_JPY"] },
  { canonical: "AUDUSD", assetClass: "Forex", note: "Mapped before an order reaches the adapter.", codes: ["frxAUDUSD", "AUDUSDm", "AUDUSD", null, null, "AUD_USD"] },
  { canonical: "XAUUSD", assetClass: "Metals", note: "Gold versus US dollar; contract size is broker-specific.", codes: ["frxXAUUSD", "XAUUSDm", "XAUUSD", null, null, "XAU_USD"] },
  { canonical: "XAGUSD", assetClass: "Metals", note: "Silver versus US dollar.", codes: ["frxXAGUSD", "XAGUSDm", "XAGUSD", null, null, "XAG_USD"] },
  { canonical: "BTCUSD", assetClass: "Crypto", note: "Binance uses the BTCUSDT market for this signal alias.", codes: ["cryBTCUSD", "BTCUSDm", "BTCUSD", "BTC/USD", "BTCUSDT", null] },
  { canonical: "ETHUSD", assetClass: "Crypto", note: "Crypto quantity is normalised separately from FX lots.", codes: ["cryETHUSD", "ETHUSDm", "ETHUSD", "ETH/USD", "ETHUSDT", null] },
  { canonical: "US30", assetClass: "Indices", note: "Index CFD names differ; unavailable venues are blocked.", codes: ["OTC_DJI", "US30", "US30", null, null, "US30_USD"] },
  { canonical: "NAS100", assetClass: "Indices", note: "The adapter validates the resolved instrument before sending.", codes: ["OTC_NDX", "USTEC", "US100", null, null, "NAS100_USD"] },
  { canonical: "R_10", assetClass: "Synthetics", note: "Deriv Volatility 10 Index; no cross-broker equivalent.", codes: ["R_10", null, null, null, null, null] },
  { canonical: "R_75", assetClass: "Synthetics", note: "Deriv Volatility 75 Index; available around the clock.", codes: ["R_75", null, null, null, null, null] },
];

export interface BrokerFaq { id: string; q: string; a: string; }
export const brokerFaqs: BrokerFaq[] = [
  { id: "bf1", q: "Why does OStrade show features my broker does not support?", a: "It does not. Trading screens use the capability matrix to hide or explain unsupported actions. If a broker cannot modify a stop-loss through its API, OStrade will not pretend that it can." },
  { id: "bf2", q: "What is the difference between Deriv and MT5 orders?", a: "A Deriv order buys a contract after a proposal, while MT5 places a conventional market or pending order in lots. OStrade presents one order card and lets each adapter translate it correctly." },
  { id: "bf3", q: "Why does my Exness symbol end in 'm'?", a: "Suffixes such as EURUSDm identify a specific MT5 account or symbol group. OStrade keeps one canonical signal symbol and resolves the broker's exact instrument before routing." },
  { id: "bf4", q: "Can OStrade withdraw from every connected broker?", a: "No. Deposits and withdrawals are automated only where the API allows them. Deriv may use a hosted cashier deep-link; unsupported venues use a manual rail with proof and an automated ledger entry." },
  { id: "bf5", q: "Do I need to give OStrade my broker password?", a: "OAuth brokers never ask for it. MT5 connections need the trading login, server and password for MetaApi. Token-based brokers use API credentials. All secrets belong in the encrypted credential vault, never in a signal or journal note." },
  { id: "bf6", q: "Should my API keys allow withdrawals?", a: "No. Create trade-only keys whenever the broker offers permission scopes. OStrade does not need withdrawal permission to execute signals, and narrower keys reduce the impact of a leaked credential." },
  { id: "bf7", q: "Can I connect more than one account from the same broker?", a: "Yes. The account switcher is designed for multiple paper, demo and live accounts. Every position, balance and journal entry stays attached to its own account." },
  { id: "bf8", q: "What happens when a symbol is not available?", a: "The risk and routing checks stop the order before submission and show the unresolved symbol. It is recorded as blocked rather than substituted with a different instrument." },
  { id: "bf9", q: "Are paper results the same as live results?", a: "No. Paper accounts are for learning the workflow and testing rules. They cannot reproduce every live spread, slippage, rejection or liquidity condition." },
  { id: "bf10", q: "Does connecting a broker move my money to OStrade?", a: "Never. Funds remain at the broker. OStrade is an execution and records layer using the access you grant, and revoking that access stops future API instructions." },
];
