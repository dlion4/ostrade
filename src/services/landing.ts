// Service layer for the public pages. Signatures match the future REST API;
// today they read local mock data. Pages never import src/data directly.
import {
  brokers,
  capabilityBrokers,
  capabilityRows,
  faqItems,
  features,
  flowSteps,
  guardrails,
  journalRows,
  platformStats,
  signalSamples,
  trustItems,
  type Broker,
  type CapabilityRow,
  type FaqItem,
  type Feature,
  type FlowStep,
  type Guardrail,
  type JournalRow,
  type PlatformStat,
  type SignalSample,
} from "@/data/landing";
import { latency } from "./_latency";

export type { Broker, CapabilityRow, FaqItem, Feature, FlowStep, Guardrail, JournalRow, PlatformStat, SignalSample };

export const getBrokers = (): Promise<Broker[]> => latency(brokers);
export const getCapabilityMatrix = (): Promise<{ brokers: string[]; rows: CapabilityRow[] }> =>
  latency({ brokers: capabilityBrokers, rows: capabilityRows });
export const getSignalSamples = (): Promise<SignalSample[]> => latency(signalSamples);
export const getPlatformStats = (): Promise<PlatformStat[]> => latency(platformStats, 300, 500);
export const getFaq = (): Promise<FaqItem[]> => latency(faqItems, 300, 500);
export const getFeatures = (): Promise<Feature[]> => latency(features, 300, 500);
export const getFlowSteps = (): Promise<FlowStep[]> => latency(flowSteps, 300, 500);
export const getGuardrails = (): Promise<Guardrail[]> => latency(guardrails, 300, 600);
export const getTrustItems = (): Promise<string[]> => latency(trustItems, 300, 400);
export const getJournalPreview = (): Promise<JournalRow[]> => latency(journalRows);
