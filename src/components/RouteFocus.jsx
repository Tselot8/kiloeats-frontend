import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const RouteFocus = () => {
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);
  useEffect(() => {
    const heading = document.querySelector("#main-content h2");
    document.title = heading ? `${heading.textContent} | KiloEats` : "KiloEats | Restaurant workspace";
    if (previousPath.current !== pathname) {
      window.scrollTo(0, 0);
      if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
      }
    }
    previousPath.current = pathname;
  }, [pathname]);
  return null;
};

export default RouteFocus;
