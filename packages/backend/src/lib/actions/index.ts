// ============================================
// BeautifyPRO Server Actions
// ============================================

// Salon data
export {
  getSalon,
  getOpeningHours,
  getServicesWithCategories,
  getBookableServices,
  getAddonServices,
  getPublicSalonData,
  updateOpeningHours,
  updateSalon,
  getSocialLinks,
  getEnabledSocialLinks,
  updateSocialLinks,
  getAboutValues,
  getAllAboutValues,
  createAboutValue,
  updateAboutValue,
  deleteAboutValue,
  getAboutMilestones,
  getAllAboutMilestones,
  createAboutMilestone,
  updateAboutMilestone,
  deleteAboutMilestone,
  getAboutPageSettings,
  updateAboutPageSettings,
  type Salon,
  type OpeningHour,
  type ServiceCategory,
  type Service,
  type ServiceLengthVariant,
  type AddonService,
  type UpdateOpeningHoursInput,
  type UpdateOpeningHoursResult,
  type UpdateSalonInput,
  type UpdateSalonResult,
  type SocialLink,
  type UpdateSocialLinkInput,
  type UpdateSocialLinksResult,
  type AboutValue,
  type AboutMilestone,
  type AboutPageSettings,
} from './salon';

// Staff data
export {
  getStaffMembers,
  getBookableStaff,
  getStaffWorkingHours,
  getStaffAbsences,
  getStaffSkills,
  type StaffMember,
  type StaffWorkingHours,
  type StaffAbsence,
} from './staff';

// Products data
export {
  getProductCategories,
  getProducts,
  getProductsWithCategories,
  getFeaturedProducts,
  getProductBySlug,
  getProductsByCategory,
  type ProductCategory,
  type Product,
  type ProductWithCategory,
} from './products';

// Gallery
export {
  getPublicGalleryData,
  getHomepageGalleryImages,
  type PublicGalleryCategory,
  type PublicGalleryImage,
} from './gallery';

// Contact form
export {
  submitContactForm,
  getContactInquiries,
  getContactInquiry,
  updateContactInquiryStatus,
  sendContactReply,
  deleteContactInquiry,
  type ContactFormData,
  type ContactFormResult,
  type ContactInquiry,
  type ContactInquiryStatus,
} from './contact';

// Booking
export {
  getBookingPageData,
  getExistingAppointments,
  getStaffAbsencesForDateRange,
  getBlockedTimes,
  createAppointmentReservation,
  confirmAppointment,
  markAppointmentNoShow,
  markAppointmentCompleted,
  getAdminCalendarAppointments,
  getAdminStaffBlocks,
  adminCreateStaffBlock,
  adminUpdateStaffBlockTime,
  adminDeleteStaffBlock,
  adminCancelAppointment,
  adminConfirmAppointment,
  adminUpdateAppointmentTime,
  adminCreateAppointment,
  adminApproveAppointment,
  adminRecordPayment,
  adminAssignStaff,
  getBookingRulesSettings,
  saveBookingRules,
  getSalonClosures,
  createSalonClosure,
  updateSalonClosure,
  deleteSalonClosure,
  type BookingPageData,
  type BookingRulesSettingsData,
  type SaveBookingRulesInput,
  type SaveBookingRulesResult,
  type CreateReservationResult,
  type NoShowResult,
  type CompleteResult,
  type AdminCalendarAppointment,
  type AdminStaffBlock,
  type AdminCreateStaffBlockInput,
  type AdminStaffBlockMutationResult,
  type AdminCancelResult,
  type AdminConfirmResult,
  type AdminUpdateTimeResult,
  type AdminCreateAppointmentInput,
  type AdminCreateAppointmentResult,
  type AdminApproveResult,
  type AdminRecordPaymentInput,
  type AdminRecordPaymentResult,
  type AdminAssignStaffResult,
  type SalonClosure,
  type CreateSalonClosureInput,
  type CreateSalonClosureResult,
  type UpdateSalonClosureInput,
  type UpdateSalonClosureResult,
  type DeleteSalonClosureResult,
} from './booking';

// Auth
export {
  registerCustomer,
  loginCustomer,
  requestPasswordReset,
  updatePassword,
  getCurrentUser,
  logout,
  type RegisterResult,
  type LoginResult,
  type PasswordResetResult,
} from './auth';

// Customer
export {
  getCustomerAppointments,
  getUpcomingAppointments,
  cancelAppointment,
  getCustomerProfile,
  updateCustomerProfile,
  adminCreateCustomer,
  adminDeleteCustomer,
  adminUpdateCustomer,
  deleteCustomerAccount,
  type CustomerAppointment,
  type CustomerProfile,
  type CancelResult,
  type UpdateProfileResult,
  type AdminCreateCustomerInput,
  type AdminCreateCustomerResult,
  type AdminDeleteCustomerResult,
  type AdminUpdateCustomerInput,
  type AdminUpdateCustomerResult,
  type DeleteAccountResult,
} from './customer';

// Service Management (Admin CRUD)
export {
  getServiceCategories,
  getAllServicesForAdmin,
  createService,
  updateService,
  deleteService,
  restoreService,
  reorderCategories,
  type ServiceForAdmin,
  type CreateServiceInput,
  type UpdateServiceInput,
  type ServiceResult,
} from './services';

// Customer Feedback
export {
  getApprovedFeedback,
  getFeedbackStats,
  submitPublicFeedback,
  getAdminFeedback,
  getPendingFeedbackCount,
  updateFeedbackStatus,
  respondToFeedback,
  deleteFeedback,
  type FeedbackStatus,
  type PublicFeedback,
  type AdminFeedback,
  type SubmitFeedbackInput,
  type SubmitFeedbackResult,
  type UpdateFeedbackStatusResult,
} from './feedback';
