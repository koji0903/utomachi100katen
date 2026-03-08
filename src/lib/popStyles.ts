// src/lib/popStyles.ts

export type POPStyle = {
    id: string;
    name: string;
    bgColor: string;
    textColor: string;
    accentColor: string;
    fontFamily: string;
    borderStyle: string;
};

export const POP_STYLES: POPStyle[] = [
    {
        id: "premium",
        name: "プレミアム（百貨店風）",
        bgColor: "bg-slate-900",
        textColor: "text-white",
        accentColor: "border-amber-400",
        fontFamily: "font-serif",
        borderStyle: "border-2",
    },
    {
        id: "natural",
        name: "ナチュラル（木目・自然）",
        bgColor: "bg-stone-50",
        textColor: "text-stone-800",
        accentColor: "border-emerald-600",
        fontFamily: "font-sans",
        borderStyle: "border-4",
    },
    {
        id: "modern",
        name: "モダン（シンプル・洗練）",
        bgColor: "bg-white",
        textColor: "text-slate-900",
        accentColor: "border-[#1e3a8a]",
        fontFamily: "font-sans",
        borderStyle: "border-t-8",
    },
    {
        id: "vibrant",
        name: "にぎやか（直売所風）",
        bgColor: "bg-amber-50",
        textColor: "text-orange-900",
        accentColor: "border-orange-500",
        fontFamily: "font-sans font-bold",
        borderStyle: "border-dashed border-2",
    },
];
