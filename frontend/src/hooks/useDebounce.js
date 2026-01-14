import { useState, useEffect } from 'react';

// Hook này sẽ trả về giá trị chỉ sau khi người dùng ngừng thay đổi nó một khoảng thời gian (delay)
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Thiết lập timer để cập nhật giá trị sau 'delay' mili-giây
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Hủy timer nếu giá trị thay đổi trước khi hết giờ (người dùng gõ tiếp)
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default useDebounce;