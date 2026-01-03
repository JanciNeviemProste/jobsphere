/**
 * E2E Tests - Email Sequence Automation
 *
 * Tests email sequence creation, enrollment, editing, and deletion
 * with BullMQ worker mocking to verify job queueing without actual execution.
 */

import { test, expect } from '@/tests/fixtures/auth'
import { installWorkerMocks, getQueuedJobs, clearQueuedJobs } from '@/tests/mocks/workers'

test.describe('Email Sequences', () => {
  test.beforeEach(async ({ orgAdminUser }) => {
    // Install worker mocks to prevent actual job execution
    await installWorkerMocks(orgAdminUser)
    await clearQueuedJobs(orgAdminUser)
  })

  test.afterEach(async ({ orgAdminUser }) => {
    // Cleanup mock jobs after each test
    await clearQueuedJobs(orgAdminUser)
  })

  test('ORG_ADMIN can create email sequence with multiple steps', async ({ orgAdminUser }) => {
    // Navigate to email sequences page
    await orgAdminUser.goto('/en/employer/sequences')

    // Click "Create Sequence" button
    await orgAdminUser.getByRole('button', { name: /create sequence/i }).click()

    // Fill in sequence details
    await orgAdminUser.getByLabel(/sequence name/i).fill('Welcome Email Series')
    await orgAdminUser
      .getByLabel(/description/i)
      .fill('Automated welcome emails for new candidates')

    // Add first step
    await orgAdminUser.getByRole('button', { name: /add step/i }).click()

    // Fill first step details
    await orgAdminUser.getByLabel(/step.*name/i).first().fill('Day 0: Welcome')
    await orgAdminUser.getByLabel(/day offset/i).first().fill('0')
    await orgAdminUser.getByLabel(/subject/i).first().fill('Welcome to {{companyName}}!')
    await orgAdminUser
      .getByLabel(/body.*template/i)
      .first()
      .fill('Hi {{candidateName}},\n\nWelcome to our hiring process!')

    // Add second step
    await orgAdminUser.getByRole('button', { name: /add step/i }).click()

    // Fill second step details
    const stepInputs = orgAdminUser.getByLabel(/step.*name/i)
    await stepInputs.nth(1).fill('Day 3: Check-in')

    const dayOffsetInputs = orgAdminUser.getByLabel(/day offset/i)
    await dayOffsetInputs.nth(1).fill('3')

    const subjectInputs = orgAdminUser.getByLabel(/subject/i)
    await subjectInputs.nth(1).fill('Quick check-in from {{companyName}}')

    const bodyInputs = orgAdminUser.getByLabel(/body.*template/i)
    await bodyInputs
      .nth(1)
      .fill('Hi {{candidateName}},\n\nJust checking in on your application progress.')

    // Save the sequence
    await orgAdminUser.getByRole('button', { name: /save sequence/i }).click()

    // Verify success message
    await expect(orgAdminUser.getByText(/sequence created successfully/i)).toBeVisible({
      timeout: 10000,
    })

    // Verify sequence appears in list
    await expect(orgAdminUser.getByText('Welcome Email Series')).toBeVisible()
    await expect(orgAdminUser.getByText(/2 steps/i)).toBeVisible()
  })

  test('ORG_ADMIN can view sequence details with all steps', async ({ orgAdminUser }) => {
    // Assumes a sequence exists from seed data or previous test
    await orgAdminUser.goto('/en/employer/sequences')

    // Click on first sequence in the list
    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    // If no sequences exist, skip this test
    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    await firstSequence.click()

    // Verify sequence details page loaded
    await expect(orgAdminUser.getByRole('heading', { name: /sequence details/i })).toBeVisible()

    // Verify steps are displayed
    await expect(orgAdminUser.getByText(/steps/i)).toBeVisible()

    // Verify at least one step is shown
    const steps = orgAdminUser.locator('[data-testid="email-step"]')
    await expect(steps.first()).toBeVisible()
  })

  test('auto-enrolls candidate on status change and queues job', async ({ orgAdminUser }) => {
    // This test assumes:
    // 1. A sequence exists and is active
    // 2. A job exists
    // 3. An application exists with a candidate

    await orgAdminUser.goto('/en/employer/applications')

    // Find first application
    const firstApplication = orgAdminUser.locator('[data-testid="application-row"]').first()

    // If no applications exist, skip this test
    if ((await firstApplication.count()) === 0) {
      test.skip()
      return
    }

    // Click to view application details
    await firstApplication.click()

    // Change application status (this should trigger auto-enrollment)
    await orgAdminUser.getByRole('button', { name: /change status/i }).click()
    await orgAdminUser.getByRole('option', { name: /interview/i }).click()

    // Confirm status change
    await orgAdminUser.getByRole('button', { name: /confirm/i }).click()

    // Wait for status change to be processed
    await expect(orgAdminUser.getByText(/status updated/i)).toBeVisible({ timeout: 10000 })

    // Verify BullMQ job was queued (using mocks)
    const queuedJobs = await getQueuedJobs(orgAdminUser, 'email-sequence')

    // Should have at least one job queued
    expect(queuedJobs.length).toBeGreaterThan(0)

    // Verify job contains enrollment data
    const lastJob = queuedJobs[queuedJobs.length - 1]
    expect(lastJob.name).toBe('send-step')
    expect(lastJob.data).toHaveProperty('enrollmentId')
    expect(lastJob.data).toHaveProperty('stepId')
  })

  test('ORG_ADMIN can manually enroll candidate in sequence', async ({ orgAdminUser }) => {
    // Navigate to candidates page
    await orgAdminUser.goto('/en/employer/candidates')

    // Find first candidate
    const firstCandidate = orgAdminUser.locator('[data-testid="candidate-row"]').first()

    // If no candidates exist, skip this test
    if ((await firstCandidate.count()) === 0) {
      test.skip()
      return
    }

    // Click to view candidate details
    await firstCandidate.click()

    // Click "Enroll in Sequence" button
    await orgAdminUser.getByRole('button', { name: /enroll in sequence/i }).click()

    // Select a sequence from dropdown
    await orgAdminUser.getByRole('combobox', { name: /select sequence/i }).click()
    await orgAdminUser.getByRole('option').first().click()

    // Confirm enrollment
    await orgAdminUser.getByRole('button', { name: /enroll/i }).click()

    // Verify success message
    await expect(orgAdminUser.getByText(/enrolled successfully/i)).toBeVisible({ timeout: 10000 })

    // Verify job was queued
    const queuedJobs = await getQueuedJobs(orgAdminUser, 'email-sequence')
    expect(queuedJobs.length).toBeGreaterThan(0)

    const lastJob = queuedJobs[queuedJobs.length - 1]
    expect(lastJob.name).toBe('send-step')
  })

  test('ORG_ADMIN can edit existing email sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    // Find first sequence
    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    // Click edit button on sequence
    await firstSequence.locator('[data-testid="edit-sequence"]').click()

    // Verify edit form is displayed
    await expect(orgAdminUser.getByRole('heading', { name: /edit sequence/i })).toBeVisible()

    // Update sequence name
    const nameInput = orgAdminUser.getByLabel(/sequence name/i)
    await nameInput.clear()
    await nameInput.fill('Updated Sequence Name')

    // Update description
    const descInput = orgAdminUser.getByLabel(/description/i)
    await descInput.clear()
    await descInput.fill('This is an updated description')

    // Edit first step subject
    const subjectInputs = orgAdminUser.getByLabel(/subject/i)
    const firstSubject = subjectInputs.first()
    await firstSubject.clear()
    await firstSubject.fill('Updated subject line')

    // Save changes
    await orgAdminUser.getByRole('button', { name: /save changes/i }).click()

    // Verify success message
    await expect(orgAdminUser.getByText(/sequence updated successfully/i)).toBeVisible({
      timeout: 10000,
    })

    // Verify updated name appears
    await expect(orgAdminUser.getByText('Updated Sequence Name')).toBeVisible()
  })

  test('ORG_ADMIN can add new step to existing sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    // Edit sequence
    await firstSequence.locator('[data-testid="edit-sequence"]').click()

    // Count existing steps
    const initialSteps = await orgAdminUser.locator('[data-testid="step-editor"]').count()

    // Add new step
    await orgAdminUser.getByRole('button', { name: /add step/i }).click()

    // Verify new step editor appeared
    const updatedSteps = await orgAdminUser.locator('[data-testid="step-editor"]').count()
    expect(updatedSteps).toBe(initialSteps + 1)

    // Fill new step
    const stepInputs = orgAdminUser.getByLabel(/step.*name/i)
    await stepInputs.last().fill('New Follow-up Step')

    const dayOffsetInputs = orgAdminUser.getByLabel(/day offset/i)
    await dayOffsetInputs.last().fill('7')

    const subjectInputs = orgAdminUser.getByLabel(/subject/i)
    await subjectInputs.last().fill('Following up on your application')

    const bodyInputs = orgAdminUser.getByLabel(/body.*template/i)
    await bodyInputs.last().fill('Hi {{candidateName}},\n\nWe wanted to follow up.')

    // Save
    await orgAdminUser.getByRole('button', { name: /save changes/i }).click()

    await expect(orgAdminUser.getByText(/sequence updated successfully/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('ORG_ADMIN can delete email step from sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    // Edit sequence
    await firstSequence.locator('[data-testid="edit-sequence"]').click()

    // Count existing steps
    const initialSteps = await orgAdminUser.locator('[data-testid="step-editor"]').count()

    // Skip if only one step (can't delete the last step)
    if (initialSteps <= 1) {
      test.skip()
      return
    }

    // Delete last step
    const deleteButtons = orgAdminUser.locator('[data-testid="delete-step"]')
    await deleteButtons.last().click()

    // Confirm deletion in modal
    await orgAdminUser.getByRole('button', { name: /confirm/i }).click()

    // Verify step was removed
    const updatedSteps = await orgAdminUser.locator('[data-testid="step-editor"]').count()
    expect(updatedSteps).toBe(initialSteps - 1)

    // Save
    await orgAdminUser.getByRole('button', { name: /save changes/i }).click()

    await expect(orgAdminUser.getByText(/sequence updated successfully/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test('ORG_ADMIN can activate/deactivate sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    // Check current status
    const statusBadge = firstSequence.locator('[data-testid="sequence-status"]')
    const initialStatus = await statusBadge.textContent()

    // Toggle activation
    await firstSequence.locator('[data-testid="toggle-active"]').click()

    // Verify status changed
    await expect(statusBadge).not.toHaveText(initialStatus || '')

    // Toggle back
    await firstSequence.locator('[data-testid="toggle-active"]').click()

    // Verify status returned to original
    await expect(statusBadge).toHaveText(initialStatus || '')
  })

  test('ORG_ADMIN can delete email sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    // Count initial sequences
    const initialCount = await orgAdminUser.locator('[data-testid="sequence-card"]').count()

    if (initialCount === 0) {
      test.skip()
      return
    }

    // Get name of first sequence to verify deletion
    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()
    const sequenceName = await firstSequence.locator('[data-testid="sequence-name"]').textContent()

    // Delete sequence
    await firstSequence.locator('[data-testid="delete-sequence"]').click()

    // Confirm deletion
    await orgAdminUser.getByRole('button', { name: /confirm delete/i }).click()

    // Verify success message
    await expect(orgAdminUser.getByText(/sequence deleted successfully/i)).toBeVisible({
      timeout: 10000,
    })

    // Verify sequence is removed from list
    if (sequenceName) {
      await expect(orgAdminUser.getByText(sequenceName)).not.toBeVisible()
    }

    // Verify count decreased
    const updatedCount = await orgAdminUser.locator('[data-testid="sequence-card"]').count()
    expect(updatedCount).toBe(initialCount - 1)
  })

  test('prevents duplicate enrollment in same sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/candidates')

    const firstCandidate = orgAdminUser.locator('[data-testid="candidate-row"]').first()

    if ((await firstCandidate.count()) === 0) {
      test.skip()
      return
    }

    await firstCandidate.click()

    // First enrollment
    await orgAdminUser.getByRole('button', { name: /enroll in sequence/i }).click()
    await orgAdminUser.getByRole('combobox', { name: /select sequence/i }).click()

    // Get the first sequence name
    const firstOption = orgAdminUser.getByRole('option').first()
    const sequenceName = await firstOption.textContent()
    await firstOption.click()

    await orgAdminUser.getByRole('button', { name: /enroll/i }).click()

    // Wait for first enrollment to complete
    await expect(orgAdminUser.getByText(/enrolled successfully/i)).toBeVisible({ timeout: 10000 })

    // Attempt second enrollment in same sequence
    await orgAdminUser.getByRole('button', { name: /enroll in sequence/i }).click()
    await orgAdminUser.getByRole('combobox', { name: /select sequence/i }).click()

    // Try to select the same sequence
    const sameSequence = orgAdminUser.getByRole('option', { name: sequenceName || '' })

    // Should either be disabled or show error
    if ((await sameSequence.count()) > 0) {
      await sameSequence.click()
      await orgAdminUser.getByRole('button', { name: /enroll/i }).click()

      // Verify error message about duplicate enrollment
      await expect(
        orgAdminUser.getByText(/already enrolled|duplicate enrollment/i)
      ).toBeVisible({ timeout: 10000 })
    }
  })

  test('RECRUITER cannot create or edit sequences', async ({ recruiterUser }) => {
    // Recruiters should not have access to sequence management
    await recruiterUser.goto('/en/employer/sequences')

    // Should either redirect or show "Access Denied"
    await expect(
      recruiterUser.getByRole('button', { name: /create sequence/i })
    ).not.toBeVisible()
  })

  test('displays sequence statistics correctly', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    // Click to view details
    await firstSequence.click()

    // Verify statistics are displayed
    await expect(orgAdminUser.getByText(/active enrollments/i)).toBeVisible()
    await expect(orgAdminUser.getByText(/completed/i)).toBeVisible()
    await expect(orgAdminUser.getByText(/emails sent/i)).toBeVisible()

    // Verify numbers are displayed (should be numeric)
    const activeCount = orgAdminUser.locator('[data-testid="active-enrollments"]')
    await expect(activeCount).toBeVisible()
  })

  test('can preview email template with merge tags replaced', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    await firstSequence.locator('[data-testid="edit-sequence"]').click()

    // Click preview on first step
    const firstStep = orgAdminUser.locator('[data-testid="step-editor"]').first()
    await firstStep.locator('[data-testid="preview-email"]').click()

    // Verify preview modal opened
    await expect(orgAdminUser.getByRole('heading', { name: /email preview/i })).toBeVisible()

    // Verify merge tags are replaced with sample data
    const previewContent = orgAdminUser.locator('[data-testid="email-preview-content"]')
    await expect(previewContent).toBeVisible()

    // Should not contain raw merge tags
    const content = await previewContent.textContent()
    expect(content).not.toContain('{{candidateName}}')
    expect(content).not.toContain('{{companyName}}')
  })

  test('validates required fields when creating sequence', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    await orgAdminUser.getByRole('button', { name: /create sequence/i }).click()

    // Try to save without filling required fields
    await orgAdminUser.getByRole('button', { name: /save sequence/i }).click()

    // Should show validation errors
    await expect(orgAdminUser.getByText(/name is required/i)).toBeVisible()
    await expect(orgAdminUser.getByText(/at least one step/i)).toBeVisible()
  })

  test('validates step fields when adding step', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    await orgAdminUser.getByRole('button', { name: /create sequence/i }).click()

    // Fill sequence name
    await orgAdminUser.getByLabel(/sequence name/i).fill('Test Sequence')

    // Add step but leave fields empty
    await orgAdminUser.getByRole('button', { name: /add step/i }).click()

    // Try to save
    await orgAdminUser.getByRole('button', { name: /save sequence/i }).click()

    // Should show validation errors for step fields
    await expect(orgAdminUser.getByText(/subject is required/i)).toBeVisible()
    await expect(orgAdminUser.getByText(/body.*required/i)).toBeVisible()
  })

  test('reorders steps using drag and drop', async ({ orgAdminUser }) => {
    await orgAdminUser.goto('/en/employer/sequences')

    const firstSequence = orgAdminUser.locator('[data-testid="sequence-card"]').first()

    if ((await firstSequence.count()) === 0) {
      test.skip()
      return
    }

    await firstSequence.locator('[data-testid="edit-sequence"]').click()

    // Check if we have at least 2 steps
    const stepCount = await orgAdminUser.locator('[data-testid="step-editor"]').count()

    if (stepCount < 2) {
      test.skip()
      return
    }

    // Get text of first step
    const firstStepName = await orgAdminUser
      .locator('[data-testid="step-editor"]')
      .first()
      .locator('[data-testid="step-name"]')
      .textContent()

    // Drag first step to second position
    const firstStep = orgAdminUser.locator('[data-testid="step-editor"]').first()
    const secondStep = orgAdminUser.locator('[data-testid="step-editor"]').nth(1)

    await firstStep.dragTo(secondStep)

    // Verify order changed
    const newFirstStepName = await orgAdminUser
      .locator('[data-testid="step-editor"]')
      .first()
      .locator('[data-testid="step-name"]')
      .textContent()

    expect(newFirstStepName).not.toBe(firstStepName)

    // Save
    await orgAdminUser.getByRole('button', { name: /save changes/i }).click()

    await expect(orgAdminUser.getByText(/sequence updated successfully/i)).toBeVisible({
      timeout: 10000,
    })
  })
})
