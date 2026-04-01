import { useEffect } from 'react';

const Toast = ({ toast, onRemoveToast }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemoveToast(toast.id);
    }, toast.duration || 3000);

    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onRemoveToast]);

  const getToastStyle = () => {
    switch (toast.type) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'info':
        return 'bg-blue-500';
      default:
        return 'bg-gray-800';
    }
  };

  return (
    <div className={`fixed top-4 right-4 ${getToastStyle()} text-white px-4 py-2 rounded-md shadow-lg z-50 transform transition-all duration-300`}>
      <div className="flex items-center justify-between min-w-[250px]">
        <span>{toast.message}</span>
        <button 
          onClick={() => onRemoveToast(toast.id)}
          className="ml-4 text-white hover:text-gray-200 focus:outline-none"
        >
          &times;
        </button>
      </div>
    </div>
  );
};

export default Toast;