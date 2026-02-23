import React from 'react';

interface SkeletonProps {
    className?: string;
    variant?: 'circle' | 'rect' | 'text';
    width?: string | number;
    height?: string | number;
}

export const Skeleton: React.FC<SkeletonProps> = ({
    className = '',
    variant = 'rect',
    width,
    height
}) => {
    const baseClasses = "bg-slate-100 animate-pulse relative overflow-hidden";
    const variantClasses = {
        circle: "rounded-full",
        rect: "rounded-2xl",
        text: "rounded-md h-4 w-full"
    };

    return (
        <div
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={{ width, height }}
        >
            <div className="absolute inset-0 animate-shimmer" />
        </div>
    );
};

export const hapticFeedback = (intensity: number = 10) => {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(intensity);
    }
};
