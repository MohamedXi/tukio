export interface Review {
  id: string;
  authorName: string;
  authorAvatar?: string;
  rating: number;
  date: Date | string;
  comment: string;
}

export interface ReviewsBreakdown {
  punctuality?: number;
  communication?: number;
  valueForMoney?: number;
  professionalism?: number;
}

export interface BreakdownLabels {
  punctuality?: string;
  communication?: string;
  valueForMoney?: string;
  professionalism?: string;
}

export interface ReviewsDisplayProps {
  rating: number;
  count: number;
  reviews: Review[];
  breakdown?: ReviewsBreakdown;
  breakdownLabels?: BreakdownLabels;
  loadMoreLabel?: string;
  pageSize?: number;
  dateFormatter?: (date: Date | string) => string;
  className?: string;
}
