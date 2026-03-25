// src/lib/types/printArchive.ts
import { BaseEntity } from "../store";

export type ArchiveCategory = '出荷伝票' | '請求書' | '領収書' | '納品書' | 'その他';

export interface PrintArchiveHistory {
    id: string;
    action: 'upload' | 'preview' | 'print' | 'update_memo' | 'update_category';
    timestamp: string; // ISO String
    userId?: string;
    userName?: string;
    detail?: string;
}

export interface PrintArchive extends BaseEntity {
    id: string;
    title: string;
    fileName: string;
    fileUrl: string;
    storagePath: string;
    category: ArchiveCategory;
    memo?: string;
    tags?: string[];
    createdAt: any; // Firestore Timestamp
    updatedAt: any; // Firestore Timestamp
    history: PrintArchiveHistory[];
}
