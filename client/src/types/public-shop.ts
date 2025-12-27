import type { ShopProfile } from "@shared/schema";

export type PublicShop = {
  id: number;
  name: string | null;
  phone: string | null;
  shopProfile: ShopProfile | null;
  profilePicture: string | null;
  shopBannerImageUrl: string | null;
  shopLogoImageUrl: string | null;
  addressStreet: string | null;
  addressCity: string | null;
  addressState: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  latitude: string | null;
  longitude: string | null;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  returnsEnabled: boolean;
  averageRating: string | number | null;
  totalReviews: number;
  catalogModeEnabled?: boolean;
  openOrderMode?: boolean;
  allowPayLater?: boolean;
};
