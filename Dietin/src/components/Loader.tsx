import React from 'react';

interface LoaderProps {
  className?: string;
  size?: number;
}

export const Loader: React.FC<LoaderProps> = ({ className, size = 24 }) => {
  return (
    <div className={className} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <lottie-player
        src="/system-regular-726-spinner-ring-hover-spin.json"
        background="transparent"
        speed="1.2"
        style={{ width: `${size}px`, height: `${size}px` }}
        loop
        autoplay
      />
    </div>
  );
};

export default Loader;
