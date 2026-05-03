import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WikiProposalsQueue from './WikiProposalsQueue';

describe('WikiProposalsQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state when no proposals', async () => {
    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: [] }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Nincsenek függőben lévő javaslatok/)).toBeInTheDocument();
    });
  });

  it('loads and renders proposals from API', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Getting Started',
        reason: 'Frissített tutoriál',
        newContent: 'Ez egy új tartalom a Getting Started oldalhoz.',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Frissített tutoriál')).toBeInTheDocument();
    });
  });

  it('displays multiple proposals', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'API Docs',
        reason: 'Új végpontok',
        newContent: 'Tartalom 1',
        createdAt: Date.now(),
      },
      {
        id: 'prop2',
        page: 'FAQ',
        reason: 'Közös kérdések',
        newContent: 'Tartalom 2',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('API Docs')).toBeInTheDocument();
      expect(screen.getByText('FAQ')).toBeInTheDocument();
    });
  });

  it('calls approve endpoint when approve button clicked', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    const approveButton = screen.getAllByText('Jóváhagy')[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/wiki/proposals/prop1/approve', { method: 'POST' });
    });
  });

  it('removes proposal from list after approval', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    const approveButton = screen.getAllByText('Jóváhagy')[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(screen.queryByText('Test Page')).not.toBeInTheDocument();
    });
  });

  it('calls reject endpoint when reject button clicked', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    const rejectButton = screen.getAllByText('Elutasít')[0];
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/wiki/proposals/prop1/reject', { method: 'POST' });
    });
  });

  it('removes proposal from list after rejection', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    const rejectButton = screen.getAllByText('Elutasít')[0];
    fireEvent.click(rejectButton);

    await waitFor(() => {
      expect(screen.queryByText('Test Page')).not.toBeInTheDocument();
    });
  });

  it('calls onApprove callback when proposal approved', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    const onApproveMock = vi.fn();

    (global.fetch as any) = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proposals: mockProposals }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true }),
      });

    render(<WikiProposalsQueue onApprove={onApproveMock} />);

    await waitFor(() => {
      expect(screen.getByText('Test Page')).toBeInTheDocument();
    });

    const approveButton = screen.getAllByText('Jóváhagy')[0];
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(onApproveMock).toHaveBeenCalled();
    });
  });

  it('truncates long content and shows expand button', async () => {
    const longContent = 'A'.repeat(200);
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: longContent,
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Több')).toBeInTheDocument();
    });
  });

  it('expands and collapses content on button click', async () => {
    const longContent = 'A'.repeat(200);
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test Page',
        reason: null,
        newContent: longContent,
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Több')).toBeInTheDocument();
    });

    const expandButton = screen.getByText('Több');
    fireEvent.click(expandButton);

    await waitFor(() => {
      expect(screen.getByText('Kevesebb')).toBeInTheDocument();
    });

    const collapseButton = screen.getByText('Kevesebb');
    fireEvent.click(collapseButton);

    await waitFor(() => {
      expect(screen.getByText('Több')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', () => {
    (global.fetch as any) = vi.fn(() => new Promise(() => {})); // Never resolves

    render(<WikiProposalsQueue />);

    expect(screen.getByText(/Javaslatokat betöltjük/)).toBeInTheDocument();
  });

  it('handles API errors gracefully', async () => {
    (global.fetch as any) = vi.fn().mockRejectedValueOnce(new Error('Network error'));

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText(/Nincsenek függőben lévő javaslatok/)).toBeInTheDocument();
    });
  });

  it('displays proposal reason when provided', async () => {
    const mockProposals = [
      {
        id: 'prop1',
        page: 'FAQ',
        reason: 'Frissített gyakori kérdések',
        newContent: 'Tartalom',
        createdAt: Date.now(),
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      expect(screen.getByText('Frissített gyakori kérdések')).toBeInTheDocument();
    });
  });

  it('displays formatted timestamp', async () => {
    const now = Date.now();
    const mockProposals = [
      {
        id: 'prop1',
        page: 'Test',
        reason: null,
        newContent: 'Tartalom',
        createdAt: now,
      },
    ];

    (global.fetch as any) = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ proposals: mockProposals }),
    });

    render(<WikiProposalsQueue />);

    await waitFor(() => {
      const dateStr = new Date(now).toLocaleString('hu-HU');
      expect(screen.getByText(dateStr)).toBeInTheDocument();
    });
  });
});
