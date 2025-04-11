# ANS2BOT Ansible Collections bot

![collection](https://img.shields.io/badge/ansible%20collections-bot-blue?logo=ansible&logoColor=white) ![Endpoint Badge](https://img.shields.io/endpoint?url=https%3A%2F%2Fwebhook.3a2bot.com%2Fhealth&logo=dependabot)


ANS2BOT is a GitHub bot designed to automate and streamline the management of Ansible Collections repositories. 

It helps maintainers and contributors by handling common tasks like pull request reviews, issue management, and workflow checks.

## Features

- Automated PR review process
- Issue and PR labeling
- Component management
- Maintainer notifications
- CI/CD workflow analysis ( ansible-test GitHub Actions )
- Status tracking

## Requirements

- `Node.js` >= 16
- GitHub App credentials
- GitHub webhook secret
- `.env` file with proper configuration
- `.github/BOTMETA.yml` file in the repository

## Installation

1. Clone the repository:
```bash
git clone https://github.com/3A2DEV/ANS2BOT.git
cd ANS2BOT
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file with required configuration:
```env
# GitHub App ID
APP_ID=your_app_id
# GitHub App private key
PRIVATE_KEY_PATH=path_to_private_key.pem
# The webhook secret
WEBHOOK_SECRET=your_webhook_secret
# Open Port
PORT=3000
# Log Level
LOG_LEVEL=debug
```

4. Build and start the bot:
```bash
npm run build
npm start
```

## Commands

ANS2BOT supports the following commands in issues and pull requests:

### Label Management
- `/label <label-name>` - Add a label to the issue/PR
- `/unlabel <label-name>` - Remove a label from the issue/PR

### Component Management
- `/component <path>` - Specify or update the component path for an issue/PR

### PR Review
- `LGTM` or `/lgtm` - Approve a pull request (requires proper authorization)

## Authorization Levels

- **Team Admins**: Can approve any PR
- **Component Maintainers**: Can approve PRs that modify files they maintain
- **Regular Contributors**: Can comment but cannot approve PRs

## BOTMETA.yml Configuration

The bot requires a `.github/BOTMETA.yml` file in your repository with the following structure:

```yaml
files:
  path/to/component:
    maintainers: 
      - username1
      - username2
macros:
  team_admin: adminUsername
```

## Labels

The bot manages several types of labels:

### Status Labels
- `needs_triage` - New issues/PRs requiring attention
- `needs_review` - PRs ready for review
- `needs_revision` - PRs requiring changes
- `success` - PRs passing all checks

### Component Labels
- `plugin` - Plugin-related changes.
- `module` - Module-related changes.
- `docs` - Documentation changes.
- `docsite` - Docsite Documentation changes.
- `tests` - Test-related changes.
- `integration` - Ansible-test integration changes.
- `github` - .github changes.
- `github_action` - .github/workflows changes.

### Issues/PRs Labels
- `bug` - Bug Report issues or PRs.
- `feature` - Future request issues or PRs.
- `documentation` - Documentation issues or PRs.
- `testing` - Test PRs.
- `new_plugin` - New Plugin PRs.
- `new_module` - New Module PRs.
- `refactor` - Refactoring PRs.


## Repository Labels
- `backport-10` - Backport to `Stable-10` for Patchback bot.

## Workflow Integration

The bot automatically:
1. Analyzes CI/CD workflow results ( ansible-test GitHub Actions )
2. Posts detailed error reports for failed tests
3. Updates PR labels based on test results
4. Notifies relevant maintainers

## Error Handling

The bot provides detailed error feedback for:
- Python test failures
- YAML parsing errors
- Ansible task failures
- Ansible Sanity, Units and Integration test issues

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Development Mode
```bash
npm run dev
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues and feature requests, please use the GitHub issue tracker.
