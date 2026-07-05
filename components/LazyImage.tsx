import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  placeholderSrc?: string;
  className?: string;
}

const LazyImage: React.FC<LazyImageProps> = ({ src, placeholderSrc, alt, className, ...props }) => {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=');
  const [hasLoaded, setHasLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    let observer: IntersectionObserver;
    const currentRef = imageRef.current;

    // The `src` prop can only be a string or undefined. The previous logic to handle Blob
    // was incorrect and has been removed to definitively fix the recurring error.
    const imageUrl = (typeof src === 'string' && src) ? src : undefined;

    if (currentRef && imageUrl) {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              // Preload the image in memory
              const img = new Image();
              img.src = imageUrl;
              img.onload = () => {
                // Once loaded, set the actual image source to trigger the render
                setImageSrc(imageUrl);
                setHasLoaded(true);
              };
              // Stop observing once loading has been triggered
              observer.unobserve(currentRef);
            }
          });
        },
        { rootMargin: '100px 0px' } // Pre-load images 100px before they enter the viewport
      );

      observer.observe(currentRef);
    }

    return () => {
      // Cleanup observer on component unmount or src change
      if (currentRef && observer) {
        observer.unobserve(currentRef);
      }
    };
  }, [src]);

  const placeholderStyles: React.CSSProperties = {
    backgroundColor: '#f0f0f0',
    transition: 'opacity 0.3s ease-in-out',
    opacity: hasLoaded ? 1 : 0.8,
  };

  return (
    <img
      ref={imageRef}
      src={imageSrc}
      alt={alt}
      className={className}
      style={placeholderStyles}
      {...props}
    />
  );
};

export default LazyImage;
