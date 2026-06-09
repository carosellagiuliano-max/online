/**
 * BeautifyPRO - Services Index
 * Central export for all business services
 */

// Loyalty Service
export {
  LoyaltyService,
  getLoyaltyService,
  DEFAULT_TIERS,
  type LoyaltyTier,
  type CustomerLoyalty,
  type LoyaltyTransaction,
  type LoyaltyProgram,
} from './loyalty-service';

// Waitlist Service
export {
  WaitlistService,
  getWaitlistService,
  type WaitlistEntry,
  type WaitlistEntryWithDetails,
  type WaitlistStats,
  type WaitlistStatus,
  type JoinWaitlistParams,
} from './waitlist-service';

// Marketing Service
export {
  MarketingService,
  getMarketingService,
  DEFAULT_CAMPAIGNS,
  type CampaignType,
  type MarketingCampaign,
  type CampaignLog,
  type CustomerForCampaign,
} from './marketing-service';

// Feedback Service
export {
  FeedbackService,
  getFeedbackService,
  type CustomerFeedback,
  type FeedbackWithDetails,
  type FeedbackRequest,
  type FeedbackStats,
  type FeedbackStatus,
  type SubmitFeedbackParams,
} from './feedback-service';

// Deposit Service
export {
  DepositService,
  getDepositService,
  type AppointmentDeposit,
  type DepositWithDetails,
  type DepositPolicy,
  type DepositStatus,
  type RefundResult,
} from './deposit-service';
