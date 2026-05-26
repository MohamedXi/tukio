import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
// a11y axe tested via Playwright e2e (coming-soon-landing.spec.ts case 8) — jest-axe not in public app deps

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      kicker: 'Rester informé·e',
      titleLine1: 'Soyez parmi les',
      titleEmphasis: 'premiers',
      subtitle: 'On vous écrit une seule fois.',
      'fields.firstName.label': 'Prénom',
      'fields.firstName.placeholder': 'Camille',
      'fields.firstName.errors.required': 'Prénom requis',
      'fields.firstName.errors.tooLong': 'Maximum 80 caractères',
      'fields.lastName.label': 'Nom',
      'fields.lastName.placeholder': 'Renaud',
      'fields.lastName.errors.required': 'Nom requis',
      'fields.lastName.errors.tooLong': 'Maximum 80 caractères',
      'fields.email.label': 'Adresse email',
      'fields.email.placeholder': 'vous@exemple.fr',
      'fields.email.errors.required': 'Email requis',
      'fields.email.errors.invalid': 'Email invalide',
      'fields.email.errors.tooLong': 'Email trop long',
      'fields.role.label': 'Vous êtes…',
      'fields.role.organizer.title': 'Organisateur',
      'fields.role.organizer.sub': 'Je cherche des pros',
      'fields.role.professional.title': 'Professionnel',
      'fields.role.professional.sub': 'Je propose des services',
      'fields.rgpd.label': "J'accepte — ",
      'fields.rgpd.linkLabel': 'politique de confidentialité',
      'fields.rgpd.errors.required': 'Vous devez accepter pour soumettre',
      submit: "Me prévenir à l'ouverture",
      submitting: 'Envoi en cours…',
      reassurance: 'Vos données restent en France',
      'errors.generic': 'Une erreur est survenue.',
      'errors.network': 'Service indisponible.',
      'errors.rateLimited': `Trop de tentatives. Réessayez dans ${params?.['seconds']} secondes.`,
    };
    return map[key] ?? key;
  },
  useLocale: () => 'fr',
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

const mockMutate = vi.fn();
vi.mock('@tukio/api-client/hooks/pre-launch', () => ({
  useSubmitPreLaunchSignup: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));

import { ComingSoonFormClient } from '../ComingSoonFormClient.js';

const defaultProps = { locale: 'fr', initialRole: 'organisateur' as const };

describe('ComingSoonFormClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 5 form fields', () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Adresse email')).toBeInTheDocument();
    expect(screen.getByText('Organisateur')).toBeInTheDocument();
    expect(screen.getByText('Professionnel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Me prévenir/i })).toBeInTheDocument();
  });

  it('mounts with initialRole=organisateur pre-selected', () => {
    render(<ComingSoonFormClient {...defaultProps} initialRole="organisateur" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toBeChecked();
    expect(radios[1]).not.toBeChecked();
  });

  it('mounts with initialRole=professionnel pre-selected', () => {
    render(<ComingSoonFormClient {...defaultProps} initialRole="professionnel" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });

  it('shows validation errors on empty submit', async () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /Me prévenir/i }).closest('form')!);
    });
    await waitFor(() => {
      expect(screen.getByText('Prénom requis')).toBeInTheDocument();
      expect(screen.getByText('Nom requis')).toBeInTheDocument();
    });
  });

  it('shows email invalid error for bad email', async () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Renaud' } });
    fireEvent.change(screen.getByLabelText('Adresse email'), { target: { value: 'not-an-email' } });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /Me prévenir/i }).closest('form')!);
    });
    await waitFor(() => {
      expect(screen.getByText('Email invalide')).toBeInTheDocument();
    });
  });

  it('shows rgpd required error when checkbox not checked', async () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Renaud' } });
    fireEvent.change(screen.getByLabelText('Adresse email'), {
      target: { value: 'camille@test.fr' },
    });
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /Me prévenir/i }).closest('form')!);
    });
    await waitFor(() => {
      expect(screen.getByText('Vous devez accepter pour soumettre')).toBeInTheDocument();
    });
  });

  it('switches role radio card on click', () => {
    render(<ComingSoonFormClient {...defaultProps} initialRole="organisateur" />);
    fireEvent.click(screen.getAllByRole('radio')[1]!);
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
  });

  it('calls mutate with correct locale on valid submit', async () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Renaud' } });
    fireEvent.change(screen.getByLabelText('Adresse email'), {
      target: { value: 'camille@test.fr' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => {
      fireEvent.submit(screen.getByRole('button', { name: /Me prévenir/i }).closest('form')!);
    });
    await waitFor(() => {
      expect(mockMutate).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Camille', locale: 'fr' }),
        expect.any(Object),
      );
    });
  });

  it('renders the reassurance line with shield icon context', () => {
    render(<ComingSoonFormClient {...defaultProps} />);
    expect(screen.getByText('Vos données restent en France')).toBeInTheDocument();
  });
});
