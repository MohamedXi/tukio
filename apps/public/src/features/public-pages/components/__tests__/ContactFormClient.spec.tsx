import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('next-intl', () => ({
  // ContactFormClient uses useTranslations('contact.form') so keys are relative to that namespace
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
      title: 'Nous écrire',
      'fields.firstName.label': 'Prénom',
      'fields.firstName.placeholder': 'Camille',
      'fields.lastName.label': 'Nom',
      'fields.lastName.placeholder': 'Renaud',
      'fields.email.label': 'Email',
      'fields.email.placeholder': 'vous@exemple.fr',
      'fields.category.label': 'Vous êtes',
      'fields.category.placeholder': 'Sélectionnez…',
      'fields.category.options.organisateur': "Organisateur d'événement",
      'fields.category.options.professionnel': "Professionnel de l'événementiel",
      'fields.category.options.journaliste': 'Journaliste, presse',
      'fields.category.options.partenaire': 'Partenaire potentiel',
      'fields.category.options.autre': 'Autre',
      'fields.subject.label': 'Sujet',
      'fields.subject.placeholder': 'Sélectionnez…',
      'fields.subject.options.general': 'Question générale',
      'fields.subject.options.devenirPro': 'Devenir pro tukio.one',
      'fields.subject.options.technique': 'Problème technique',
      'fields.subject.options.partenariat': 'Proposition partenariat',
      'fields.subject.options.presse': 'Presse et communication',
      'fields.message.label': 'Votre message',
      'fields.message.placeholder': 'Décrivez votre demande en quelques lignes',
      submit: 'Envoyer',
      submitting: 'Envoi en cours…',
      disclaimer: 'Vos données sont traitées conformément à notre politique de confidentialité.',
      successMessage: 'Message envoyé. Réponse sous 48h ouvrées.',
      'errors.generic': 'Une erreur est survenue. Veuillez réessayer.',
      'errors.network': 'Problème réseau. Vérifiez votre connexion et réessayez.',
      'errors.rateLimited': `Trop de messages. Réessayez dans ${params?.['seconds']} secondes.`,
      'errors.firstName.required': 'Prénom requis.',
      'errors.lastName.required': 'Nom requis.',
      'errors.email.invalid': 'Adresse email invalide.',
      'errors.category.invalid': 'Veuillez sélectionner votre profil.',
      'errors.subject.invalid': 'Veuillez sélectionner un sujet.',
      'errors.message.tooShort': 'Message trop court (10 caractères min).',
      'errors.message.tooLong': 'Message trop long (2000 caractères max).',
    };
    return map[key] ?? key;
  },
}));

vi.mock('@tukio/api-client/hooks/pre-launch', () => ({
  useSubmitPreLaunchContact: () => ({
    mutate: vi.fn((_data: unknown, cb: { onSuccess: () => void }) => cb.onSuccess()),
    isPending: false,
  }),
}));

import { ContactFormClient } from '../ContactFormClient.js';

describe('ContactFormClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form with all 7 fields', () => {
    render(<ContactFormClient locale="fr" />);
    expect(screen.getByLabelText('Prénom')).toBeInTheDocument();
    expect(screen.getByLabelText('Nom')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Vous êtes')).toBeInTheDocument();
    expect(screen.getByLabelText('Sujet')).toBeInTheDocument();
    expect(screen.getByLabelText('Votre message')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeInTheDocument();
  });

  it('shows success message on valid submit', async () => {
    render(<ContactFormClient locale="fr" />);

    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Camille' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'Renaud' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'camille@exemple.fr' } });
    fireEvent.change(screen.getByLabelText('Vous êtes'), { target: { value: 'organisateur' } });
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText('Votre message'), {
      target: { value: 'Bonjour, je souhaite en savoir plus sur la plateforme.' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Message envoyé');
    });
  });

  it('shows required errors on empty submit', async () => {
    render(<ContactFormClient locale="fr" />);
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => {
      expect(screen.getByText('Prénom requis.')).toBeInTheDocument();
      expect(screen.getByText('Nom requis.')).toBeInTheDocument();
    });
  });

  it('shows email validation error', async () => {
    render(<ContactFormClient locale="fr" />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'not-valid' } });
    fireEvent.change(screen.getByLabelText('Vous êtes'), { target: { value: 'autre' } });
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText('Votre message'), {
      target: { value: 'Message long enough.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => {
      expect(screen.getByText('Adresse email invalide.')).toBeInTheDocument();
    });
  });

  it('shows message too short error', async () => {
    render(<ContactFormClient locale="fr" />);
    fireEvent.change(screen.getByLabelText('Prénom'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Nom'), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'test@exemple.fr' } });
    fireEvent.change(screen.getByLabelText('Vous êtes'), { target: { value: 'autre' } });
    fireEvent.change(screen.getByLabelText('Sujet'), { target: { value: 'general' } });
    fireEvent.change(screen.getByLabelText('Votre message'), { target: { value: 'Short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Envoyer' }));
    await waitFor(() => {
      expect(screen.getByText('Message trop court (10 caractères min).')).toBeInTheDocument();
    });
  });

  it('renders disclaimer text', () => {
    render(<ContactFormClient locale="fr" />);
    expect(screen.getByText(/politique de confidentialité/i)).toBeInTheDocument();
  });

  it('renders all category options', () => {
    render(<ContactFormClient locale="fr" />);
    const select = screen.getByLabelText('Vous êtes');
    expect(select).toBeInTheDocument();
    expect(screen.getByText("Organisateur d'événement")).toBeInTheDocument();
    expect(screen.getByText("Professionnel de l'événementiel")).toBeInTheDocument();
  });
});
