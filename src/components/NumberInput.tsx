"use client";

import React, { useState, useEffect } from "react";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
    value: number | undefined | null;
    onChange: (value: number | undefined) => void;
    min?: number;
    max?: number;
    allowNegative?: boolean;
    fallbackValue?: number; // Value to use if input is empty, e.g., 0. If undefined, passes undefined.
}

export function NumberInput({
    value,
    onChange,
    min,
    max,
    allowNegative = false,
    fallbackValue,
    className,
    onBlur,
    onFocus,
    ...props
}: NumberInputProps) {
    const [localValue, setLocalValue] = useState<string>(value !== undefined && value !== null ? value.toString() : "");

    // Sync external value to local state if it changes unexpectedly
    useEffect(() => {
        if (value === undefined || value === null) {
            setLocalValue("");
        } else if (value.toString() !== localValue && parseFloat(localValue) !== value) {
            setLocalValue(value.toString());
        }
    }, [value, localValue]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value;

        if (val === "") {
            setLocalValue(val);
            onChange(fallbackValue !== undefined ? fallbackValue : undefined);
            return;
        }

        if (allowNegative && val === "-") {
            setLocalValue(val);
            return;
        }

        const isValid = allowNegative ? /^-?\d*$/.test(val) : /^\d*$/.test(val);

        if (isValid) {
            setLocalValue(val);
            const num = parseInt(val, 10);
            if (!isNaN(num)) {
                let clamped = num;
                if (min !== undefined && clamped < min) clamped = min;
                if (max !== undefined && clamped > max) clamped = max;
                onChange(clamped);
            }
        }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
        if (localValue === "" || localValue === "-") {
            setLocalValue(fallbackValue !== undefined ? fallbackValue.toString() : "");
            onChange(fallbackValue !== undefined ? fallbackValue : undefined);
        } else {
            const num = parseInt(localValue, 10);
            if (!isNaN(num)) {
                let finalNum = num;
                if (min !== undefined && finalNum < min) finalNum = min;
                if (max !== undefined && finalNum > max) finalNum = max;
                setLocalValue(finalNum.toString());
                onChange(finalNum);
            }
        }
        if (onBlur) onBlur(e);
    };

    return (
        <input
            {...props}
            type="text"
            inputMode="numeric"
            value={localValue}
            onChange={handleChange}
            onBlur={handleBlur}
            onFocus={(e) => {
                e.target.select();
                if (onFocus) onFocus(e);
            }}
            className={className}
        />
    );
}

