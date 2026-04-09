export interface ProductSpecificationSection {
  title: string;
  items: string[];
}

export interface Product {
  id: number;
  name: string;
  price: number;
  image?: string;
  badge?: 'NEW' | 'BESTSELLER';
  description?: string;
  detailedDescription?: string;
  specifications?: ProductSpecificationSection[];
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

export interface ProductReview {
  id: number;
  userId: number | null;
  userName: string;
  userAvatar?: string;
  rating: number;
  title: string;
  comment: string;
  date: Date;
  likes: number;
  verified: boolean;
  images?: string[];
}

export interface Testimonial {
  id: number;
  customerName: string;
  customerImage: string;
  role?: string;
  rating: number;
  comment: string;
  isActive?: boolean;
  date?: Date;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  icon?: string;
}
