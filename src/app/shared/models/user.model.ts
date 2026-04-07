export interface User {
  id: number;
  email: string;
  password: string;
  fullName: string;
  address: string;
  phone: string;
  role: 'user' | 'admin';
  createdAt: Date;
}
