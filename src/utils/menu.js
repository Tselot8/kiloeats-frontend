export const menuItemId = (item) => {
  const id = item?.id;
  if (typeof id === "string" && id.trim()) return id;
  if (typeof id === "number" && Number.isSafeInteger(id)) return String(id);
  return null;
};

export const hasUniqueMenuId = (item, items) => {
  const id = menuItemId(item);
  return id !== null && items.filter((entry) => menuItemId(entry) === id).length === 1;
};

export const formatMenuPrice = (price) => {
  if (price === "" || price == null || !Number.isFinite(Number(price)) || Number(price) < 0) {
    return "Price unavailable";
  }
  return `${new Intl.NumberFormat("en-ET", { maximumFractionDigits: 2 }).format(Number(price))} Br.`;
};

export const validateMenuFields = (values) => {
  const errors = {};
  if (!values.name.trim()) errors.name = "Enter a food name.";
  if (!values.description.trim()) errors.description = "Enter a description.";
  const price = Number(values.price);
  if (!values.price.trim()) {
    errors.price = "Enter a price in birr.";
  } else if (!Number.isFinite(price) || price < 0 || !/^\d*(?:\.\d{1,2})?$/.test(values.price.trim()) || price * 100 > Number.MAX_SAFE_INTEGER) {
    errors.price = "Use a price of zero or more, with up to two decimal places.";
  }
  if (values.image.trim()) {
    try {
      const url = new URL(values.image.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
    } catch {
      errors.image = "Enter a complete http:// or https:// image URL, or leave this blank.";
    }
  }
  return errors;
};
