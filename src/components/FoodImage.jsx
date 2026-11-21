import { useState } from "react";
import { demoFoodPhotos } from './demoFoodPhotos.js';

const FoodImage = ({ src, name, illustrationId }) => {
  const [failedSource, setFailedSource] = useState(null);
  const originalSource = typeof src === "string" ? src.trim() : "";
  const source = originalSource && !originalSource.startsWith('/demo/') ? originalSource : demoFoodPhotos[illustrationId] || originalSource;
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
  illustrationId: (props) => props.illustrationId != null && typeof props.illustrationId !== 'string' ? new Error('Illustration ID must be a string.') : null,
  src: (props) => props.src != null && typeof props.src !== "string" ? new Error("FoodImage src must be a string.") : null,
  name: (props) => typeof props.name !== "string" ? new Error("FoodImage requires a name.") : null,
};

export default FoodImage;
