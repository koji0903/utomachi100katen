"use client";

import { useState, useEffect, useRef } from "react";
import { X, Save, Tag, Image as ImageIcon, UploadCloud } from "lucide-react";
import { useStore, Brand } from "@/lib/store";
import { uploadImageWithCompression } from "@/lib/imageUpload";

interface BrandModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Brand | null;
}

export function BrandModal({ isOpen, onClose, initialData }: BrandModalProps) {
    const { addBrand, updateBrand } = useStore();

    const [name, setName] = useState("");
    const [concept, setConcept] = useState("");
    const [story, setStory] = useState("");
    const [imageUrl, setImageUrl] = useState("");

    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setName(initialData ? initialData.name : "");
            setConcept(initialData ? (initialData.concept || "") : "");
            setStory(initialData ? (initialData.story || "") : "");
            setImageUrl(initialData ? (initialData.imageUrl || "") : "");
            setImagePreview(initialData ? (initialData.imageUrl || null) : null);
            setImageFile(null);
        }
    }, [isOpen, initialData]);

    if (!isOpen) return null;

    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsUploading(true);
        try {
            let currentImageUrl = imageUrl;
            if (imageFile) {
                currentImageUrl = await uploadImageWithCompression(imageFile);
            }

            const data = {
                name,
                concept,
                story,
                imageUrl: currentImageUrl
            };

            if (initialData) {
                await updateBrand(initialData.id, data);
            } else {
                await addBrand(data);
            }
            onClose();
        } catch (error) {
            console.error("Failed to save brand:", error);
            alert("保存に失敗しました。");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full sm:max-w-xl max-h-[95vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 text-[#1e3a8a] rounded-lg">
                            <Tag className="w-5 h-5" />
                        </div>
                        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                            {initialData ? "ブランド編集" : "新規ブランド登録"}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    <form id="brand-form" onSubmit={handleSubmit} className="space-y-6">
                        {/* Image Upload Area */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">ブランドイメージ画像</label>
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-40 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 hover:border-blue-400 transition-all overflow-hidden relative group"
                            >
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <p className="text-white text-sm font-medium flex items-center gap-2">
                                                <UploadCloud className="w-4 h-4" /> 画像を変更
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 p-4 text-center">
                                        <ImageIcon className="w-8 h-8 mb-2 text-slate-300" />
                                        <p className="text-xs font-medium text-slate-600">クリックしてアップロード</p>
                                    </div>
                                )}
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleImageChange}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">
                                ブランド名称 <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                placeholder="例: おいのり"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">
                                ブランドコンセプト <span className="text-slate-400 text-xs font-normal ml-2">任意</span>
                            </label>
                            <input
                                type="text"
                                value={concept}
                                onChange={(e) => setConcept(e.target.value)}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white"
                                placeholder="例: 宇土を祈りでつなぐ"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 block">
                                ブランドストーリー <span className="text-slate-400 text-xs font-normal ml-2">任意</span>
                            </label>
                            <textarea
                                rows={4}
                                value={story}
                                onChange={(e) => setStory(e.target.value)}
                                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/20 focus:border-[#1e3a8a] transition-all bg-slate-50 focus:bg-white resize-none"
                                placeholder="ブランドの背景や共通の想いをご記入ください..."
                            />
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-100 bg-slate-50/50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-colors"
                    >
                        キャンセル
                    </button>
                    <button
                        type="submit"
                        form="brand-form"
                        disabled={isUploading}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-[#1e3a8a] rounded-lg hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-[#1e3a8a]/50 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isUploading ? "保存中..." : "保存する"}
                    </button>
                </div>
            </div>
        </div>
    );
}
