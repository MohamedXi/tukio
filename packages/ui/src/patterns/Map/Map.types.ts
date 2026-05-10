export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  title?: string;
  color?: string;
}

export interface MapProps {
  markers?: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  onMarkerClick?: (id: string) => void;
  provider?: 'mapbox' | 'google';
  placeholderLabel?: string;
  className?: string;
}
