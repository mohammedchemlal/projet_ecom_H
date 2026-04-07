export interface Product {
  id: number;
  name: string;
  price: number;
  image?: string;
  badge?: 'NEW' | 'BESTSELLER';
  description?: string;
  discountPrice?: number;
  images: string[];
  category: string;
  rating: number;
  reviewCount: number;
  stock: number;
  isActive: boolean;
  isPromotion?: boolean;
  promotionPercentage?: number;
  createdAt: Date;
}

export interface Testimonial {
  id: number;
  customerName: string;
  customerImage: string;
  rating: number;
  comment: string;
  date?: Date;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  icon?: string;
}
