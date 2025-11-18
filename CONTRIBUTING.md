# Contributing to JobSphere

Thank you for your interest in contributing to JobSphere! This document provides guidelines and instructions for contributing to the project.

## 🎯 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ and Yarn
- PostgreSQL database
- Git
- VS Code (recommended)

### Setting Up Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/jobsphere.git
   cd jobsphere
   ```

2. **Install dependencies**
   ```bash
   yarn install
   ```

3. **Set up environment variables**
   ```bash
   cp apps/web/.env.example apps/web/.env
   # Edit .env with your local configuration
   ```

4. **Set up database**
   ```bash
   cd apps/web
   yarn prisma migrate dev
   yarn prisma db seed
   ```

5. **Start development server**
   ```bash
   yarn dev
   ```

## 📝 Development Workflow

### Branch Naming Convention

Use descriptive branch names with the following prefixes:

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding or updating tests
- `chore/` - Maintenance tasks

**Examples:**
```bash
feat/add-user-dashboard
fix/resolve-login-issue
docs/update-readme
refactor/optimize-api-routes
test/add-user-service-tests
chore/update-dependencies
```

### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements
- `ci`: CI/CD changes
- `build`: Build system changes
- `revert`: Revert previous commit

**Examples:**
```bash
feat(auth): add Google OAuth integration
fix(api): resolve rate limiting issue
docs(readme): update deployment instructions
test(services): add unit tests for JobService
refactor(components): extract reusable Button component
```

### Pre-commit Hooks

The project uses Husky for pre-commit hooks that automatically:

1. **Lint and format code** with ESLint and Prettier
2. **Type check** TypeScript files
3. **Validate commit messages** against conventional commits

These hooks ensure code quality before commits are made.

## 🧪 Testing Guidelines

### Writing Tests

- All new features must include tests
- Aim for 80%+ code coverage
- Use descriptive test names
- Follow the Arrange-Act-Assert pattern

**Example:**
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    it('should create user with valid data', async () => {
      // Arrange
      const userData = {
        email: 'test@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      }

      // Act
      const user = await UserService.createUser(userData)

      // Assert
      expect(user).toBeDefined()
      expect(user.email).toBe(userData.email)
    })

    it('should throw error for duplicate email', async () => {
      // Arrange
      const userData = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
        name: 'Test User'
      }

      // Act & Assert
      await expect(UserService.createUser(userData))
        .rejects
        .toThrow('User with this email already exists')
    })
  })
})
```

### Running Tests

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage

# Run tests with UI
yarn test:ui
```

## 📐 Code Style Guidelines

### TypeScript

- **Use strict TypeScript** - No `any` types
- **Prefer interfaces** over types for object shapes
- **Use const assertions** for literal types
- **Export types separately** from values

```typescript
// ✅ Good
interface User {
  id: string
  email: string
  name: string
}

export type { User }
export const createUser = (data: User) => { ... }

// ❌ Bad
type User = any
export const createUser = (data: any) => { ... }
```

### React Components

- **Use functional components** with hooks
- **Prefer named exports** over default exports
- **Extract reusable logic** into custom hooks
- **Keep components small** and focused

```typescript
// ✅ Good
export function UserProfile({ userId }: { userId: string }) {
  const { user, isLoading } = useUser(userId)

  if (isLoading) return <Spinner />
  if (!user) return <NotFound />

  return <div>{user.name}</div>
}

// ❌ Bad
export default function Component(props: any) {
  // 200 lines of code...
}
```

### File Organization

```
src/
├── app/              # Next.js app router
├── components/       # React components
│   ├── ui/          # Reusable UI components
│   └── features/    # Feature-specific components
├── lib/             # Utilities and helpers
├── services/        # Business logic layer
├── schemas/         # Zod validation schemas
└── types/           # TypeScript type definitions
```

### API Routes

- **Use Service Layer** for business logic
- **Validate inputs** with Zod schemas
- **Apply rate limiting** appropriately
- **Use proper HTTP status codes**
- **Handle errors gracefully**

```typescript
// ✅ Good
export const POST = withRateLimit(
  async (req: Request) => {
    try {
      const { userId, orgId } = await requireAuth()
      const data = await validateRequest(req, createJobSchema)

      const job = await JobService.createJob(data, userId, orgId)

      return NextResponse.json(job, { status: 201 })
    } catch (error) {
      return handleApiError(error)
    }
  },
  { preset: 'api', byUser: true }
)

