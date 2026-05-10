import { Placeholder } from '../../components/Placeholder/Placeholder';
import { cn } from '../../utils/cn';
import type { MapProps } from './Map.types';

/**
 * Map component — MVP placeholder.
 * V1+ will replace the inner <Placeholder> with a real map provider
 * (react-map-gl Mapbox or @vis.gl/react-google-maps).
 * Props are pre-defined so the API surface is stable for future migration.
 */
export function Map({ placeholderLabel = 'Interactive map (V1)', className }: MapProps) {
  return <Placeholder label={placeholderLabel} aspect="4/3" className={cn(className)} />;
}

Map.displayName = 'Map';
