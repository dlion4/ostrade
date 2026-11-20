import { railPolicies, railDestinations, policyRailsFor, type RailPolicyId, type RailPolicy, type RailPreference } from "@/data/transfers";
import { latency } from "./_latency";
import { getAccounts } from "./dashboard";
import type { FinanceAudit } from "@/data/transfers";

export { policyRailsFor, railDestinations };
export type { RailPolicy, RailPolicyId, RailPreference };
const policies = structuredClone(railPolicies);
const preferences: RailPreference[] = [];
const destinationBook: RailPreference[] = [];
const audit: FinanceAudit[] = [];
export const getRailOverrides = () => structuredClone(policies.filter((p,i) => JSON.stringify(p) !== JSON.stringify(railPolicies[i])));
export const getRailPreference = (accountId:string) => structuredClone(preferences.find(p=>p.accountId===accountId));
export const getFundingPolicy = () => latency({ policies, preferences, destinationBook });
export const readFundingAudit = () => structuredClone(audit);
export async function updateFundingRail(input:{ id:RailPolicyId; min:number; max:number; fee:number; enabled:boolean; totp:string }) {
  if (input.totp !== "123456") throw new Error("Use the example TOTP 123456 to confirm policy changes.");
  const p = policies.find(o=>o.id===input.id);
  if (!p) throw new Error("Choose a known funding rail.");
  if (![input.min,input.max,input.fee].every(n=>Number.isFinite(n)&&Math.round(n*100)/100===n) || input.min<1 || input.max<input.min || input.max>1_000_000 || input.fee<0 || input.fee>=input.min || typeof input.enabled!=="boolean") throw new Error("Enter valid limits (up to 1,000,000) and a fee smaller than the minimum.");
  if (p.id === "paper" && input.fee !== 0) throw new Error("Paper funding does not charge a fee.");
  const prev = `${p.enabled?"enabled":"disabled"}, ${p.min}–${p.max}, fee ${p.fee}`;
  Object.assign(p,{min:input.min,max:input.max,fee:input.fee,enabled:input.enabled});
  audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"Funding rail updated",actor:"Local operator",outcome:"Saved locally",verification:"Example TOTP",detail:`${p.title} (${p.currency}): ${prev} → ${p.enabled?"enabled":"disabled"}, ${p.min}–${p.max}, fee ${p.fee}.`});
  return latency(p);
}
export async function saveFundingPreference(input:{ accountId:string; rail:RailPolicyId; provider:string; label:string; totp:string; otp?:string }) {
  if (input.totp !== "123456") throw new Error("Use the example TOTP 123456 to confirm changes.");
  const account = (await getAccounts()).find(a=>a.id===input.accountId), policy=policies.find(p=>p.id===input.rail);
  if (!account || !policy?.enabled || !railDestinations[input.rail].some(v=>v===input.provider)) throw new Error("Choose an enabled rail and a listed sample provider.");
  const compatible=policyRailsFor(account.broker).includes(input.rail);
  if (!compatible && !["airtel","eft","card"].includes(input.rail)) throw new Error("This rail is not compatible with the selected profile.");
  const label=input.label.trim();
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]{1,29}$/u.test(label)) throw new Error("Use a sample label of 2–30 letters, numbers, or spaces. Do not enter phone or account details.");
  const needsOtp=["mpesa","airtel","crypto"].includes(input.rail);
  if (needsOtp && input.otp!=="000000") throw new Error("Use the example OTP 000000. No message will be sent.");
  const masked=input.rail==="mpesa"||input.rail==="airtel"?"Sample mobile •••• 024":input.rail==="crypto"?`Non-payable ${input.provider} •••• DEMO`:input.rail==="paper"?"Simulator only":"Sample destination •••• 1024";
  const value={accountId:account.id,rail:input.rail,provider:input.provider,label,masked,verified:needsOtp};
  const idx=preferences.findIndex(p=>p.accountId===account.id);
  if (idx<0) preferences.unshift(value); else preferences[idx]=value;
  const saved=destinationBook.findIndex(d=>d.accountId===value.accountId&&d.rail===value.rail&&d.label.toLowerCase()===label.toLowerCase());
  if(saved<0) destinationBook.unshift(value); else destinationBook[saved]=value;
  audit.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),action:"Default rail saved",actor:"Local operator",outcome:compatible?"Saved locally":"Review-only preference",verification:needsOtp?"Example TOTP + OTP":"Example TOTP",detail:`${account.label} · ${policy.title} · ${input.provider} · ${masked}.`});
  return latency(value);
}
