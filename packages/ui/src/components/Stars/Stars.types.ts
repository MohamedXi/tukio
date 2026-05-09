export interface StarsProps {
  value: number;
  count?: number;
  size?: number;
  interactive?: boolean;
  onChange?: (value: number) => void;
  countLabel?: string;
  className?: string;
}
