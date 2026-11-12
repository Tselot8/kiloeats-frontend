import { useState } from "react";

const FoodImage = ({ src, name }) => {
  const [failedSource, setFailedSource] = useState(null);
  const source = typeof src === "string" ? src.trim() : "";
  return source && failedSource !== source ? (
    <img key={source} src={source} alt={name} className="food-image" onError={() => setFailedSource(source)} />
  ) : (
    <div className="food-image image-fallback" role="img" aria-label={`No image available for ${name}`}>
      <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
        <circle cx="20" cy="20" r="13" />
        <circle cx="20" cy="20" r="8" />
      </svg>
      <span>No photo</span>
    </div>
  );
};

FoodImage.propTypes = {
  src: (props) => props.src != null && typeof props.src !== "string" ? new Error("FoodImage src must be a string.") : null,
  name: (props) => typeof props.name !== "string" ? new Error("FoodImage requires a name.") : null,
};

export default FoodImage;
