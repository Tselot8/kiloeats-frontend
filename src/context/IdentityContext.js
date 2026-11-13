import { createContext, useContext } from 'react';
export const IdentityContext = createContext(null);
export const useIdentity = () => {
  const value = useContext(IdentityContext);
  if (!value) throw new Error('IdentityProvider is required.');
  return value;
};
