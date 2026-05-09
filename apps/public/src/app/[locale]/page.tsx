'use client';

import { Alert } from '@tukio/ui/alert';
import { Avatar } from '@tukio/ui/avatar';
import { Badge } from '@tukio/ui/badge';
import { Button } from '@tukio/ui/button';
import { Card } from '@tukio/ui/card';
import { Divider } from '@tukio/ui/divider';
import { FormField } from '@tukio/ui/form-field';
import { Input } from '@tukio/ui/input';
import { Placeholder } from '@tukio/ui/placeholder';
import { ProgressBar } from '@tukio/ui/progress-bar';
import { Skeleton } from '@tukio/ui/skeleton';
import { Spinner } from '@tukio/ui/spinner';
import { Stars } from '@tukio/ui/stars';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-cream-50 p-8 flex flex-col gap-8 max-w-2xl mx-auto">
      <h1 className="text-5xl text-charcoal-800">Tukio Design System</h1>
      <p className="text-base text-charcoal-700">Sprint 0 — composants atomiques actifs.</p>

      {/* Buttons */}
      <section className="flex flex-wrap gap-3">
        <Button variant="primary">Réserver</Button>
        <Button variant="secondary">Annuler</Button>
        <Button variant="tertiary">Voir plus</Button>
        <Button variant="ghost">Ignorer</Button>
        <Button variant="danger">Supprimer</Button>
        <Button size="sm">Petit</Button>
        <Button size="lg">Grand</Button>
        <Button loading>Chargement</Button>
        <Button disabled>Désactivé</Button>
      </section>

      <Divider />

      {/* Badges */}
      <section className="flex flex-wrap gap-2">
        <Badge variant="brand">Nouveau</Badge>
        <Badge variant="success">Vérifié</Badge>
        <Badge variant="warning">En attente</Badge>
        <Badge variant="info">Info</Badge>
        <Badge variant="neutral">Neutre</Badge>
        <Badge variant="danger">Erreur</Badge>
      </section>

      {/* Form */}
      <section className="flex flex-col gap-4">
        <FormField label="Email" helper="Nous ne le partageons jamais" required>
          <Input placeholder="you@example.com" type="email" />
        </FormField>
        <FormField label="Email invalide" error="Format incorrect">
          <Input placeholder="email" error />
        </FormField>
      </section>

      <Divider label="OU" />

      {/* Card */}
      <Card>
        <Card.Header>En-tête</Card.Header>
        <Card.Body>
          <div className="flex items-center gap-3">
            <Avatar name="Camille Renard" tone="brand" size={40} />
            <div>
              <p className="font-medium text-charcoal-800">Camille Renard</p>
              <Stars value={4.8} count={42} />
            </div>
          </div>
        </Card.Body>
        <Card.Footer>
          <Button size="sm">Contacter</Button>
        </Card.Footer>
      </Card>

      {/* Loading states */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Spinner size="sm" />
          <Spinner size="default" />
          <Spinner size="lg" />
        </div>
        <ProgressBar value={65} aria-label="Progression" />
        <ProgressBar indeterminate aria-label="Chargement" />
        <Skeleton width="100%" height={20} />
        <Skeleton width={200} height={16} variant="shimmer" />
      </section>

      {/* Alerts */}
      <Alert variant="success" title="Réservation confirmée">
        Votre événement a bien été enregistré.
      </Alert>
      <Alert variant="error" title="Paiement refusé">
        Votre carte a été refusée.
      </Alert>

      {/* Placeholder */}
      <Placeholder label="Photo événement réel" aspect="4/3" />
    </main>
  );
}
