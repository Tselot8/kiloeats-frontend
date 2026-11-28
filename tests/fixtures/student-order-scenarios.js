import { addCartItem } from '../../src/utils/cart.js';

// SYNTHETIC_LIFECYCLE_M13: every example goes through the SAME checkout service
// and order collection as the real demo flow. There is no second history seed.
export const addStudentOrderScenarios = async (service, student, otherStudent) => {
  const cart = addCartItem(null, { restaurantId: 'demo-acacia-kitchen', campusId: 'aau-4k', itemId: 'acacia-shiro' }, { catalog: service.catalog }).cart;
  const references = [];
  for (const [index, status] of ['Pending', 'Accepted', 'Ready', 'Delivered', 'Declined', 'Cancelled', 'Other student'].entries()) {
    const identity = status === 'Other student' ? otherStudent : student;
    const quote = await service.quote({ identity, cart, dropoffId: 'synthetic-aau-4k-a' });
    const response = await service.submit({ identity, operationId: `synthetic-lifecycle-${index}`, cart, quoteId: quote.id,
      delivery: { recipientName: status === 'Other student' ? 'Other Fictional Recipient' : 'Fictional Lifecycle Recipient', contactPhone: '000 000 0000', dropoffId: quote.dropoffId, handoffInstructions: 'Synthetic scenario only' } });
    if (response?.outcome !== 'confirmed') throw new Error('Synthetic lifecycle examples could not be fully created. Inspect fixture modes; no live order was sent.');
    const { reference } = response.receipt;
    references.push(reference);
    if (['Accepted', 'Ready', 'Delivered'].includes(status)) service.simulateOrderStatus(reference, 'Accepted');
    if (['Ready', 'Delivered'].includes(status)) service.simulateOrderStatus(reference, 'Ready');
    if (status === 'Delivered') service.simulateOrderStatus(reference, 'Delivered');
    if (status === 'Declined') service.simulateOrderStatus(reference, 'Declined');
    if (status === 'Cancelled') {
      const result = await service.cancelOrder({ identity, reference, version: 1, operationId: `synthetic-lifecycle-cancel-${index}` });
      if (result.outcome !== 'cancelled') throw new Error('Synthetic cancellation example was not confirmed.');
    }
  }
  return references;
};
