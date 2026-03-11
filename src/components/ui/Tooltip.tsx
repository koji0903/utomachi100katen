import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
    content: React.ReactNode;
    children?: React.ReactNode;
    position?: 'top' | 'bottom' | 'left' | 'right';
    className?: string;
    iconSize?: number;
}

export function Tooltip({ content, children, position = 'top', className = '', iconSize = 16 }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);

    const positionClasses = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    const arrowClasses = {
        top: 'bottom-[-6px] left-1/2 -translate-x-1/2 border-t-slate-800 border-l-transparent border-r-transparent border-b-transparent',
        bottom: 'top-[-6px] left-1/2 -translate-x-1/2 border-b-slate-800 border-l-transparent border-r-transparent border-t-transparent',
        left: 'right-[-6px] top-1/2 -translate-y-1/2 border-l-slate-800 border-t-transparent border-b-transparent border-r-transparent',
        right: 'left-[-6px] top-1/2 -translate-y-1/2 border-r-slate-800 border-t-transparent border-b-transparent border-l-transparent'
    };

    return (
        <div 
            className={`relative inline-flex items-center group transition-all duration-200 ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children || (
                <button type="button" className="text-slate-400 hover:text-slate-600 focus:outline-none transition-colors">
                    <HelpCircle size={iconSize} />
                </button>
            )}
            
            {isVisible && (
                <div className={`absolute z-[100] w-max max-w-[250px] p-2.5 text-xs font-medium text-white bg-slate-800 rounded-lg shadow-xl animate-in fade-in zoom-in-95 duration-150 ${positionClasses[position]}`}>
                    {content}
                    <div className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`} />
                </div>
            )}
        </div>
    );
}
