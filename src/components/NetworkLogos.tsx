import React from 'react'

export function Trc20Logo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28.4 8.2L16.7 1.2c-.4-.2-.9-.2-1.3 0L3.6 8.2c-.4.2-.6.7-.6 1.1v13.4c0 .5.2.9.6 1.1l11.8 7c.2.1.4.2.7.2.3 0 .5-.1.7-.2l11.8-7c.4-.2.6-.7.6-1.1V9.3c0-.4-.2-.9-.6-1.1zM16 4.1l9.3 5.5-9.3 4.4-9.3-4.4L16 4.1zM5.8 11.2l8.8 4.2v11.7L5.8 21.9V11.2zm10.4 15.9V15.4l8.8-4.2v10.7l-8.8 5.2z" />
    </svg>
  )
}

export function Bep20Logo({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2L15.3 5.3L12 8.6L8.7 5.3L12 2ZM5.3 8.7L8.6 12L5.3 15.3L2 12L5.3 8.7ZM18.7 8.7L22 12L18.7 15.3L15.4 12L18.7 8.7ZM12 15.4L15.3 18.7L12 22L8.7 18.7L12 15.4ZM12 9.7L14.3 12L12 14.3L9.7 12L12 9.7Z" />
    </svg>
  )
}
