import { createContext, useContext } from 'react';

export const CheckoutContext = createContext(null);
export const useCheckout = () => useContext(CheckoutContext);
