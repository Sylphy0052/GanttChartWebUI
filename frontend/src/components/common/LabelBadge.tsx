import React from 'react';

interface LabelBadgeProps {
  label: string;
  size?: 'sm' | 'md';
  variant?: 'default' | 'outline';
  className?: string;
}

const LabelBadge: React.FC<LabelBadgeProps> = ({
  label,
  size = 'sm',
  variant = 'default',
  className = '',
}) => {
  const baseClasses = 'inline-flex items-center rounded-full font-medium';
  
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };

  const variantClasses = {
    default: 'bg-blue-100 text-blue-800',
    outline: 'bg-white border border-blue-200 text-blue-700',
  };

  const classes = `${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`;

  return (
    <span className={classes}>
      {label}
    </span>
  );
};

export default LabelBadge;