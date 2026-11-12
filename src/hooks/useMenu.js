import { useCallback, useEffect, useRef, useState } from "react";
import { fetchMenuData, menuErrorMessage } from "../utils/api.js";

export const useMenu = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const request = useRef(null);

  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setLoadError("");
    try {
      const menu = await fetchMenuData({ signal: controller.signal });
      if (!controller.signal.aborted) setItems(menu);
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(menuErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    return () => request.current?.abort();
  }, [reload]);

  return { items, setItems, loading, loadError, reload };
};
