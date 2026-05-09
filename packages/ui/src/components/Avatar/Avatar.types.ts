export interface AvatarProps {
  name: string;
  size?: number;
  tone?: 'cream' | 'brand' | 'info' | 'success';
  src?: string;
  status?: 'online' | 'offline' | 'busy';
  className?: string;
}
