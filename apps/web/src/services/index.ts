/**
 * Service Layer Exports
 * Central export point for all business logic services
 */

import { JobService as JobServiceClass } from './job.service'
import { ApplicationService as ApplicationServiceClass } from './application.service'
import { UserService as UserServiceClass } from './user.service'

// Re-export service classes
export { JobService } from './job.service'
export { ApplicationService } from './application.service'
export { UserService } from './user.service'

// Re-export types
export type {
  CreateJobInput,
  UpdateJobInput,
  JobSearchParams,
} from './job.service'

export type {
  CreateApplicationInput,
  UpdateApplicationInput,
  ApplicationSearchParams,
} from './application.service'

export type {
  CreateUserInput,
  UpdateUserInput,
  ChangePasswordInput,
  UserSearchParams,
} from './user.service'

// Re-export commonly used service methods for convenience
export const services = {
  // Job methods
  createJob: JobServiceClass.createJob,
  updateJob: JobServiceClass.updateJob,
  searchJobs: JobServiceClass.searchJobs,
  getJobById: JobServiceClass.getJobById,
  deleteJob: JobServiceClass.deleteJob,
  getJobStats: JobServiceClass.getJobStats,

  // Application methods
  createApplication: ApplicationServiceClass.createApplication,
  updateApplicationStatus: ApplicationServiceClass.updateApplicationStatus,
  bulkUpdateStatus: ApplicationServiceClass.bulkUpdateStatus,
  searchApplications: ApplicationServiceClass.searchApplications,
  getApplicationById: ApplicationServiceClass.getApplicationById,
  deleteApplication: ApplicationServiceClass.deleteApplication,
  getApplicationStats: ApplicationServiceClass.getApplicationStats,

  // User methods
  createUser: UserServiceClass.createUser,
  updateUser: UserServiceClass.updateUser,
  changePassword: UserServiceClass.changePassword,
  searchUsers: UserServiceClass.searchUsers,
  getUserById: UserServiceClass.getUserById,
  deleteUser: UserServiceClass.deleteUser,
  verifyEmail: UserServiceClass.verifyEmail,
  createPasswordResetToken: UserServiceClass.createPasswordResetToken,
  resetPassword: UserServiceClass.resetPassword,
} as const