import Razorpay from 'razorpay';
import { IStorage } from '../storage';

// Initialize Razorpay with proper error handling
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_1234567890",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "secret_test_1234567890"
});

export class RazorpayRouteService {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Create a Razorpay linked account for a vendor (shop or service provider)
   * @param userId The user ID of the vendor
   * @param bankDetails The bank details of the vendor
   */
  async createLinkedAccount(userId: number, bankDetails: {
    accountNumber: string;
    ifscCode: string;
    accountHolderName: string;
  }) {
    try {
      // Get the user details
      const user = await this.storage.getUser(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Create a linked account in Razorpay
      // Note: This is a placeholder for the actual Razorpay Route API call
      // In a real implementation, you would use the Razorpay SDK to create a linked account
      const linkedAccount = await (razorpay as any).linkedAccounts.create({
        email: user.email,
        phone: user.phone,
        name: bankDetails.accountHolderName,
        bank_account: {
          account_number: bankDetails.accountNumber,
          ifsc_code: bankDetails.ifscCode,
          name: bankDetails.accountHolderName,
        },
        // Add other required fields as per Razorpay Route API
      });

      // Update the user with the linked account ID
      await this.storage.updateUser(userId, {
        razorpayLinkedAccountId: linkedAccount.id
      });

      return linkedAccount;
    } catch (error) {
      console.error('Error creating linked account:', error);
      throw error;
    }
  }

  /**
   * Calculate the platform fee and vendor amount for a transaction
   * @param amount The original transaction amount
   * @returns Object containing the platform fee and vendor amount
   */
  calculateFees(amount: number) {
    // Platform fee is 1% of the original amount
    const platformFee = Math.round(amount * 0.01);
    // Vendor amount is the original amount minus the platform fee
    const vendorAmount = amount - platformFee;
    
    return {
      platformFee,
      vendorAmount
    };
  }

  /**
   * Calculate the total amount to charge the customer including the platform fee
   * @param originalAmount The original amount without fees
   * @returns The total amount to charge including the customer platform fee
   */
  calculateTotalWithCustomerFee(originalAmount: number) {
    // Customer platform fee is fixed at 3rs
    const customerPlatformFee = 3;
    return originalAmount + customerPlatformFee;
  }

  /**
   * Process a payment split for an order
   * @param orderId The order ID
   * @param paymentId The Razorpay payment ID
   */
  async processOrderPaymentSplit(orderId: number, paymentId: string) {
    try {
      // Get the order details
      const order = await this.storage.getOrder(orderId);
      if (!order) {
        throw new Error('Order not found');
      }

      // Get the shop details
      if (order.shopId === null) {
        throw new Error('Order does not contain a valid shop id');
      }
      const shop = await this.storage.getUser(order.shopId);
      if (!shop || !shop.razorpayLinkedAccountId) {
        throw new Error('Shop not found or not linked with Razorpay');
      }

      // Calculate the fees
      const orderAmount = parseFloat(order.total);
      const { platformFee, vendorAmount } = this.calculateFees(orderAmount);

      // Create a transfer to the vendor's linked account
      // Note: This is a placeholder for the actual Razorpay Route API call
      const transfer = await razorpay.transfers.create({
        account: shop.razorpayLinkedAccountId,
        amount: vendorAmount * 100, // Convert to paise
        currency: 'INR',
        notes: {
          orderId: orderId.toString(),
          shopId: shop.id.toString(),
          originalAmount: orderAmount.toString(),
          platformFee: platformFee.toString()
        }
      });

      console.log(`Transfer created for order ${orderId}: ${transfer.id}`);
      return transfer;
    } catch (error) {
      console.error('Error processing payment split:', error);
      throw error;
    }
  }

  /**
   * Process a payment split for a booking
   * @param bookingId The booking ID
   * @param paymentId The Razorpay payment ID
   */
  async processBookingPaymentSplit(bookingId: number, paymentId: string) {
    try {
      // Get the booking details
      const booking = await this.storage.getBooking(bookingId);
      if (!booking) {
        throw new Error('Booking not found');
      }

      // Get the service details
      const service = await this.storage.getService(booking.serviceId!);
      if (!service) {
        throw new Error('Service not found');
      }

      // Get the provider details
      if (service.providerId === null) {
        throw new Error('Service provider id is null');
      }
      const provider = await this.storage.getUser(service.providerId);
      if (!provider || !provider.razorpayLinkedAccountId) {
        throw new Error('Provider not found or not linked with Razorpay');
      }

      // Calculate the fees
      const serviceAmount = parseFloat(service.price.toString());
      const { platformFee, vendorAmount } = this.calculateFees(serviceAmount);

      // Create a transfer to the vendor's linked account
      // Create a transfer to the vendor's linked account
      // Note: This is a placeholder for the actual Razorpay Route API call
      const transfer = await razorpay.transfers.create({
        account: provider.razorpayLinkedAccountId,
        amount: vendorAmount * 100, // Convert to paise
        currency: 'INR',
        notes: {
          bookingId: bookingId.toString(),
          serviceId: service.id.toString(),
          providerId: provider.id.toString(),
          originalAmount: serviceAmount.toString(),
          platformFee: platformFee.toString()
        }
      });
      return transfer;
    } catch (error) {
      console.error('Error processing payment split:', error);
      throw error;
    }
  }
}

// Create and export a singleton instance
export const razorpayRouteService = (storage: IStorage) => new RazorpayRouteService(storage);