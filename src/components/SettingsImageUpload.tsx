"use client";

import { useRef } from "react";
import { ImageIcon, UploadCloud, X } from "lucide-react";
import { ensureProcessableImage } from "@/lib/imageUpload";

interface SettingsImageUploadProps {
    label: string;
    description?: string;
    previewUrl: string | null;
    onFileSelect: (file: File | null) => void;
    onClear: () => void;
    isUploading?: boolean;
}

export function SettingsImageUpload({
    label,
    description,
    previewUrl,
    onFileSelect,
    onClear,
    isUploading = false
}: SettingsImageUploadProps) {
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const processed = await ensureProcessableImage(file);
            onFileSelect(processed);
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-600">
                    {label}
                    {description && <span className="ml-2 text-[10px] font-normal text-slate-400">{description}</span>}
                </label>
                {previewUrl && (
                    <button
                        type="button"
                        onClick={onClear}
                        className="text-[10px] text-red-500 hover:text-red-700 transition-colors"
                    >
                        URLをクリア
                    </button>
                )}
            </div>
            <div
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-slate-300 transition-all overflow-hidden relative group"
            >
                {previewUrl ? (
                    <>
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-contain p-2" />
                        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <p className="text-white text-xs font-medium flex items-center gap-2">
                                <UploadCloud className="w-4 h-4" /> 画像を変更
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                        <ImageIcon className="w-8 h-8 mb-1 text-slate-300" />
                        <p className="text-[10px] font-medium text-slate-600">クリックしてアップロード</p>
                    </div>
                )}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*,.heic,.heif"
                    className="hidden"
                    disabled={isUploading}
                />
            </div>
        </div>
    );
}
