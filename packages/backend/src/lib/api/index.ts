// ============================================
// BeautifyPRO API SERVICE LAYER
// ============================================
// Centralized export of all API services

// Base
export {
  BaseService,
  type ServiceResult,
  type ServiceListResult,
  type ServiceError,
  type PaginationParams,
  type SortParams,
  type FilterParams,
  eq,
  neq,
  gt,
  gte,
  lt,
  lte,
  like,
  ilike,
  inArray,
} from './base';

// Salons
export { SalonService, OpeningHoursService } from './salons';

// Customers
export { CustomerService } from './customers';

// Staff
export { StaffService } from './staff';

// Services
export { ServiceService, ServiceCategoryService } from './services';

// Appointments
export { AppointmentService } from './appointments';

// Products
export { ProductService, ProductCategoryService, VoucherService } from './products';

// Orders
export { OrderService } from './orders';

// Payments
export { PaymentService } from './payments';