// ❌ Bad
export async function POST(req: Request) {
  const data = await req.json()
  const job = await prisma.job.create({ data })
  return NextResponse.json(job)
}
```

## 🔒 Security Best Practices

1. **Never commit secrets** to the repository
2. **Validate all inputs** with Zod schemas
3. **Use parameterized queries** (Prisma handles this)
4. **Sanitize user-generated content**
5. **Apply rate limiting** to all API routes
6. **Encrypt sensitive data** before storage
7. **Use HTTPS only** in production
8. **Implement proper CORS** policies

## 📋 Pull Request Process

1. **Create a feature branch** from `main`
   ```bash
   git checkout -b feat/your-feature-name
   ```

2. **Make your changes** following the guidelines above

3. **Write tests** for your changes

4. **Ensure all tests pass**
   ```bash
   yarn test
   yarn typecheck
   yarn lint
   ```

5. **Commit your changes** with conventional commits
   ```bash
   git add .
   git commit -m "feat: add user dashboard"
   ```

6. **Push to your fork**
   ```bash
   git push origin feat/your-feature-name
   ```

7. **Create a Pull Request** on GitHub
   - Use a clear and descriptive title
   - Reference any related issues
   - Provide a detailed description of changes
   - Include screenshots for UI changes

8. **Address review feedback** if requested

### Pull Request Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Related Issues
Closes #123

## Changes Made
- Added user dashboard component
- Implemented data fetching logic
- Added tests for new functionality

## Testing
- [ ] All tests pass
- [ ] Added new tests
- [ ] Tested manually

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings generated
- [ ] Tests added/updated
- [ ] All tests passing
```

## 🐛 Reporting Bugs

### Before Submitting

1. **Check existing issues** to avoid duplicates
2. **Try to reproduce** the bug consistently
3. **Gather relevant information** (browser, OS, steps to reproduce)

### Bug Report Template

```markdown
## Bug Description
Clear and concise description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. Scroll down to '...'
4. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- Browser: Chrome 120
- OS: macOS 14
- Node: 20.11.0
- Version: 1.0.0

## Screenshots
[Add screenshots if applicable]

## Additional Context
Any other relevant information.
```

## 💡 Feature Requests

### Feature Request Template

```markdown
## Feature Description
Clear and concise description of the feature.

## Problem Statement
What problem does this solve?

## Proposed Solution
How should this work?

## Alternatives Considered
What other approaches did you consider?

## Additional Context
Any other relevant information.
```

## 📚 Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Update API documentation for new endpoints
- Create examples for new features

## 🎨 UI/UX Guidelines

- Follow existing design patterns
- Ensure mobile responsiveness
- Use shadcn/ui components when possible
- Test on multiple browsers
- Consider accessibility (WCAG 2.1 AA)

## 🔄 Review Process

### What We Look For

1. **Code Quality**
   - Follows style guidelines
   - Well-structured and readable
   - Properly typed (no `any`)
   - No unnecessary complexity

2. **Testing**
   - Adequate test coverage
   - Tests are meaningful
   - Edge cases considered

3. **Security**
   - No security vulnerabilities
   - Proper input validation
   - No sensitive data exposure

4. **Performance**
   - No performance regressions
   - Efficient algorithms
   - Proper caching where applicable

5. **Documentation**
   - Code is well-commented
   - README updated if needed
   - API docs updated

## 🙏 Recognition

Contributors will be recognized in:
- README.md Contributors section
- Release notes
- Project website (if applicable)

## 📞 Getting Help

- **GitHub Discussions** - Ask questions and discuss ideas
- **GitHub Issues** - Report bugs or request features
- **Documentation** - Check docs/ folder for guides

## 📝 License

By contributing to JobSphere, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to JobSphere! 🚀
