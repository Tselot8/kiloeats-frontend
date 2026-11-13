import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IDENTITY_SERVICE, normalizeIdentity, VERIFICATION_SERVICE } from '../utils/identity.js';
import { IdentityContext } from './IdentityContext.js';

const IdentityProvider = ({ children, service = IDENTITY_SERVICE, verificationService = VERIFICATION_SERVICE }) => {
  const [identity, setIdentity] = useState({ status: 'loading', role: null });
  const request = useRef(null);
  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setIdentity({ status: 'loading', role: null });
    try {
      const response = await service.read({ signal: controller.signal });
      if (!controller.signal.aborted) setIdentity(normalizeIdentity(response));
    } catch {
      if (!controller.signal.aborted) setIdentity({ status: 'unavailable', role: null });
    }
  }, [service]);
  useEffect(() => { reload(); return () => request.current?.abort(); }, [reload]);
  const value = useMemo(() => ({ identity, reload, verificationService }), [identity, reload, verificationService]);
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
};
IdentityProvider.propTypes = {
  children: (props) => props.children == null ? new Error('IdentityProvider requires content.') : null,
  service: (props) => props.service != null && typeof props.service.read !== 'function' ? new Error('Identity service requires read().') : null,
  verificationService: (props) => props.verificationService != null && typeof props.verificationService.available !== 'boolean' ? new Error('Verification service must declare availability.') : null,
};
export default IdentityProvider;
