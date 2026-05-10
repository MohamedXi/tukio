'use client';
import { Placeholder } from '../../components/Placeholder/Placeholder';
import { cn } from '../../utils/cn';
import type { MapProps } from './Map.types';

/**
 * Map component — MVP placeholder.
 * V1+ will replace the inner <Placeholder> with a real map provider
 * (react-map-gl Mapbox or @vis.gl/react-google-maps).
 * Props are pre-defined so the API surface is stable for future migration.
 */
export function Map({
  markers,
  center,
  zoom,
  onMarkerClick,
  provider,
  placeholderLabel = 'Interactive map (V1)',
  className,
}: MapProps) {
  // D1 fix: warn in dev when V1+ props are passed (silently ignored at MVP)
  if (process.env.NODE_ENV !== 'production') {
    const ignored: string[] = [];
    if (markers && markers.length > 0) ignored.push('markers');
    if (center) ignored.push('center');
    if (zoom !== undefined) ignored.push('zoom');
    if (onMarkerClick) ignored.push('onMarkerClick');
    if (provider) ignored.push('provider');
    if (ignored.length > 0) {
      console.warn(
        `[@tukio/ui/map] Props ignored at MVP (placeholder only): ${ignored.join(', ')}. ` +
          'Wired in V1+ when a real map provider is integrated.',
      );
    }
  }

  return <Placeholder label={placeholderLabel} aspect="4/3" className={cn(className)} />;
}

Map.displayName = 'Map';
