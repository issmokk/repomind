import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsTab } from './settings-tab';
import type { RepositorySettings } from '@/types/repository';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('./webhook-setup-guide', () => ({
  WebhookSetupGuide: () => <div data-testid="webhook-setup-guide">Webhook Guide</div>,
}));

function makeSettings(overrides: Partial<RepositorySettings> = {}): RepositorySettings {
  return {
    id: 'settings-1',
    repoId: 'repo-1',
    branchFilter: ['main'],
    includePatterns: [],
    excludePatterns: ['node_modules/**'],
    embeddingProvider: 'openai',
    embeddingModel: 'text-embedding-3-small',
    indexingMethod: 'manual',
    cronInterval: '24h',
    autoIndexOnAdd: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-06-01T12:00:00Z',
    ...overrides,
  };
}

const defaultProps = {
  repoId: 'repo-1',
  fullName: 'owner/repo',
  githubAuthType: 'pat' as const,
  settings: makeSettings(),
  mutateSettings: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify({ success: true }), { status: 200 })),
  ) as unknown as typeof fetch;
});

describe('SettingsTab', () => {
  it('renders indexing method radio group with all 4 options', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByText('Webhook')).toBeInTheDocument();
    expect(screen.getByText('Cron')).toBeInTheDocument();
    expect(screen.getByText('Manual')).toBeInTheDocument();
    expect(screen.getByText('Git-diff incremental')).toBeInTheDocument();
  });

  it('each radio option shows description text', () => {
    render(<SettingsTab {...defaultProps} />);
    expect(screen.getByText(/Real-time updates/)).toBeInTheDocument();
    expect(screen.getByText(/Scheduled polling/)).toBeInTheDocument();
    expect(screen.getByText(/User-triggered only/)).toBeInTheDocument();
    expect(screen.getByText(/Only re-processes files/)).toBeInTheDocument();
  });

  it('branch filter input accepts multiple branches', async () => {
    const user = userEvent.setup();
    render(<SettingsTab {...defaultProps} />);

    const branchInput = screen.getByPlaceholderText('Type branch name and press Enter');
    await user.type(branchInput, 'develop{Enter}');

    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
  });

  it('path filter inputs accept glob patterns', async () => {
    const user = userEvent.setup();
    render(<SettingsTab {...defaultProps} />);

    const includeInput = screen.getByPlaceholderText('e.g. src/**/*.ts');
    await user.type(includeInput, 'src/**/*.ts{Enter}');
    expect(screen.getByText('src/**/*.ts')).toBeInTheDocument();

    const excludeInput = screen.getByPlaceholderText('e.g. node_modules/**');
    await user.type(excludeInput, 'dist/**{Enter}');
    expect(screen.getByText('dist/**')).toBeInTheDocument();
  });

  it('save button calls PUT /api/repos/:id/settings', async () => {
    const user = userEvent.setup();
    const mutateSettings = vi.fn();
    render(<SettingsTab {...defaultProps} mutateSettings={mutateSettings} />);

    const branchInput = screen.getByPlaceholderText('Type branch name and press Enter');
    await user.type(branchInput, 'develop{Enter}');

    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/repos/repo-1/settings',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(mutateSettings).toHaveBeenCalled();
  });

  it('success toast shown on save', async () => {
    const { toast } = await import('sonner');
    const user = userEvent.setup();
    render(<SettingsTab {...defaultProps} />);

    const branchInput = screen.getByPlaceholderText('Type branch name and press Enter');
    await user.type(branchInput, 'develop{Enter}');
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    expect(toast.success).toHaveBeenCalledWith('Settings saved');
  });

  it('shows webhook setup guide when webhook method is selected', async () => {
    const user = userEvent.setup();
    render(<SettingsTab {...defaultProps} />);

    expect(screen.queryByTestId('webhook-setup-guide')).not.toBeInTheDocument();

    const webhookRadio = screen.getByDisplayValue('webhook');
    await user.click(webhookRadio);

    expect(screen.getByTestId('webhook-setup-guide')).toBeInTheDocument();
  });

  it('shows webhook setup guide on initial render when settings have webhook method', () => {
    render(<SettingsTab {...defaultProps} settings={makeSettings({ indexingMethod: 'webhook' })} />);
    expect(screen.getByTestId('webhook-setup-guide')).toBeInTheDocument();
  });

  it('form initializes with existing settings', () => {
    render(
      <SettingsTab
        {...defaultProps}
        settings={makeSettings({
          branchFilter: ['main', 'develop'],
          excludePatterns: ['node_modules/**', 'dist/**'],
        })}
      />,
    );
    expect(screen.getByText('main')).toBeInTheDocument();
    expect(screen.getByText('develop')).toBeInTheDocument();
    expect(screen.getByText('node_modules/**')).toBeInTheDocument();
    expect(screen.getByText('dist/**')).toBeInTheDocument();
  });
});
