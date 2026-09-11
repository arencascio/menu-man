export type ServerPurchaseEvent = {
  name: "purchase";
  transactionId: string;
  restaurantId: string;
  orderId: string;
  currency: string;
  revenueCents: number;
  items: Array<{
    itemId: string;
    itemName: string;
    priceCents: number;
    quantity: number;
  }>;
};

