
import React from 'react';

interface LoaderProps {
    text?: string;
}

const Loader: React.FC<LoaderProps> = ({ text = "Carregando..." }) => {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-100">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-primary"></div>
      <p className="mt-4 text-lg text-gray-700 font-semibold">{text}</p>
    </div>
  );
};

export default Loader;
