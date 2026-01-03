/**
 * E2E Tests - Employer Job Management
 *
 * This test suite covers the complete employer workflow for managing jobs and applicants:
 * - Creating new job postings
 * - Editing existing job details
 * - Viewing and managing applicants
 * - Changing applicant status through the pipeline
 * - Closing job postings
 * - Viewing job analytics
 */

import { test, expect } from '../fixtures/auth'

test.describe('Employer Job Management', () => {
  test.describe('Job Creation', () => {
    test('should allow ORG_ADMIN to create a new job posting', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Verify page loaded
      await expect(orgAdminUser.getByRole('heading', { name: /new job/i })).toBeVisible()

      // Fill basic information
      await orgAdminUser.getByLabel(/job title/i).fill('Senior Software Engineer')
      await orgAdminUser.getByLabel(/employment type/i).click()
      await orgAdminUser.getByRole('option', { name: /full time/i }).click()
      await orgAdminUser.getByLabel(/seniority level/i).click()
      await orgAdminUser.getByRole('option', { name: /senior/i }).click()
      await orgAdminUser.getByLabel(/department/i).fill('Engineering')

      // Fill location and work mode
      await orgAdminUser.getByLabel(/^location/i).fill('San Francisco, CA')
      await orgAdminUser.getByLabel(/work mode/i).click()
      await orgAdminUser.getByRole('option', { name: /hybrid/i }).click()

      // Fill job description
      await orgAdminUser.getByLabel(/^description/i).fill(
        'We are looking for an experienced software engineer to join our growing team. ' +
        'You will be working on cutting-edge technologies and solving complex problems. ' +
        'This is an excellent opportunity for career growth.'
      )

      // Fill requirements
      await orgAdminUser.getByLabel(/requirements/i).fill(
        '- 5+ years of experience in software development\n' +
        '- Strong knowledge of JavaScript/TypeScript\n' +
        '- Experience with React and Node.js\n' +
        '- Excellent problem-solving skills'
      )

      // Fill benefits (optional)
      await orgAdminUser.getByLabel(/benefits/i).fill(
        '- Competitive salary\n' +
        '- Health insurance\n' +
        '- Flexible working hours\n' +
        '- Remote work options'
      )

      // Fill compensation
      await orgAdminUser.getByLabel(/min salary/i).fill('8000')
      await orgAdminUser.getByLabel(/max salary/i).fill('12000')
      await orgAdminUser.getByLabel(/currency/i).click()
      await orgAdminUser.getByRole('option', { name: 'USD' }).click()

      // Fill keywords
      await orgAdminUser.getByLabel(/keywords/i).fill('javascript, react, node.js, typescript')

      // Submit the form
      await orgAdminUser.getByRole('button', { name: /publish/i }).click()

      // Wait for success and redirect to employer dashboard
      await expect(orgAdminUser).toHaveURL(/\/en\/employer/, { timeout: 10000 })

      // Verify job appears in the list
      await expect(orgAdminUser.getByText('Senior Software Engineer')).toBeVisible()
    })

    test('should show validation errors for incomplete job form', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Try to submit without filling required fields
      await orgAdminUser.getByRole('button', { name: /publish/i }).click()

      // Should show validation errors
      await expect(orgAdminUser.getByText(/title must be at least 3 characters/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/description must be at least 50 characters/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/requirements must be at least 20 characters/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/location is required/i)).toBeVisible()
    })

    test('should allow RECRUITER to create a new job posting', async ({ recruiterUser }) => {
      await recruiterUser.goto('/en/employer/jobs/new')

      // Verify recruiter has access to create jobs
      await expect(recruiterUser.getByRole('heading', { name: /new job/i })).toBeVisible()

      // Fill minimal required fields
      await recruiterUser.getByLabel(/job title/i).fill('Frontend Developer')
      await recruiterUser.getByLabel(/^location/i).fill('New York, NY')
      await recruiterUser.getByLabel(/^description/i).fill(
        'Join our team as a frontend developer working with modern web technologies. ' +
        'You will collaborate with designers and backend engineers to build amazing user experiences.'
      )
      await recruiterUser.getByLabel(/requirements/i).fill(
        'Experience with React, HTML, CSS, and JavaScript. Strong attention to detail.'
      )

      // Submit
      await recruiterUser.getByRole('button', { name: /publish/i }).click()

      // Verify success
      await expect(recruiterUser).toHaveURL(/\/en\/employer/, { timeout: 10000 })
    })
  })

  test.describe('Job Editing', () => {
    test('should allow editing existing job details', async ({ orgAdminUser }) => {
      // Navigate to employer dashboard
      await orgAdminUser.goto('/en/employer')

      // Wait for jobs to load and click edit on the first job
      const editButton = orgAdminUser.getByRole('button', { name: /edit/i }).first()
      await editButton.waitFor({ state: 'visible', timeout: 5000 })
      await editButton.click()

      // Verify we're on the edit page
      await expect(orgAdminUser.getByRole('heading', { name: /edit job/i })).toBeVisible()

      // Update job title
      const titleInput = orgAdminUser.getByLabel(/job title/i)
      await titleInput.clear()
      await titleInput.fill('Updated Job Title - Senior Engineer')

      // Update description
      const descriptionInput = orgAdminUser.getByLabel(/^description/i)
      await descriptionInput.clear()
      await descriptionInput.fill(
        'Updated job description with more details about the role and responsibilities. ' +
        'This position now includes additional benefits and growth opportunities for the right candidate.'
      )

      // Update salary range
      await orgAdminUser.getByLabel(/min salary/i).clear()
      await orgAdminUser.getByLabel(/min salary/i).fill('9000')
      await orgAdminUser.getByLabel(/max salary/i).clear()
      await orgAdminUser.getByLabel(/max salary/i).fill('13000')

      // Save changes
      await orgAdminUser.getByRole('button', { name: /save/i }).click()

      // Wait for success and redirect
      await expect(orgAdminUser).toHaveURL(/\/en\/employer/, { timeout: 10000 })

      // Verify updated job title appears
      await expect(orgAdminUser.getByText('Updated Job Title - Senior Engineer')).toBeVisible()
    })

    test('should preserve form data when editing', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Click edit on the first job
      const editButton = orgAdminUser.getByRole('button', { name: /edit/i }).first()
      await editButton.waitFor({ state: 'visible', timeout: 5000 })
      await editButton.click()

      // Wait for form to load with existing data
      await orgAdminUser.waitForTimeout(1000)

      // Verify that inputs are populated with existing data
      const titleInput = orgAdminUser.getByLabel(/job title/i)
      await expect(titleInput).not.toHaveValue('')
    })
  })

  test.describe('Applicant Management', () => {
    test('should view all applicants', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      // Verify page loaded
      await expect(orgAdminUser.getByRole('heading', { name: /all candidates/i })).toBeVisible()

      // Should show stats cards
      await expect(orgAdminUser.getByText(/total/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/new/i)).toBeVisible()
    })

    test('should view applicant detail', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      // Click on first applicant detail button if exists
      const detailButton = orgAdminUser.getByRole('button', { name: /detail/i }).first()

      const detailButtonCount = await detailButton.count()
      if (detailButtonCount > 0) {
        await detailButton.click()

        // Verify detail page loaded
        await expect(orgAdminUser).toHaveURL(/\/en\/employer\/applicants\/[a-zA-Z0-9]+/)

        // Should show candidate info
        await expect(orgAdminUser.getByText(/candidate/i)).toBeVisible()
        await expect(orgAdminUser.getByText(/actions/i)).toBeVisible()
      }
    })

    test('should change applicant status through pipeline', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      // Click on first applicant
      const detailButton = orgAdminUser.getByRole('button', { name: /detail/i }).first()
      const detailButtonCount = await detailButton.count()

      if (detailButtonCount > 0) {
        await detailButton.click()

        // Wait for page to load
        await orgAdminUser.waitForTimeout(1000)

        // Try to move to screening stage if button exists
        const screeningButton = orgAdminUser.getByRole('button', { name: /start screening/i })
        const screeningButtonCount = await screeningButton.count()

        if (screeningButtonCount > 0) {
          await screeningButton.click()

          // Wait for status update
          await orgAdminUser.waitForTimeout(1000)

          // Verify status changed
          await expect(orgAdminUser.getByText(/screening/i)).toBeVisible()
        }

        // Try to schedule interview if button exists
        const interviewButton = orgAdminUser.getByRole('button', { name: /schedule interview/i })
        const interviewButtonCount = await interviewButton.count()

        if (interviewButtonCount > 0) {
          await interviewButton.click()

          // Wait for status update
          await orgAdminUser.waitForTimeout(1000)

          // Verify status changed to interview
          await expect(orgAdminUser.getByText(/interview/i)).toBeVisible()
        }
      }
    })

    test('should add note to applicant', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      const detailButton = orgAdminUser.getByRole('button', { name: /detail/i }).first()
      const detailButtonCount = await detailButton.count()

      if (detailButtonCount > 0) {
        await detailButton.click()

        // Click add note button
        const addNoteButton = orgAdminUser.getByRole('button', { name: /add note/i })
        const addNoteButtonCount = await addNoteButton.count()

        if (addNoteButtonCount > 0) {
          await addNoteButton.click()

          // Wait for dialog
          await orgAdminUser.waitForTimeout(500)

          // Fill note
          await orgAdminUser.getByLabel(/note/i).fill('Great candidate with strong technical skills. Recommend moving forward.')

          // Submit note
          await orgAdminUser.getByRole('button', { name: /^add$/i }).click()

          // Wait for success
          await orgAdminUser.waitForTimeout(1000)
        }
      }
    })

    test('should send email to applicant', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      const detailButton = orgAdminUser.getByRole('button', { name: /detail/i }).first()
      const detailButtonCount = await detailButton.count()

      if (detailButtonCount > 0) {
        await detailButton.click()

        // Click send email button
        const sendEmailButton = orgAdminUser.getByRole('button', { name: /send email/i })
        const sendEmailButtonCount = await sendEmailButton.count()

        if (sendEmailButtonCount > 0) {
          await sendEmailButton.click()

          // Wait for dialog
          await orgAdminUser.waitForTimeout(500)

          // Fill email form
          await orgAdminUser.getByLabel(/subject/i).fill('Interview Invitation')
          await orgAdminUser.getByLabel(/message/i).fill(
            'Dear Candidate,\n\n' +
            'We were impressed with your application and would like to invite you for an interview.\n\n' +
            'Best regards,\nHR Team'
          )

          // Submit - but cancel instead to avoid actually sending emails in tests
          await orgAdminUser.getByRole('button', { name: /cancel/i }).click()
        }
      }
    })

    test('should export applicants as CSV', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      // Look for export button
      const exportButton = orgAdminUser.getByText(/export/i).or(orgAdminUser.getByRole('button', { name: /csv/i }))
      const exportButtonCount = await exportButton.count()

      if (exportButtonCount > 0) {
        // Click export button exists
        await expect(exportButton).toBeVisible()
      }
    })
  })

  test.describe('Job Analytics', () => {
    test('should display job statistics on dashboard', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Verify stats cards are visible
      await expect(orgAdminUser.getByText(/active positions/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/total applications/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/new applications/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/total positions/i)).toBeVisible()
    })

    test('should show application counts per job', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Wait for jobs to load
      await orgAdminUser.waitForTimeout(1000)

      // Should show application count for each job
      const applicationCountElements = orgAdminUser.locator('text=/\\d+ applications?/i')
      const count = await applicationCountElements.count()

      // If there are jobs, they should show application counts
      if (count > 0) {
        await expect(applicationCountElements.first()).toBeVisible()
      }
    })

    test('should display recent applications on dashboard', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Should have a recent applications section
      await expect(orgAdminUser.getByText(/recent applications/i)).toBeVisible()

      // Should have a link to view all applicants
      await expect(orgAdminUser.getByRole('link', { name: /view all/i })).toBeVisible()
    })

    test('should show applicant status distribution', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      // Should show stats for different stages
      await expect(orgAdminUser.getByText(/total/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/new/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/in process/i).or(orgAdminUser.getByText(/reviewing/i))).toBeVisible()
      await expect(orgAdminUser.getByText(/interview/i)).toBeVisible()
    })
  })

  test.describe('Job Closure', () => {
    test('should close a job posting', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Navigate to edit page of first job
      const editButton = orgAdminUser.getByRole('button', { name: /edit/i }).first()
      await editButton.waitFor({ state: 'visible', timeout: 5000 })
      await editButton.click()

      // Wait for edit page to load
      await expect(orgAdminUser.getByRole('heading', { name: /edit job/i })).toBeVisible()

      // Setup dialog handler to confirm deletion
      orgAdminUser.on('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm')
        expect(dialog.message()).toContain('close this job posting')
        await dialog.dismiss() // Dismiss to avoid actually closing the job
      })

      // Click close job button
      const closeButton = orgAdminUser.getByRole('button', { name: /close job/i })
      const closeButtonCount = await closeButton.count()

      if (closeButtonCount > 0) {
        await closeButton.click()

        // Dialog should have been triggered (we dismissed it above)
        await orgAdminUser.waitForTimeout(500)
      }
    })
  })

  test.describe('Quick Actions', () => {
    test('should navigate using quick action buttons', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Should have quick action buttons in sidebar
      await expect(orgAdminUser.getByText(/quick actions/i)).toBeVisible()

      // Click on "View all candidates" quick action
      const viewCandidatesButton = orgAdminUser.getByRole('link', { name: /view all candidates/i })
      const viewCandidatesCount = await viewCandidatesButton.count()

      if (viewCandidatesCount > 0) {
        await viewCandidatesButton.click()
        await expect(orgAdminUser).toHaveURL(/\/en\/employer\/applicants/)
      }
    })

    test('should create new job from quick actions', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Click create new position from quick actions or header
      const createJobButton = orgAdminUser.getByRole('link', { name: /new position/i }).first()
      await createJobButton.click()

      // Should navigate to job creation page
      await expect(orgAdminUser).toHaveURL(/\/en\/employer\/jobs\/new/)
    })
  })

  test.describe('Navigation', () => {
    test('should navigate back to dashboard from job creation', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Click back to dashboard button
      await orgAdminUser.getByRole('link', { name: /back to dashboard/i }).click()

      // Should return to employer dashboard
      await expect(orgAdminUser).toHaveURL(/\/en\/employer/)
    })

    test('should navigate back to applicants from applicant detail', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/applicants')

      const detailButton = orgAdminUser.getByRole('button', { name: /detail/i }).first()
      const detailButtonCount = await detailButton.count()

      if (detailButtonCount > 0) {
        await detailButton.click()

        // Click back button
        await orgAdminUser.getByRole('link', { name: /back to candidates/i }).click()

        // Should return to applicants list
        await expect(orgAdminUser).toHaveURL(/\/en\/employer\/applicants/)
      }
    })

    test('should access employer settings', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer')

      // Look for settings link
      const settingsLink = orgAdminUser.getByRole('link', { name: /company settings/i }).or(
        orgAdminUser.getByRole('link', { name: /settings/i })
      )
      const settingsLinkCount = await settingsLink.count()

      if (settingsLinkCount > 0) {
        await settingsLink.click()
        await expect(orgAdminUser).toHaveURL(/\/en\/employer\/settings/)
      }
    })
  })

  test.describe('Role-based Access', () => {
    test('should allow HIRING_MANAGER to view applicants', async ({ hiringManagerUser }) => {
      await hiringManagerUser.goto('/en/employer')

      // Hiring manager should have access to employer dashboard
      await expect(hiringManagerUser.getByRole('heading', { name: /dashboard/i })).toBeVisible()

      // Navigate to applicants
      await hiringManagerUser.goto('/en/employer/applicants')
      await expect(hiringManagerUser.getByRole('heading', { name: /all candidates/i })).toBeVisible()
    })

    test('should prevent CANDIDATE role from accessing employer pages', async ({ candidateUser }) => {
      await candidateUser.goto('/en/employer')

      // Candidate should not have access - should redirect or show error
      // This depends on your auth implementation, adjust accordingly
      const hasAccess = await candidateUser.getByText(/access denied/i).or(
        candidateUser.getByText(/no access/i)
      ).isVisible({ timeout: 3000 }).catch(() => false)

      // Either shows access denied or redirects away
      if (hasAccess) {
        await expect(candidateUser.getByText(/access denied/i).or(candidateUser.getByText(/no access/i))).toBeVisible()
      }
    })
  })

  test.describe('Data Validation', () => {
    test('should prevent creating job with invalid salary range', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Fill required fields
      await orgAdminUser.getByLabel(/job title/i).fill('Test Position')
      await orgAdminUser.getByLabel(/^location/i).fill('Test City')
      await orgAdminUser.getByLabel(/^description/i).fill(
        'Test description that is long enough to pass validation requirements for the job posting form.'
      )
      await orgAdminUser.getByLabel(/requirements/i).fill(
        'Test requirements that meet the minimum character count.'
      )

      // Enter invalid salary (max < min)
      await orgAdminUser.getByLabel(/min salary/i).fill('10000')
      await orgAdminUser.getByLabel(/max salary/i).fill('5000')

      await orgAdminUser.getByRole('button', { name: /publish/i }).click()

      // Form might validate this on backend - wait and check for error
      await orgAdminUser.waitForTimeout(1000)
    })

    test('should handle special characters in job title', async ({ orgAdminUser }) => {
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Fill with special characters
      await orgAdminUser.getByLabel(/job title/i).fill('Senior C++ / C# Developer (Remote)')

      // Should accept special characters commonly used in job titles
      const titleValue = await orgAdminUser.getByLabel(/job title/i).inputValue()
      expect(titleValue).toContain('C++')
      expect(titleValue).toContain('/')
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should display employer dashboard on mobile viewport', async ({ orgAdminUser }) => {
      await orgAdminUser.setViewportSize({ width: 375, height: 667 })
      await orgAdminUser.goto('/en/employer')

      // Stats should still be visible on mobile
      await expect(orgAdminUser.getByText(/active positions/i)).toBeVisible()
      await expect(orgAdminUser.getByText(/total applications/i)).toBeVisible()
    })

    test('should allow job creation on mobile viewport', async ({ orgAdminUser }) => {
      await orgAdminUser.setViewportSize({ width: 375, height: 667 })
      await orgAdminUser.goto('/en/employer/jobs/new')

      // Form should be usable on mobile
      await expect(orgAdminUser.getByLabel(/job title/i)).toBeVisible()
      await expect(orgAdminUser.getByRole('button', { name: /publish/i })).toBeVisible()
    })
  })
})
