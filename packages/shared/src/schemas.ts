import { z } from 'zod'

// ─── Enums ─────────────────────────────────────────────────────────────────

export const FeedbackTypeEnum = z.enum(['BUG', 'FEATURE', 'GENERAL', 'PRAISE'])
export type FeedbackType = z.infer<typeof FeedbackTypeEnum>

export const FeedbackStatusEnum = z.enum(['NEW', 'IN_PROGRESS', 'RESOLVED', 'ARCHIVED'])
export type FeedbackStatus = z.infer<typeof FeedbackStatusEnum>

export const PriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
export type Priority = z.infer<typeof PriorityEnum>

// ─── Feedback ──────────────────────────────────────────────────────────────

export const createFeedbackSchema = z.object({
  type: FeedbackTypeEnum,
  body: z.string().min(1, 'Feedback cannot be empty').max(5000),
  title: z.string().max(255).optional(),

  // Page context (auto-captured by widget)
  pageUrl: z.string().url().optional(),
  pageTitle: z.string().optional(),
  userAgent: z.string().optional(),
  browser: z.string().optional(),
  os: z.string().optional(),
  screenWidth: z.number().int().positive().optional(),
  screenHeight: z.number().int().positive().optional(),
  viewportWidth: z.number().int().positive().optional(),
  viewportHeight: z.number().int().positive().optional(),
  consoleLogs: z.array(z.unknown()).optional(),
  networkErrors: z.array(z.unknown()).optional(),

  // End-user identity (set by SDK)
  endUserId: z.string().optional(),
  endUserEmail: z.string().email().optional(),
  endUserName: z.string().optional(),
  endUserMetadata: z.record(z.unknown()).optional(),
})

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>

export const updateFeedbackSchema = z.object({
  status: FeedbackStatusEnum.optional(),
  priority: PriorityEnum.optional(),
  title: z.string().max(255).optional(),
})

export type UpdateFeedbackInput = z.infer<typeof updateFeedbackSchema>

// ─── Project ───────────────────────────────────────────────────────────────

export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  allowedOrigins: z.array(z.string().url()).default([]),
  themeColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color')
    .optional(),
})

export type CreateProjectInput = z.infer<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema.partial()
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>

// ─── Auth ──────────────────────────────────────────────────────────────────

export const signUpSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export type SignUpInput = z.infer<typeof signUpSchema>

export const signInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export type SignInInput = z.infer<typeof signInSchema>

// ─── Comment ───────────────────────────────────────────────────────────────

export const createCommentSchema = z.object({
  body: z.string().min(1).max(2000),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>
