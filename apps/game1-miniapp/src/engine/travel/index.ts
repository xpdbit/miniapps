export { TravelEngine, TravelStatus } from './TravelEngine';
export type {
  StatusChangedPayload,
  TravelProgressPayload,
  TravelCompletedPayload,
  TravelAutoPausedPayload,
  TravelRewards,
  TravelSaveData,
} from './TravelEngine';

export { TravelResource, DEFAULT_RESOURCE_CONFIG } from './TravelResource';
export type {
  ResourceDef,
  TravelResourceConfig,
  TravelResourceSaveData,
  ResourceChangedPayload,
  ResourceDepletedPayload,
} from './TravelResource';

export { MileageManager } from './MileageManager';
export type {
  MileageMilestone,
  MileageChestReward,
  MileageSaveData,
  MileageUpdatedPayload,
  MileageMilestoneReachedPayload,
  MileageChestRewardPayload,
} from './MileageManager';

export { RouteEventController, RouteNodeType } from './RouteEventController';
export type {
  RouteNodeDef,
  RouteNode,
  RouteDefinition,
  EventOutcome,
  TravelEventChoice,
  TravelEvent,
  EventTriggeredPayload,
  NodeReachedPayload,
  EventChoiceResolvedPayload,
  RouteEventSaveData,
} from './RouteEventController';
