// H-3 service layer — signatures mirror the future public content API.
import {
  anatomyMarkers,
  automationModels,
  copilotSuggestions,
  disconnectSequence,
  financeLanes,
  guardScenarios,
  pipelineStages,
  recordStates,
  schedulePool,
  scheduledInitial,
  SCHEDULER_BULK,
  SCHEDULER_MAX,
  howFaqs,
  type AnatomyMarker,
  type AutomationModel,
  type CopilotSuggestion,
  type DisconnectState,
  type FinanceLane,
  type GuardScenario,
  type HowFaq,
  type PipelineStage,
  type RecordState,
  type ScheduledItem,
} from "@/data/howItWorks";
import { signalSamples, type SignalSample } from "@/data/landing";
import { latency } from "./_latency";

export { SCHEDULER_BULK, SCHEDULER_MAX };
export type { AnatomyMarker, AutomationModel, CopilotSuggestion, DisconnectState, FinanceLane, GuardScenario, HowFaq, PipelineStage, RecordState, ScheduledItem, SignalSample };

export const getPipeline = (): Promise<PipelineStage[]> => latency(pipelineStages, 300, 500);
export const getAnatomyMarkers = (): Promise<AnatomyMarker[]> => latency(anatomyMarkers, 300, 500);
export const getAutomationModels = (): Promise<AutomationModel[]> => latency(automationModels, 300, 500);
export const getCopilotSuggestions = (): Promise<CopilotSuggestion[]> => latency(copilotSuggestions, 300, 500);
export const getSchedulerQueue = (): Promise<ScheduledItem[]> => latency(scheduledInitial);
export const getSchedulePool = (): Promise<Omit<ScheduledItem, "id">[]> => latency(schedulePool, 300, 400);
export const getFinanceLanes = (): Promise<FinanceLane[]> => latency(financeLanes, 300, 500);
export const getGuardScenarios = (): Promise<GuardScenario[]> => latency(guardScenarios, 300, 500);
export const getRecordStates = (): Promise<RecordState[]> => latency(recordStates, 300, 400);
export const getDisconnectSequence = (): Promise<DisconnectState[]> => latency(disconnectSequence, 300, 400);
export const getHowFaqs = (): Promise<HowFaq[]> => latency(howFaqs, 300, 500);
export const getHeroSamples = (): Promise<SignalSample[]> => latency(signalSamples.filter((s) => ["s1", "s3", "s4"].includes(s.id)), 300, 500);
